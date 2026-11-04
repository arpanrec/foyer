import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { peek } from "@/test-utils/cache";
import cache, { MemoryCache } from "@/utils/cache/memory";

describe("utils/cache", () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        await cache.clear();
    });

    afterEach(async () => {
        await cache.clear();
        vi.useRealTimers();
    });

    describe("entries", () => {
        it("lists live entries with type, time to expiry and value, and leaves out an expired one", async () => {
            await cache.getOrFetch("a", async () => ({ n: 1 }), { type: "response", ttlMs: 60_000 });
            await cache.getOrFetch("b", async () => "kept");
            await cache.getOrFetch("old", async () => 1, { ttlMs: 1000 });
            vi.advanceTimersByTime(2000);

            const entries = await cache.entries();

            expect(entries).toHaveLength(2);
            expect(entries).toContainEqual({ key: "a", type: "response", expiresInMs: 58_000, value: { n: 1 } });
            expect(entries).toContainEqual({ key: "b", type: undefined, expiresInMs: undefined, value: "kept" });
        });
    });

    describe("getOrFetch", () => {
        it("loads on a miss, stores the value and serves it afterwards", async () => {
            const load = vi.fn().mockResolvedValue({ n: 1 });

            expect(await cache.getOrFetch("a", load)).toEqual({ n: 1 });
            expect(await cache.getOrFetch("a", load)).toEqual({ n: 1 });

            expect(load).toHaveBeenCalledTimes(1);
        });

        it("peeks without loading or storing when the loader returns undefined", async () => {
            expect(await peek("missing")).toBeUndefined();
            expect(await cache.size()).toBe(0);
        });

        it("stores falsy values such as false, 0 and an empty string", async () => {
            for (const value of [false, 0, ""]) {
                const load = vi.fn().mockResolvedValue(value);
                await cache.getOrFetch(`k:${String(value)}`, load);
                expect(await cache.getOrFetch(`k:${String(value)}`, load)).toBe(value);
                expect(load).toHaveBeenCalledTimes(1);
            }
        });

        it("keeps a value without a TTL", async () => {
            await cache.getOrFetch("a", async () => 1);
            vi.advanceTimersByTime(24 * 60 * 60 * 1000);
            expect(await peek("a")).toBe(1);
        });

        it("expires a value when its TTL elapses", async () => {
            await cache.getOrFetch("a", async () => 1, { ttlMs: 1000 });
            vi.advanceTimersByTime(999);
            expect(await peek("a")).toBe(1);
            vi.advanceTimersByTime(2);
            expect(await peek("a")).toBeUndefined();
            expect(await cache.size()).toBe(0);
        });

        it("takes the TTL from a function of the loaded value", async () => {
            const ttlMs = vi.fn((value: { ttl: number }) => value.ttl);
            await cache.getOrFetch("short", async () => ({ ttl: 1000 }), { ttlMs });
            await cache.getOrFetch("long", async () => ({ ttl: 5000 }), { ttlMs });
            await cache.getOrFetch("forever", async () => ({ ttl: undefined as unknown as number }), { ttlMs });

            vi.advanceTimersByTime(2000);
            expect(await peek("short")).toBeUndefined();
            expect(await peek("long")).toEqual({ ttl: 5000 });
            vi.advanceTimersByTime(60_000);
            expect(await peek("forever")).toEqual({ ttl: undefined });
        });

        it("refresh runs the loader again and replaces the value and its TTL", async () => {
            const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

            await cache.getOrFetch("a", load, { ttlMs: 1000 });
            vi.advanceTimersByTime(800);
            expect(await cache.getOrFetch("a", load, { ttlMs: 1000, refresh: true })).toBe(2);
            vi.advanceTimersByTime(800);

            expect(await peek("a")).toBe(2);
            expect(await cache.size()).toBe(1);
        });

        it("drops the TTL when a value is replaced without one", async () => {
            await cache.getOrFetch("a", async () => 1, { ttlMs: 1000 });
            await cache.getOrFetch("a", async () => 2, { refresh: true });
            vi.advanceTimersByTime(5000);
            expect(await peek("a")).toBe(2);
        });

        it("stores nothing when the loader returns undefined", async () => {
            const load = vi.fn().mockResolvedValue(undefined);

            expect(await cache.getOrFetch("a", load)).toBeUndefined();
            expect(await cache.getOrFetch("a", load)).toBeUndefined();

            expect(load).toHaveBeenCalledTimes(2);
            expect(await cache.size()).toBe(0);
        });

        it("passes a loader's error on and stores nothing", async () => {
            const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");

            await expect(cache.getOrFetch("a", load)).rejects.toThrow("boom");
            expect(await cache.size()).toBe(0);
            expect(await cache.getOrFetch("a", load)).toBe("ok");
        });

        it("shares one load between callers that ask while it runs", async () => {
            let finish: (value: string) => void = () => {};
            const load = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));

            const first = cache.getOrFetch("a", load);
            const second = cache.getOrFetch("a", load);
            finish("loaded");

            expect(await first).toBe("loaded");
            expect(await second).toBe("loaded");
            expect(load).toHaveBeenCalledTimes(1);
        });

        it("gives every caller that shared a load its error", async () => {
            let fail: (error: Error) => void = () => {};
            const load = vi.fn(() => new Promise<string>((_, reject) => (fail = reject)));

            const first = cache.getOrFetch("a", load);
            const second = cache.getOrFetch("a", load);
            fail(new Error("boom"));

            await expect(first).rejects.toThrow("boom");
            await expect(second).rejects.toThrow("boom");
            expect(load).toHaveBeenCalledTimes(1);
        });

        it("does not let a load that began before a delete bring the entry back, and lets the next caller load afresh", async () => {
            let finishOld: (value: string) => void = () => {};
            const oldLoad = vi.fn(() => new Promise<string>((resolve) => (finishOld = resolve)));

            const old = cache.getOrFetch("a", oldLoad);
            await cache.del("a");
            expect(await cache.getOrFetch("a", async () => "new")).toBe("new");

            finishOld("old");
            expect(await old).toBe("old");
            expect(await peek("a")).toBe("new");
            expect(oldLoad).toHaveBeenCalledTimes(1);
        });

        it("clear stops a running load from storing its value", async () => {
            let finish: (value: string) => void = () => {};
            const load = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));

            const running = cache.getOrFetch("a", load, { type: "image" });
            await cache.clear("image");
            finish("late");

            expect(await running).toBe("late");
            expect(await cache.size()).toBe(0);
        });

        it("rejects a TTL that is not a positive number", async () => {
            await expect(cache.getOrFetch("a", async () => 1, { ttlMs: 0 })).rejects.toThrow("positive number");
            await expect(cache.getOrFetch("a", async () => 1, { ttlMs: -5 })).rejects.toThrow("positive number");
            await expect(cache.getOrFetch("a", async () => 1, { ttlMs: Number.NaN })).rejects.toThrow(
                "positive number"
            );
            expect(await cache.size()).toBe(0);
        });

        it("drops a value that has expired without its timer firing", async () => {
            const local = new MemoryCache();
            await local.getOrFetch("a", async () => 1, { ttlMs: 1000 });
            // The clock moves on without the expiry timer firing, which leaves a stale entry in the map
            vi.setSystemTime(Date.now() + 2000);

            expect(await local.getOrFetch("a", async () => undefined)).toBeUndefined();
            expect(await local.size()).toBe(0);
        });

        it("does not keep the process alive for the sweep of expired entries", async () => {
            const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
            await new MemoryCache().getOrFetch("a", async () => 1, { ttlMs: 1000 });

            expect(setIntervalSpy).toHaveBeenCalledTimes(1);
            expect((setIntervalSpy.mock.results[0]!.value as NodeJS.Timeout).hasRef()).toBe(false);
            setIntervalSpy.mockRestore();
        });
    });

    describe("debug log", () => {
        beforeEach(() => logger.debug.mockClear());

        const debugLines = () => logger.debug.mock.calls.map(([format, ...args]) => [format, ...args].join(" "));

        it("logs a miss and then a hit, with the artifact type and key", async () => {
            await cache.getOrFetch("home", async () => 1, { type: "session" });
            await cache.getOrFetch("home", async () => 1, { type: "session" });

            expect(logger.debug).toHaveBeenNthCalledWith(1, "Cache miss: %s", "session home");
            expect(logger.debug).toHaveBeenNthCalledWith(2, "Cache hit: %s", "session home");
        });

        it("logs an entry without a type as untyped", async () => {
            await cache.getOrFetch("k", async () => 1);
            expect(logger.debug).toHaveBeenCalledWith("Cache miss: %s", "untyped k");
        });

        it("logs a refresh and a load that was shared", async () => {
            let finish: (value: number) => void = () => {};
            const slow = () => new Promise<number>((resolve) => (finish = resolve));

            const first = cache.getOrFetch("k", slow);
            const second = cache.getOrFetch("k", slow);
            finish(1);
            await Promise.all([first, second]);
            await cache.getOrFetch("k", async () => 2, { refresh: true });

            expect(logger.debug).toHaveBeenCalledWith("Cache load shared: %s", "untyped k");
            expect(logger.debug).toHaveBeenCalledWith("Cache refresh: %s", "untyped k");
        });

        it("logs the key as it is, whatever it holds", async () => {
            const keys = [
                "plain",
                "plex.svc.0",
                "a b/c?d=e",
                "user:pass@host",
                JSON.stringify({ a: [1, 2] }),
                "ключ-键",
            ];
            for (const key of keys) await cache.getOrFetch(key, async () => 1, { type: "response" });

            for (const key of keys) expect(logger.debug).toHaveBeenCalledWith("Cache miss: %s", `response ${key}`);
        });

        it("logs the label instead of the key when one is given, so a key that holds a secret stays out of the log", async () => {
            await cache.getOrFetch("https://api.example.com/v1?appid=SECRET", async () => 1, {
                type: "response",
                label: "weather api.example.com",
            });
            await cache.getOrFetch("https://api.example.com/v1?appid=SECRET", async () => 1, {
                type: "response",
                label: "weather api.example.com",
            });

            expect(logger.debug).toHaveBeenNthCalledWith(1, "Cache miss: %s", "response weather api.example.com");
            expect(logger.debug).toHaveBeenNthCalledWith(2, "Cache hit: %s", "response weather api.example.com");
            expect(debugLines().join("\n")).not.toContain("SECRET");
        });

        it("does not log a value", async () => {
            await cache.getOrFetch("k", async () => "a-token-value");
            await cache.getOrFetch("k", async () => "a-token-value");
            expect(debugLines().join("\n")).not.toContain("a-token-value");
        });
    });

    describe("del, clear, keys and size", () => {
        it("del removes a live entry and reports it", async () => {
            await cache.getOrFetch("a", async () => 1);
            expect(await cache.del("a")).toBe(true);
            expect(await peek("a")).toBeUndefined();
            expect(await cache.del("a")).toBe(false);
        });

        it("del and clear take effect at once, even when the returned promise is not awaited", async () => {
            await cache.getOrFetch("a", async () => 1);
            await cache.getOrFetch("b", async () => 2, { type: "image" });

            void cache.del("a");
            void cache.clear("image");

            expect(await peek("a")).toBeUndefined();
            expect(await peek("b", "image")).toBeUndefined();
        });

        it("del reports false for an entry that has already expired", async () => {
            const local = new MemoryCache();
            await local.getOrFetch("a", async () => 1, { ttlMs: 1000 });
            vi.setSystemTime(Date.now() + 2000);
            expect(await local.del("a")).toBe(false);
            expect(await local.size()).toBe(0);
        });

        it("clear removes every entry and its timers", async () => {
            await cache.getOrFetch("a", async () => 1, { ttlMs: 1000 });
            await cache.getOrFetch("b", async () => 2);
            await cache.clear();
            expect(await cache.size()).toBe(0);
            expect(await cache.keys()).toEqual([]);
            expect(vi.getTimerCount()).toBe(0);
        });

        it("keys and size reflect the stored entries", async () => {
            await cache.getOrFetch("a", async () => 1);
            await cache.getOrFetch("b", async () => 2, { ttlMs: 1000 });
            expect(await cache.keys()).toEqual(["a", "b"]);
            expect(await cache.size()).toBe(2);
        });

        it("shares one instance between separately loaded copies of the module", async () => {
            await cache.getOrFetch("shared", async () => "yes");
            vi.resetModules();
            const other = (await import("@/utils/cache/memory")).default;
            expect(await other.getOrFetch("shared", async () => undefined)).toBe("yes");
        });
    });

    describe("artifact types", () => {
        it("keeps the same key under different types as different entries", async () => {
            await cache.getOrFetch("k", async () => "plain");
            await cache.getOrFetch("k", async () => "an image", { type: "image" });
            await cache.getOrFetch("k", async () => "a feed", { type: "feed" });

            expect(await peek("k")).toBe("plain");
            expect(await peek("k", "image")).toBe("an image");
            expect(await peek("k", "feed")).toBe("a feed");
            expect(await peek("k", "session")).toBeUndefined();
            expect(await cache.size()).toBe(3);
        });

        it("expires and replaces an entry within its own type only", async () => {
            await cache.getOrFetch("k", async () => 1, { type: "image", ttlMs: 1000 });
            await cache.getOrFetch("k", async () => 2, { type: "feed" });

            vi.advanceTimersByTime(2000);
            expect(await peek("k", "image")).toBeUndefined();
            expect(await peek("k", "feed")).toBe(2);

            await cache.getOrFetch("k", async () => 3, { type: "feed", refresh: true });
            expect(await peek("k", "feed")).toBe(3);
            expect(await cache.size("feed")).toBe(1);
        });

        it("del removes the entry of that type only", async () => {
            await cache.getOrFetch("k", async () => 1);
            await cache.getOrFetch("k", async () => 2, { type: "image" });

            expect(await cache.del("k", "image")).toBe(true);
            expect(await peek("k", "image")).toBeUndefined();
            expect(await peek("k")).toBe(1);
            expect(await cache.del("k", "image")).toBe(false);
        });

        it("keys and size can be limited to a type", async () => {
            await cache.getOrFetch("a", async () => 1, { type: "image" });
            await cache.getOrFetch("b", async () => 2, { type: "image" });
            await cache.getOrFetch("c", async () => 3, { type: "feed" });
            await cache.getOrFetch("d", async () => 4);

            expect((await cache.keys("image")).sort()).toEqual(["a", "b"]);
            expect(await cache.keys("feed")).toEqual(["c"]);
            expect(await cache.keys("session")).toEqual([]);
            expect((await cache.keys()).sort()).toEqual(["a", "b", "c", "d"]);
            expect(await cache.size("image")).toBe(2);
            expect(await cache.size()).toBe(4);
        });

        it("clear can be limited to a type", async () => {
            await cache.getOrFetch("a", async () => 1, { type: "image", ttlMs: 1000 });
            await cache.getOrFetch("b", async () => 2, { type: "feed", ttlMs: 1000 });
            await cache.getOrFetch("c", async () => 3);

            await cache.clear("image");

            expect((await cache.keys()).sort()).toEqual(["b", "c"]);
            await cache.clear();
            expect(await cache.size()).toBe(0);
        });

        it("lists nothing for a type that has never held an entry", async () => {
            const fresh = new MemoryCache();

            expect(await fresh.keys("feed")).toEqual([]);
            expect(await fresh.size("feed")).toBe(0);
        });

        it("leaves out an entry at the moment it expires", async () => {
            await cache.getOrFetch("edge", async () => 1, { type: "response", ttlMs: 1000 });
            await cache.getOrFetch("kept", async () => 2, { type: "response" });
            vi.advanceTimersByTime(1000);

            expect(await cache.keys("response")).toEqual(["kept"]);
        });

        it("clear limited to a type lets a running load of another type store its value", async () => {
            let finish: (value: string) => void = () => {};
            const load = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));

            const running = cache.getOrFetch("a", load, { type: "feed" });
            await cache.clear("image");
            finish("kept");

            expect(await running).toBe("kept");
            expect(await peek("a", "feed")).toBe("kept");
        });

        it("drops the least recently used entry of a type once it holds more than its policy allows", async () => {
            await cache.setPolicy("image", { maxEntries: 2 });
            await cache.getOrFetch("a", async () => 1, { type: "image" });
            await cache.getOrFetch("b", async () => 2, { type: "image" });
            await cache.getOrFetch("a", async () => 1, { type: "image" });
            await cache.getOrFetch("c", async () => 3, { type: "image" });

            expect((await cache.keys("image")).sort()).toEqual(["a", "c"]);
            // another type is not counted against it
            await cache.getOrFetch("x", async () => 1, { type: "feed" });
            expect(await cache.size("feed")).toBe(1);
            await cache.setPolicy("image", { maxEntries: 0 });
        });

        it("does not list an entry that expired before it was read", async () => {
            await cache.getOrFetch("old", async () => 1, { type: "response", ttlMs: 1000 });
            await cache.getOrFetch("kept", async () => 2, { type: "response" });
            vi.advanceTimersByTime(2000);

            expect(await cache.keys("response")).toEqual(["kept"]);
            expect(await cache.size()).toBe(1);
            expect((await cache.entries()).map((entry) => entry.key)).toEqual(["kept"]);
        });

        it("a key that contains the separator cannot reach another type's entry", async () => {
            await cache.getOrFetch("x", async () => "plain", { type: "image" });
            expect(await peek("image\u0000x")).toBeUndefined();
        });

        it("gives one key one load per type", async () => {
            const load = vi.fn(async () => "v");
            await Promise.all([
                cache.getOrFetch("k", load, { type: "image" }),
                cache.getOrFetch("k", load, { type: "feed" }),
            ]);
            expect(load).toHaveBeenCalledTimes(2);
        });
    });

    describe("policy and stats", () => {
        it("getOrFetch uses the given TTL, else the type's policy TTL", async () => {
            // policies are not cleared with the entries, so use an instance of its own
            const local = new MemoryCache();
            await local.setPolicy("feed", { ttlMs: 1000 });
            await local.getOrFetch("a", async () => 1, { type: "feed" });
            await local.getOrFetch("b", async () => 2, { type: "feed", ttlMs: 5000 });

            vi.advanceTimersByTime(2000);
            expect(await local.getOrFetch("a", async () => undefined, { type: "feed" })).toBeUndefined();
            expect(await local.getOrFetch("b", async () => undefined, { type: "feed" })).toBe(2);
        });

        it("setPolicy keeps a policy per type", async () => {
            const local = new MemoryCache();
            expect(await local.policy("image")).toBeUndefined();
            await local.setPolicy("image", { ttlMs: 10_000, failureTtlMs: 60_000 });
            expect(await local.policy("image")).toEqual({ ttlMs: 10_000, failureTtlMs: 60_000 });
            expect(await local.policy("feed")).toBeUndefined();
        });

        it("stats reports the number of entries and leaves the other counters at 0", async () => {
            await cache.getOrFetch("a", async () => 1, { type: "image" });
            await cache.getOrFetch("b", async () => 2);

            expect(await cache.stats()).toEqual({ hits: 0, misses: 0, entries: 2, bytes: 0 });
            expect(await cache.stats("image")).toEqual({ hits: 0, misses: 0, entries: 1, bytes: 0 });
        });
    });
});
