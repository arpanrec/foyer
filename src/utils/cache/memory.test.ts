import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/utils/cache/memory";

afterEach(() => {
    vi.useRealTimers();
});

describe("utils/cache/memory", () => {
    it("stores, reads and deletes a record", async () => {
        const store = new MemoryStore();

        expect(await store.get("k")).toBeUndefined();
        expect(await store.set("k", { value: 1 })).toBe(true);
        expect(await store.get("k")).toEqual({ value: 1 });
        expect(await store.has("k")).toBe(true);
        expect(await store.delete("k")).toBe(true);
        expect(await store.delete("k")).toBe(false);
        expect(await store.has("k")).toBe(false);
    });

    it("keeps a value as it is, without cloning it", async () => {
        const store = new MemoryStore();
        const value = { nested: [1] };
        await store.set("k", { value });

        expect((await store.get("k"))!.value).toBe(value);
    });

    it("treats a record as expired from the millisecond it expires, and removes it", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const store = new MemoryStore();
        await store.set("k", { value: 1, expires: Date.now() + 1000 });

        vi.advanceTimersByTime(999);
        expect(await store.get("k")).toEqual({ value: 1, expires: expect.any(Number) });
        vi.advanceTimersByTime(1);
        expect(await store.get("k")).toBeUndefined();
        expect(await store.list()).toEqual([]);
    });

    it("lists live records with their serialized size, 0 for a value the serializer cannot hold", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const store = new MemoryStore();
        await store.set("text", { value: "hello" });
        await store.set("fn", { value: () => 1 });
        await store.set("old", { value: 1, expires: Date.now() + 10 });
        vi.advanceTimersByTime(10);

        const listing = await store.list();

        expect(listing.map((entry) => entry.key)).toEqual(["text", "fn"]);
        expect(listing[0]!.bytes).toBeGreaterThan(0);
        expect(listing[1]!.bytes).toBe(0);
    });

    it("prunes only expired records and clears everything", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const store = new MemoryStore();
        await store.set("old", { value: 1, expires: Date.now() + 10 });
        await store.set("later", { value: 2, expires: Date.now() + 60_000 });
        await store.set("live", { value: 3 });
        vi.advanceTimersByTime(10);

        await store.prune();
        expect((await store.list()).map((entry) => entry.key)).toEqual(["later", "live"]);

        await store.clear();
        expect(await store.list()).toEqual([]);
    });
});
