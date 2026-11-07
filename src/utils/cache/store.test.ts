import { serialize } from "node:v8";

import { CacheableMemory } from "@cacheable/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { EXPIRY_CHECK_INTERVAL_MS, LRU_SIZE, MemoryCacheStore } from "@/utils/cache/store";

const stores: MemoryCacheStore[] = [];

const open = () => {
    const store = new MemoryCacheStore();
    stores.push(store);
    return store;
};
const sorted = (keys: string[]) => [...keys].sort();

// Resolves a pending load through the resolve function its loader handed out, failing when the loader never ran
function settle(finish: ((value: string) => void) | undefined, value: string) {
    if (finish === undefined) throw new Error("The loader has not started");
    finish(value);
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    for (const store of stores.splice(0)) store.close();
    vi.useRealTimers();
});

describe("utils/cache/store", () => {
    it("serves a stored value as it is, without cloning it", async () => {
        const cache = open();
        const value = { body: Buffer.from([1, 2, 3]), nested: [1] };
        await cache.getOrFetch("k", async () => value, { type: "image", ttlMs: 60_000 });

        const load = vi.fn(async () => ({ body: Buffer.alloc(0), nested: [] }));
        expect(await cache.getOrFetch("k", load, { type: "image" })).toBe(value);
        expect(load).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith("Cache hit: %s", "image k");
    });

    it("treats an entry as expired from the millisecond it expires", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const cache = open();
        await cache.getOrFetch("k", async () => 1, { ttlMs: 1000 });

        vi.advanceTimersByTime(999);
        expect(await cache.entries()).toEqual([expect.objectContaining({ key: "k", expiresInMs: 1 })]);
        expect(await cache.getOrFetch("k", async () => 2)).toBe(1);
        vi.advanceTimersByTime(1);
        expect(await cache.keys()).toEqual([]);
        expect(await cache.del("k")).toBe(false);
        expect(await cache.getOrFetch("k", async () => 3)).toBe(3);
    });

    it("removes expired entries on a timer, even when they are never read again", async () => {
        vi.useFakeTimers();
        const cache = open();
        await cache.getOrFetch("old", async () => 1, { ttlMs: 1000 });
        await cache.getOrFetch("live", async () => 2);
        const memory = (cache as unknown as { memory: CacheableMemory }).memory;

        await vi.advanceTimersByTimeAsync(EXPIRY_CHECK_INTERVAL_MS);

        expect(memory.store.flatMap((map) => [...map.keys()])).toEqual(["\u0000live"]);
    });

    it("keeps every entry: LRU eviction is off, so there is no limit on the number of entries", async () => {
        expect(LRU_SIZE).toBe(0);
        const cache = open();
        for (let i = 0; i < 2000; i++) await cache.getOrFetch(`k${i}`, async () => i);

        expect(await cache.size()).toBe(2000);
        expect(await cache.getOrFetch("k0", async () => -1)).toBe(0);
    });

    it("loads again on refresh and shares a load in progress", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => 1);
        expect(await cache.getOrFetch("k", async () => 2, { refresh: true })).toBe(2);
        expect(logger.debug).toHaveBeenCalledWith("Cache refresh: %s", "untyped k");

        const load = vi.fn(async () => 3);
        const [a, b] = await Promise.all([
            cache.getOrFetch("n", load, { refresh: true, label: "label" }),
            cache.getOrFetch("n", load, { refresh: true, label: "label" }),
        ]);
        expect([a, b, load.mock.calls.length]).toEqual([3, 3, 1]);
        expect(logger.debug).toHaveBeenCalledWith("Cache load shared: %s", "untyped label");
    });

    it("stores nothing for undefined and passes on a thrown error", async () => {
        const cache = open();
        expect(await cache.getOrFetch("k", async () => undefined)).toBeUndefined();
        await expect(
            cache.getOrFetch("k", async () => {
                throw new Error("down");
            })
        ).rejects.toThrow("down");
        expect(await cache.size()).toBe(0);
    });

    it("uses a ttl function and a policy ttl, keeps an entry without either forever, and rejects a bad ttl", async () => {
        const cache = open();
        await cache.getOrFetch("a", async () => ({ t: 5000 }), { ttlMs: (v) => v.t });
        await cache.setPolicy("response", { ttlMs: 9000 });
        await cache.getOrFetch("b", async () => 1, { type: "response" });
        await cache.getOrFetch("c", async () => 1, { type: "feed" });
        await cache.getOrFetch("d", async () => 1, { ttlMs: () => undefined });
        const byKey = Object.fromEntries((await cache.entries()).map((e) => [e.key, e.expiresInMs]));

        expect(byKey["a"]).toBeGreaterThan(4000);
        expect(byKey["b"]).toBeGreaterThan(8000);
        expect(byKey["c"]).toBeUndefined();
        expect(byKey["d"]).toBeUndefined();
        expect(await cache.policy("response")).toEqual({ ttlMs: 9000 });
        expect(await cache.policy("feed")).toBeUndefined();
        for (const ttlMs of [-1, 0, Number.NaN, () => Number.NaN]) {
            await expect(cache.getOrFetch("e", async () => 1, { ttlMs })).rejects.toThrow("positive number");
        }
        await expect(cache.getOrFetch("e", async () => 1, { ttlMs: () => "1" as never })).rejects.toThrow(
            "positive number"
        );
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
        await cache.getOrFetch("d", async () => 4, { type: "feed" });

        expect(await cache.del("a", "feed")).toBe(true);
        expect(await cache.del("a", "feed")).toBe(false);
        await cache.clear("response");
        expect(sorted(await cache.keys())).toEqual(["c", "d"]);
        await cache.clear();
        expect(await cache.size()).toBe(0);
    });

    it("runs the loader of a refresh that starts while a cache hit is being returned", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => "old");

        const load = vi.fn(async () => "new");
        const [hit, refreshed] = await Promise.all([
            cache.getOrFetch("k", async () => "unused"),
            cache.getOrFetch("k", load, { refresh: true }),
        ]);

        expect(hit).toBe("old");
        expect(refreshed).toBe("new");
        expect(load).toHaveBeenCalledOnce();
        expect(await cache.getOrFetch("k", async () => "unused")).toBe("new");
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
        expect(await cache.keys()).toEqual([]);
    });

    it("clear stops a running load of a cleared type from being stored, and leaves other types' loads alone", async () => {
        const cache = open();
        let finishFeed: ((value: string) => void) | undefined;
        let finishImage: ((value: string) => void) | undefined;
        const feed = cache.getOrFetch("f", () => new Promise<string>((resolve) => (finishFeed = resolve)), {
            type: "feed",
        });
        const image = cache.getOrFetch("i", () => new Promise<string>((resolve) => (finishImage = resolve)), {
            type: "image",
        });

        // both loaders are running before the type is cleared
        await vi.waitFor(() => {
            expect(finishFeed).toBeTypeOf("function");
            expect(finishImage).toBeTypeOf("function");
        });
        await cache.clear("feed");
        settle(finishFeed, "late");
        settle(finishImage, "kept");

        expect(await feed).toBe("late");
        expect(await image).toBe("kept");
        expect(await cache.keys()).toEqual(["i"]);

        let finishAll: ((value: string) => void) | undefined;
        const all = cache.getOrFetch("a", () => new Promise<string>((resolve) => (finishAll = resolve)));
        await vi.waitFor(() => expect(finishAll).toBeTypeOf("function"));
        await cache.clear();
        settle(finishAll, "late");
        expect(await all).toBe("late");
        expect(await cache.keys()).toEqual([]);
    });

    it("counts entries and serialized bytes in stats, 0 bytes for a value the serializer cannot hold", async () => {
        const cache = open();
        await cache.getOrFetch("a", async () => "x", { type: "feed" });
        await cache.getOrFetch("b", async () => "y", { type: "response" });
        await cache.getOrFetch("fn", async () => () => 1, { type: "response" });

        expect(await cache.stats()).toEqual({
            hits: 0,
            misses: 0,
            entries: 3,
            bytes: serialize("x").length + serialize("y").length,
        });
        expect((await cache.stats("feed")).entries).toBe(1);
    });

    it("reports an entry without a TTL with no time to expiry", async () => {
        const cache = open();
        await cache.getOrFetch("k", async () => "v", { type: "feed" });

        expect(await cache.entries()).toEqual([{ key: "k", type: "feed", expiresInMs: undefined, value: "v" }]);
    });
});

describe("utils/cache/store shared instance", () => {
    it("is created once per process and kept on globalThis", async () => {
        const global = globalThis as typeof globalThis & { __foyerCache?: MemoryCacheStore };
        const shared = global.__foyerCache;
        try {
            delete global.__foyerCache;
            vi.resetModules();
            const { default: cache, MemoryCacheStore: Store } = await import("@/utils/cache/store");
            stores.push(cache);

            expect(cache).toBeInstanceOf(Store);
            expect(global.__foyerCache).toBe(cache);
            vi.resetModules();
            expect((await import("@/utils/cache/store")).default).toBe(cache);
        } finally {
            if (shared === undefined) delete global.__foyerCache;
            else global.__foyerCache = shared;
        }
    });
});
