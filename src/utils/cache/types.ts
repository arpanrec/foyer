// What a cached value is. An entry is stored under its key and its artifact type, so the same key under two types
// is two entries, and a whole type can be listed or cleared on its own. An entry without a type belongs to no type.
export type CacheArtifactType =
    // downloaded icons, backgrounds and other images
    | "image"
    // parsed RSS and Atom feeds
    | "feed"
    // the rendered dashboard payload
    | "dashboard"
    // logins, tokens and cookies for an upstream service
    | "session"
    // an upstream service's answer to a widget request
    | "response"
    // an address the server allowed itself, or a third party, to fetch through /api/icon-proxy
    | "image-allowlist";

// Defaults for one artifact type. Only `ttlMs` is applied; the rest is the shape a future cache reads.
export interface CachePolicy {
    // Used when a load does not give a TTL
    ttlMs?: number | undefined;
    // How long a failed load is remembered, so it is not retried on every request
    failureTtlMs?: number | undefined;
}

// Counters for one artifact type, or for everything. A field stays 0 until a cache counts it.
export interface CacheStats {
    hits: number;
    misses: number;
    entries: number;
    bytes: number;
}

// How getOrFetch runs its loader and stores what it returns
export interface CacheLoadOptions<T = unknown> {
    type?: CacheArtifactType | undefined;
    // Milliseconds to keep the value, or a function of the loaded value for a TTL the loader's answer decides, such as a
    // token's expiry. Without one, or when the function returns undefined, the entry never expires.
    ttlMs?: number | ((value: T) => number | undefined) | undefined;
    // Run the loader even when a value is cached, and store what it returns in its place
    refresh?: boolean | undefined;
    // What the debug log shows for this entry instead of its key. A key can hold anything, a secret included, so a caller
    // whose key does gives a label without it.
    label?: string | undefined;
    // How long a loader that returned nothing or threw is remembered. Not applied yet.
    failureTtlMs?: number | undefined;
    // Serve the expired value when the loader fails. Not applied yet.
    staleOnError?: boolean | undefined;
}

// One live entry, as `entries` lists it
export interface CacheEntryInfo {
    key: string;
    type: CacheArtifactType | undefined;
    // Milliseconds until it expires, or undefined for an entry that never expires
    expiresInMs: number | undefined;
    value: unknown;
}

// What Keyv hands the record layer for a key. `expires` is undefined for a record that never expires.
export type StoredRecord = { value: unknown; expires?: number | undefined };

// One live record as the record layer lists it, with the bytes it takes on disk or once serialized
export type StoredListing = { key: string; data: StoredRecord; bytes: number };

// The layer under the cache store's memory layer that keeps every record and lists them: one file per entry
// (FileStore in disk.ts) or a map (MemoryStore in memory.ts). It is a Keyv storage adapter, so Keyv calls get, set,
// has, delete and clear; the store calls list and prune.
export interface RecordStore {
    get(key: string): Promise<StoredRecord | undefined>;
    set(key: string, data: StoredRecord): Promise<boolean>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    list(): Promise<StoredListing[]>;
    prune(): Promise<void>;
}

// What the cache backend (disk.ts) offers. Every call returns a promise.
export interface CacheStore {
    // The cached value, or what `load` returns, stored for next time. A loader that returns undefined stores nothing,
    // and one that throws stores nothing and passes the error on. Callers that ask for the same missing key while it
    // loads share one load.
    getOrFetch<T>(
        key: string,
        load: () => Promise<T | undefined>,
        options?: CacheLoadOptions<T>
    ): Promise<T | undefined>;
    // Resolves to true when a live entry was removed.
    del(key: string, type?: CacheArtifactType): Promise<boolean>;
    // Without a type, every entry; with one, only the entries of that type.
    clear(type?: CacheArtifactType): Promise<void>;
    keys(type?: CacheArtifactType): Promise<string[]>;
    // Every live entry with its type, time to expiry and value, for read-only inspection
    entries(): Promise<CacheEntryInfo[]>;
    size(type?: CacheArtifactType): Promise<number>;
    // The defaults of an artifact type
    setPolicy(type: CacheArtifactType, policy: CachePolicy): Promise<void>;
    policy(type: CacheArtifactType): Promise<CachePolicy | undefined>;
    stats(type?: CacheArtifactType): Promise<CacheStats>;
}
