import cache, { type CacheArtifactType } from "@/utils/cache";
import { cachedSession } from "@/utils/proxy/session";

// What a test can ask of the shared cache now that values only go in and out through getOrFetch

// The cached value, or undefined. Nothing is loaded or stored.
export function peek<T = unknown>(key: string, type?: CacheArtifactType) {
    return cache.getOrFetch<T>(key, async () => undefined, { type });
}

// Puts a login's value in place for a key, as a service proxy's login would
export function seedSession<T>(key: string, value: T, ttlMs?: number) {
    return cache.getOrFetch(key, async () => ({ value, ttlMs }), { type: "session", refresh: true });
}

// Puts any value in place for a key and type
export function seed<T>(key: string, value: T, type?: CacheArtifactType, ttlMs?: number) {
    return cache.getOrFetch<T>(key, async () => value, { type, ttlMs, refresh: true });
}

// The value a service proxy's login kept under the key, or undefined
export function peekSession<T = unknown>(key: string) {
    return cachedSession<T>(key, async () => undefined);
}
