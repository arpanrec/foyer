import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { DiskCacheStore, FileStore, isDiskCacheEnabled } from "@/utils/cache/disk";
import { resetWarnOnce } from "@/utils/warn-once";

let dir: string;

// a cache after a restart: a new object over the same folder
const open = () => new DiskCacheStore(dir, true);
const files = async () => (await readdir(dir)).filter((name) => name.endsWith(".v8"));

beforeEach(async () => {
    vi.clearAllMocks();
    resetWarnOnce();
    dir = await mkdtemp(join(tmpdir(), "foyer-cache-test-"));
});

afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
});

describe("utils/cache/disk", () => {
    it("serves an entry after a restart without loading it again, buffers included", async () => {
        const body = Buffer.from([1, 2, 3, 4]);
        await open().getOrFetch("https://x.test/a.png", async () => ({ body, contentType: "image/png" }), {
            type: "image",
            ttlMs: 60_000,
        });

        const load = vi.fn(async () => ({ body: Buffer.alloc(0), contentType: "other" }));
        const value = await open().getOrFetch("https://x.test/a.png", load, { type: "image" });

        expect(load).not.toHaveBeenCalled();
        expect(value).toEqual({ body, contentType: "image/png" });
        expect(Buffer.isBuffer(value!.body)).toBe(true);
    });

    it("keeps the time an entry has left, not a new full TTL", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        await open().getOrFetch("k", async () => "v", { type: "response", ttlMs: 60_000 });

        vi.advanceTimersByTime(40_000);
        expect((await open().entries())[0]!.expiresInMs).toBe(20_000);

        vi.advanceTimersByTime(25_000);
        expect(await open().getOrFetch("k", async () => "new", { type: "response" })).toBe("new");
    });

    it("loads again on refresh and shares a load in progress", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => 1);
        expect(await cache.getOrFetch("k", async () => 2, { refresh: true })).toBe(2);

        const load = vi.fn(async () => 3);
        const [a, b] = await Promise.all([
            cache.getOrFetch("n", load, { refresh: true }),
            cache.getOrFetch("n", load, { refresh: true }),
        ]);
        expect([a, b, load.mock.calls.length]).toEqual([3, 3, 1]);
    });

    it("stores nothing for undefined and passes on a thrown error", async () => {
        const cache = open();
        expect(await cache.getOrFetch("k", async () => undefined)).toBeUndefined();
        await expect(
            cache.getOrFetch("k", async () => {
                throw new Error("down");
            })
        ).rejects.toThrow("down");
        expect(await files()).toEqual([]);
    });

    it("uses a ttl function and a policy ttl, and rejects a bad ttl", async () => {
        const cache = open();
        await cache.getOrFetch("a", async () => ({ t: 5000 }), { ttlMs: (v) => v.t });
        await cache.setPolicy("response", { ttlMs: 9000 });
        await cache.getOrFetch("b", async () => 1, { type: "response" });
        const byKey = Object.fromEntries((await cache.entries()).map((e) => [e.key, e.expiresInMs]));
        expect(byKey["a"]).toBeGreaterThan(4000);
        expect(byKey["b"]).toBeGreaterThan(8000);
        expect(await cache.policy("response")).toEqual({ ttlMs: 9000 });
        await expect(cache.getOrFetch("c", async () => 1, { ttlMs: -1 })).rejects.toThrow("positive number");
    });

    it("keeps the same key under two types as two entries", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => "a", { type: "feed" });
        await cache.getOrFetch("k", async () => "b", { type: "response" });
        expect(await cache.getOrFetch("k", async () => "x", { type: "feed" })).toBe("a");
        expect(await cache.getOrFetch("k", async () => "x", { type: "response" })).toBe("b");
        expect(await cache.keys("feed")).toEqual(["k"]);
        expect(await cache.keys()).toEqual(["k", "k"]);
        expect(await cache.size("response")).toBe(1);
    });

    it("deletes and clears entries, by type or all", async () => {
        const cache = open();
        await cache.getOrFetch("a", async () => 1, { type: "feed" });
        await cache.getOrFetch("b", async () => 2, { type: "response" });
        await cache.getOrFetch("c", async () => 3);

        expect(await cache.del("a", "feed")).toBe(true);
        expect(await cache.del("a", "feed")).toBe(false);
        await cache.clear("response");
        expect(await cache.keys()).toEqual(["c"]);
        await cache.clear();
        expect(await files()).toEqual([]);
    });

    it("does not bring back a key deleted while it loaded", async () => {
        const cache = open();
        let finish!: (value: number) => void;
        const pending = cache.getOrFetch("k", () => new Promise<number>((resolve) => (finish = resolve)), {
            refresh: true,
        });
        await cache.del("k");
        finish(1);
        expect(await pending).toBe(1);
        expect(await files()).toEqual([]);
    });

    it("counts entries and bytes in stats", async () => {
        const cache = open();
        await cache.getOrFetch("a", async () => "x", { type: "feed" });
        await cache.getOrFetch("b", async () => "y", { type: "response" });
        const all = await cache.stats();
        expect(all.entries).toBe(2);
        expect(all.bytes).toBeGreaterThan(0);
        expect((await cache.stats("feed")).entries).toBe(1);
    });

    it("treats an expired, corrupt or foreign-format file as a miss and removes it", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => 1, { ttlMs: 1000 });
        const [name] = await files();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.advanceTimersByTime(5000);
        expect(await cache.getOrFetch("k", async () => 2)).toBe(2);
        vi.useRealTimers();

        await writeFile(join(dir, name!), "garbage");
        expect(await open().getOrFetch("k", async () => 3)).toBe(3);
        expect(logger.debug).toHaveBeenCalled();
    });

    it("skips a value the serializer cannot hold", async () => {
        const cache = open();
        expect(await cache.getOrFetch("k", async () => () => 1)).toBeInstanceOf(Function);
        expect(await files()).toEqual([]);
    });

    it("prunes expired, undecodable and stale temporary files, and ignores other files", async () => {
        const cache = open();
        await cache.getOrFetch("old", async () => 1, { ttlMs: 1 });
        await cache.getOrFetch("live", async () => 2);
        await writeFile(join(dir, "bad-x.v8"), "garbage");
        await writeFile(join(dir, "stale.tmp"), "x");
        await writeFile(join(dir, "fresh.tmp"), "x");
        await writeFile(join(dir, "other.txt"), "x");
        const past = new Date(Date.now() - 600_000);
        await utimes(join(dir, "stale.tmp"), past, past);
        await new Promise((resolve) => setTimeout(resolve, 10));

        await cache.prune();

        const names = await readdir(dir);
        expect(names).toContain("fresh.tmp");
        expect(names).toContain("other.txt");
        expect(names).not.toContain("stale.tmp");
        expect(names).not.toContain("bad-x.v8");
        expect(await cache.keys()).toEqual(["live"]);
    });

    it("reports an entry without a TTL with no time to expiry", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => "v", { type: "feed" });

        expect(await cache.entries()).toEqual([{ key: "k", type: "feed", expiresInMs: undefined, value: "v" }]);
    });

    it("clear stops a running load of a cleared type from being written, and leaves other types' loads alone", async () => {
        const cache = open();
        let finishFeed: ((value: string) => void) | undefined;
        let finishImage: ((value: string) => void) | undefined;
        const feed = cache.getOrFetch("f", () => new Promise<string>((resolve) => (finishFeed = resolve)), {
            type: "feed",
        });
        const image = cache.getOrFetch("i", () => new Promise<string>((resolve) => (finishImage = resolve)), {
            type: "image",
        });

        // getOrFetch reads the cache before it calls the loader
        await vi.waitFor(() => {
            expect(finishFeed).toBeTypeOf("function");
            expect(finishImage).toBeTypeOf("function");
        });
        await cache.clear("feed");
        finishFeed!("late");
        finishImage!("kept");

        expect(await feed).toBe("late");
        expect(await image).toBe("kept");
        expect(await cache.keys()).toEqual(["i"]);

        let finishAll: ((value: string) => void) | undefined;
        const all = cache.getOrFetch("a", () => new Promise<string>((resolve) => (finishAll = resolve)));
        await vi.waitFor(() => expect(finishAll).toBeTypeOf("function"));
        await cache.clear();
        finishAll!("late");
        expect(await all).toBe("late");
        expect(await files()).toEqual([]);
    });

    it("warns once and removes the temporary file when an entry cannot be renamed into place", async () => {
        const store = new FileStore(dir);
        const target = join(dir, `${createHash("sha256").update("k").digest("hex")}.v8`);
        await mkdir(target);
        await writeFile(join(target, "inside"), "x");

        expect(await store.set("k", { value: 1 })).toBe(false);

        expect(logger.warn).toHaveBeenCalledWith("A cache entry cannot be written to %s: %s", dir, expect.any(String));
        expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    });

    it("lists only live entries, leaving out expired and undecodable files", async () => {
        const store = new FileStore(dir);
        await store.set("live", { value: 1 });
        await store.set("old", { value: 2, expires: Date.now() + 1000 });
        // the first use prunes the folder in the background; let it finish before adding a bad file
        await new Promise((resolve) => setTimeout(resolve, 20));
        await writeFile(join(dir, "bad-x.v8"), "garbage");
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.advanceTimersByTime(5000);

        const listing = await store.list();

        expect(listing.map((entry) => entry.key)).toEqual(["live"]);
        expect((await readdir(dir)).sort()).toContain("bad-x.v8");
    });

    it("keeps a temporary file whose age cannot be read when pruning", async () => {
        const store = new FileStore(dir);
        const dangling = join(dir, "dangling.tmp");
        await symlink(join(dir, "missing"), dangling);

        await store.prune();

        expect((await lstat(dangling)).isSymbolicLink()).toBe(true);
    });

    it("keeps entries in memory only, with one warning, when the folder cannot be created", async () => {
        const blocker = join(dir, "file");
        await writeFile(blocker, "x");
        const cache = new DiskCacheStore(join(blocker, "sub"), true);

        expect(await cache.getOrFetch("k", async () => 1)).toBe(1);
        // the memory layer of cacheable still holds it
        expect(await cache.getOrFetch("k", async () => 2)).toBe(1);
        expect(await cache.entries()).toEqual([]);
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });
});

describe("utils/cache/disk FOYER_DISK_CACHE", () => {
    it("is off when unset, empty or false, and on only for true", () => {
        for (const value of [undefined, "", "false"]) {
            vi.stubEnv("FOYER_DISK_CACHE", value);
            expect(isDiskCacheEnabled()).toBe(false);
        }
        vi.stubEnv("FOYER_DISK_CACHE", "true");
        expect(isDiskCacheEnabled()).toBe(true);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it("keeps the cache in memory, with a warning that names the value, for anything else", () => {
        vi.stubEnv("FOYER_DISK_CACHE", "yes");

        expect(isDiskCacheEnabled()).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            "FOYER_DISK_CACHE is %s, not true or false, so the cache is kept in memory only",
            '"yes"'
        );
    });

    it("reads the variable when no layer is given", async () => {
        vi.stubEnv("FOYER_DISK_CACHE", "true");
        await new DiskCacheStore(dir).getOrFetch("k", async () => 1);
        expect(await files()).toHaveLength(1);

        vi.stubEnv("FOYER_DISK_CACHE", "false");
        const memory = join(dir, "memory");
        await new DiskCacheStore(memory).getOrFetch("k", async () => 1);
        await expect(readdir(memory)).rejects.toThrow();
    });

    it("creates the shared instance once, on disk or in memory as the variable says, and logs which", async () => {
        const global = globalThis as typeof globalThis & { __foyerDiskCache?: unknown };
        const shared = global.__foyerDiskCache;
        try {
            for (const [value, line] of [
                ["true", "Cache entries are written to %s"],
                [undefined, "Cache entries are kept in memory only; set FOYER_DISK_CACHE=true to keep them on disk"],
            ] as const) {
                delete global.__foyerDiskCache;
                vi.resetModules();
                logger.info.mockClear();
                vi.stubEnv("FOYER_DISK_CACHE", value);

                const { default: cache, DiskCacheStore: Store } = await import("@/utils/cache/disk");

                expect(cache).toBeInstanceOf(Store);
                expect(logger.info).toHaveBeenCalledTimes(1);
                expect(logger.info.mock.calls[0]![0]).toBe(line);
            }
            vi.resetModules();
            expect((await import("@/utils/cache/disk")).default).toBe(global.__foyerDiskCache);
            expect(logger.info).toHaveBeenCalledTimes(1);
        } finally {
            global.__foyerDiskCache = shared;
        }
    });
});

describe("utils/cache/disk in memory", () => {
    const memory = () => new DiskCacheStore(dir, false);

    it("writes nothing to the folder, and starts empty after a restart", async () => {
        const cache = memory();
        await cache.getOrFetch("k", async () => "v", { type: "feed", ttlMs: 60_000 });

        expect(await cache.getOrFetch("k", async () => "new", { type: "feed" })).toBe("v");
        expect(await readdir(dir)).toEqual([]);
        expect(await memory().getOrFetch("k", async () => "new", { type: "feed" })).toBe("new");
    });

    it("lists, counts, deletes and clears entries by type", async () => {
        const cache = memory();
        await cache.getOrFetch("a", async () => "x", { type: "feed" });
        await cache.getOrFetch("b", async () => "y", { type: "response", ttlMs: 60_000 });
        await cache.getOrFetch("c", async () => "z");

        expect(await cache.keys()).toEqual(["a", "b", "c"]);
        expect(await cache.size("feed")).toBe(1);
        expect((await cache.stats()).bytes).toBeGreaterThan(0);
        expect((await cache.entries())[1]).toMatchObject({ key: "b", type: "response", value: "y" });

        expect(await cache.del("a", "feed")).toBe(true);
        expect(await cache.del("a", "feed")).toBe(false);
        await cache.clear("response");
        expect(await cache.keys()).toEqual(["c"]);
        await cache.clear();
        expect(await cache.size()).toBe(0);
    });

    it("keeps a value the disk layer cannot write, counted as 0 bytes", async () => {
        const cache = memory();
        const value = () => 1;
        await cache.getOrFetch("k", async () => value);

        expect(await cache.getOrFetch("k", async () => () => 2)).toBe(value);
        expect(await cache.stats()).toEqual({ hits: 0, misses: 0, entries: 1, bytes: 0 });
    });

    it("drops an entry once it expires, and prunes it", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const cache = memory();
        await cache.getOrFetch("old", async () => 1, { ttlMs: 1000 });
        await cache.getOrFetch("live", async () => 2);
        vi.advanceTimersByTime(1000);

        await cache.prune();

        expect(await cache.keys()).toEqual(["live"]);
        expect(await cache.getOrFetch("old", async () => 3)).toBe(3);
    });
});
