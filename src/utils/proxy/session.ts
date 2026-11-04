import cache from "@/utils/cache";

// What a login hands back for the cache: the token, cookie or header set to keep, and how long it stays valid
export interface SessionLogin<T> {
    value: T;
    // Milliseconds until it expires; without one it is kept until it is dropped. A value of 0 or less, or one that is
    // not a number (an expiry the service left out or sent in a form that did not parse), is kept for 1 ms, which is as
    // good as not keeping it.
    ttlMs?: number | undefined;
}

// The session cached under `key`, or the one `login` creates. `login` returns undefined when it fails, which caches
// nothing. Callers that ask while a login is running share it, and `refresh` logs in again whatever is cached.
export async function cachedSession<T>(
    key: string,
    login: () => Promise<SessionLogin<T> | undefined>,
    refresh = false
): Promise<T | undefined> {
    const session = await cache.getOrFetch<SessionLogin<T>>(key, login, {
        type: "session",
        refresh,
        ttlMs: ({ ttlMs }) => (ttlMs === undefined ? undefined : Number.isNaN(ttlMs) ? 1 : Math.max(1, ttlMs)),
    });
    return session?.value;
}

// Forgets the session, so the next cachedSession logs in
export async function dropSession(key: string) {
    return cache.del(key, "session");
}
