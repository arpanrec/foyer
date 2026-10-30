import { describe, expect, it, vi } from "vitest";

import { readPersistedCache, writePersistedCache } from "@/utils/swr-cache";

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
    };
}

const cacheOf = (states: Record<string, { data?: unknown; error?: unknown }>) => ({
    keys: () => Object.keys(states),
    get: (key: string) => states[key],
});

describe("utils/swr-cache", () => {
    it("persists only successful widget proxy data", () => {
        const storage = memoryStorage();
        writePersistedCache(
            storage,
            cacheOf({
                "/api/services/proxy?a=1": { data: { count: 3 } },
                "/api/services/proxy?b=1": { data: { error: "boom" } },
                "/api/services/proxy?c=1": { data: { count: 1 }, error: new Error("x") },
                "/api/services/proxy?d=1": {},
                "/api/hash": { data: "abc" },
            }),
            1000
        );

        expect(readPersistedCache(storage, 2000)).toEqual([["/api/services/proxy?a=1", { count: 3 }]]);
    });

    it("drops entries older than an hour", () => {
        const storage = memoryStorage();
        writePersistedCache(storage, cacheOf({ "/api/services/proxy?a=1": { data: 1 } }), 0);

        expect(readPersistedCache(storage, 60 * 60 * 1000)).toHaveLength(1);
        expect(readPersistedCache(storage, 60 * 60 * 1000 + 1)).toEqual([]);
    });

    it("returns nothing for corrupt or missing storage", () => {
        expect(readPersistedCache({ getItem: () => "not json" })).toEqual([]);
        expect(readPersistedCache({ getItem: () => null })).toEqual([]);
        expect(
            readPersistedCache({
                getItem: () => {
                    throw new Error("blocked");
                },
            })
        ).toEqual([]);
    });

    it("logs a warning and carries on when storage is full", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(() =>
            writePersistedCache(
                {
                    setItem: () => {
                        throw new Error("quota");
                    },
                },
                cacheOf({})
            )
        ).not.toThrow();
        expect(warn).toHaveBeenCalledWith("Unable to save the widget cache: %s", "quota");

        warn.mockRestore();
    });
});
