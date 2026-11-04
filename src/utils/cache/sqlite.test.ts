import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { SqliteCacheStore } from "@/utils/cache/sqlite";
import { resetWarnOnce } from "@/utils/warn-once";

let dir: string;
const open = () => new SqliteCacheStore(join(dir, "cache.sqlite"));

beforeEach(async () => {
    vi.clearAllMocks();
    resetWarnOnce();
    dir = await mkdtemp(join(tmpdir(), "foyer-sqlite-test-"));
});

afterEach(async () => {
    vi.useRealTimers();
    await rm(dir, { recursive: true, force: true });
});

describe("utils/cache/sqlite", () => {
    it("serves an entry after a restart, buffers included", async () => {
        const body = Buffer.from([1, 2, 3]);
        await open().getOrFetch("k", async () => ({ body }), { type: "image", ttlMs: 60_000 });
        const load = vi.fn(async () => ({ body: Buffer.alloc(0) }));
        const value = await open().getOrFetch("k", load, { type: "image" });
        expect(load).not.toHaveBeenCalled();
        expect(Buffer.from(value!.body)).toEqual(body);
    });

    it("expires entries and reports the time left", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const cache = open();
        await cache.getOrFetch("k", async () => "v", { type: "response", ttlMs: 60_000 });
        vi.advanceTimersByTime(40_000);
        expect((await cache.entries())[0]!.expiresInMs).toBe(20_000);
        vi.advanceTimersByTime(25_000);
        expect(await cache.getOrFetch("k", async () => "new", { type: "response" })).toBe("new");
    });

    it("loads again on refresh, shares a load in progress and stores nothing for undefined", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => 1);
        expect(await cache.getOrFetch("k", async () => 2, { refresh: true })).toBe(2);
        const load = vi.fn(async () => 3);
        const both = await Promise.all([
            cache.getOrFetch("n", load, { refresh: true }),
            cache.getOrFetch("n", load, { refresh: true }),
        ]);
        expect([both, load.mock.calls.length]).toEqual([[3, 3], 1]);
        expect(await cache.getOrFetch("u", async () => undefined)).toBeUndefined();
        expect(await cache.keys()).not.toContain("u");
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

    it("keeps the same key under two types, and deletes, clears, counts", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => "a", { type: "feed" });
        await cache.getOrFetch("k", async () => "b", { type: "response" });
        await cache.getOrFetch("c", async () => 3);
        expect(await cache.getOrFetch("k", async () => "x", { type: "feed" })).toBe("a");
        expect(await cache.size("response")).toBe(1);
        expect((await cache.stats()).entries).toBe(3);
        expect((await cache.stats("feed")).bytes).toBeGreaterThan(0);
        expect(await cache.del("k", "feed")).toBe(true);
        expect(await cache.del("k", "feed")).toBe(false);
        await cache.clear("response");
        expect(await cache.keys()).toEqual(["c"]);
        await cache.clear();
        expect(await cache.size()).toBe(0);
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
        expect(await cache.size()).toBe(0);
    });

    it("skips a value the serializer cannot hold", async () => {
        const cache = open();
        expect(await cache.getOrFetch("k", async () => () => 1)).toBeInstanceOf(Function);
        expect(await cache.size()).toBe(0);
    });

    it("drops a row whose value cannot be decoded", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => 1);
        (cache as unknown as { db: { exec(sql: string): void } }).db.exec("UPDATE cache SET value = x'00'");
        expect(await cache.getOrFetch("k", async () => 2)).toBe(2);
    });

    it("falls back to memory with one warning when the database cannot be opened", async () => {
        const blocker = join(dir, "file");
        await writeFile(blocker, "x");
        const cache = new SqliteCacheStore(join(blocker, "sub", "cache.sqlite"));
        expect(await cache.getOrFetch("k", async () => 1)).toBe(1);
        expect(await cache.getOrFetch("k", async () => 2)).toBe(1);
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });
});
