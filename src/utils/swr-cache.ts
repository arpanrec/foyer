// Only widget data is persisted. Config-driven keys such as /api/hash and /api/services are always fetched fresh.
const PERSISTED_PREFIX = "/api/services/proxy";
const STORAGE_KEY = "foyer:swr-cache";
const MAX_AGE_MS = 60 * 60 * 1000;

// Set on sign-out so the save that runs when the page unloads does not write the data back.
let cleared = false;

export type PersistedEntry = [key: string, data: unknown];

type PersistedCache = {
    savedAt: number;
    entries: PersistedEntry[];
};

type CacheLike = {
    keys(): Iterable<string>;
    get(key: string): { data?: unknown; error?: unknown } | undefined;
};

function hasErrorBody(data: unknown) {
    return typeof data === "object" && data !== null && "error" in data;
}

export function readPersistedCache(storage: Pick<Storage, "getItem">, now = Date.now()): PersistedEntry[] {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Partial<PersistedCache>;
        if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > MAX_AGE_MS) return [];
        if (!Array.isArray(parsed.entries)) return [];
        return parsed.entries.filter(
            (entry): entry is PersistedEntry => Array.isArray(entry) && typeof entry[0] === "string"
        );
    } catch {
        return [];
    }
}

export function writePersistedCache(storage: Pick<Storage, "setItem">, cache: CacheLike, now = Date.now()) {
    if (cleared) return;

    const entries: PersistedEntry[] = [];
    for (const key of cache.keys()) {
        if (!key.startsWith(PERSISTED_PREFIX)) continue;
        const state = cache.get(key);
        if (state?.data === undefined || state.error || hasErrorBody(state.data)) continue;
        entries.push([key, state.data]);
    }

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: now, entries } satisfies PersistedCache));
    } catch (e) {
        // storage is full or unavailable; the cache is rebuilt from the network
        console.warn("Unable to save the widget cache: %s", e instanceof Error ? e.message : String(e));
    }
}

export function clearPersistedCache(storage: Pick<Storage, "removeItem">) {
    cleared = true;
    try {
        storage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn("Unable to clear the widget cache: %s", e instanceof Error ? e.message : String(e));
    }
}
