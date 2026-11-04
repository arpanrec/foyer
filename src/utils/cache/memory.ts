// In-memory cache store. It and the disk store (disk.ts) have the same default export, a CacheStore, so a caller
// switches stores by changing one import. Each type has its own store, which drops its least recently used entry once it
// holds more entries than the type allows. Values go in through getOrFetch only, and `entries` reads them without
// loading anything.

import { CacheableMemory } from "cacheable";

import type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
import createLogger from "@/utils/logger";

export type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";

const logger = createLogger("cache");

// How many entries a type holds before its least recently used one is dropped, 0 for no limit. A policy's
// `maxEntries` replaces it. The limit counts entries, not bytes: an image entry holds the whole image.
const DEFAULT_MAX_ENTRIES: Record<CacheArtifactType, number> = {
    image: 1000,
    feed: 500,
    dashboard: 0,
    session: 500,
    response: 2000,
};

// How often a store drops entries that expired without being read. The timer never keeps the process alive.
const SWEEP_MS = 60_000;

// The same key under two types is two entries, so each type, and no type, has a store of its own
type StoreName = CacheArtifactType | "";

function recordKey(key: string, type: CacheArtifactType | undefined) {
    return `${type ?? ""}\u0000${key}`;
}

export class MemoryCache implements CacheStore {
    private readonly stores = new Map<StoreName, CacheableMemory>();
    private readonly loading = new Map<string, Promise<unknown>>();
    private readonly policies = new Map<CacheArtifactType, CachePolicy>();
    // Values are stored as they are, never cloned, so a caller must not change what it gets back
    private storeFor(type: CacheArtifactType | undefined): CacheableMemory {
        const name: StoreName = type ?? "";
        let store = this.stores.get(name);
        if (!store) {
            store = new CacheableMemory({
                useClone: false,
                lruSize: type === undefined ? 0 : (this.policyOf(type)?.maxEntries ?? DEFAULT_MAX_ENTRIES[type]),
                checkInterval: SWEEP_MS,
            });
            this.stores.set(name, store);
        }
        return store;
    }

    // The live value of a key, or undefined. An entry is over at the moment it expires, so one that expired without
    // being read is dropped here. A stored value is never undefined, so undefined is a miss.
    private read(key: string, type: CacheArtifactType | undefined): unknown {
        const store = this.stores.get(type ?? "");
        const raw = store?.getRaw(key);
        if (!store || !raw) return undefined;
        if (raw.expires !== undefined && raw.expires <= Date.now()) {
            store.delete(key);
            return undefined;
        }
        // get, not the raw value, so the read counts as a use for the least recently used order
        return store.get(key);
    }

    // The live entries of one store, or of every store. An entry that expired without being read is left out.
    private *live(type?: CacheArtifactType): Generator<CacheEntryInfo & { expires: number | undefined }> {
        const now = Date.now();
        const names = type === undefined ? [...this.stores.keys()] : [type];
        for (const name of names) {
            const store = this.stores.get(name);
            if (!store) continue;
            for (const item of store.items) {
                if (item.expires !== undefined && item.expires <= now) continue;
                yield {
                    key: item.key,
                    type: name === "" ? undefined : name,
                    expiresInMs: item.expires === undefined ? undefined : Math.max(0, item.expires - now),
                    value: item.value,
                    expires: item.expires,
                };
            }
        }
    }

    private store(key: string, type: CacheArtifactType | undefined, value: unknown, ttlMs?: number) {
        if (ttlMs !== undefined && (typeof ttlMs !== "number" || Number.isNaN(ttlMs) || ttlMs <= 0)) {
            throw new Error("Cache timeout must be a positive number");
        }
        const store = this.storeFor(type);
        if (ttlMs === undefined) store.set(key, value);
        else store.set(key, value, ttlMs);
    }

    // Callers that ask for a key while it is loading share that load, and a load that fails is not stored. Only the TTL
    // option is applied so far; the failure and stale options are accepted and ignored.
    async getOrFetch<T>(
        key: string,
        load: () => Promise<T | undefined>,
        options: CacheLoadOptions<T> = {}
    ): Promise<T | undefined> {
        const { type, ttlMs, refresh } = options;
        const id = recordKey(key, type);

        const label = `${type ?? "untyped"} ${options.label ?? key}`;

        if (!refresh) {
            const found = this.read(key, type) as T | undefined;
            if (found !== undefined) {
                logger.debug("Cache hit: %s", label);
                return found;
            }
        }

        const running = this.loading.get(id);
        if (running) {
            logger.debug("Cache load shared: %s", label);
            return (await running) as T | undefined;
        }

        logger.debug(refresh ? "Cache refresh: %s" : "Cache miss: %s", label);

        // the load's own promise, which it compares with the one registered when it finishes
        const run: { promise?: Promise<T | undefined> } = {};
        const loaded = (run.promise = (async () => {
            const value = await load();
            if (value === undefined) return undefined;
            // a key that was deleted or cleared while it loaded is not brought back by the old load
            if (this.loading.get(id) !== run.promise) return value;
            const ttl = typeof ttlMs === "function" ? ttlMs(value) : (ttlMs ?? this.policyOf(type)?.ttlMs);
            this.store(key, type, value, ttl);
            return value;
        })());

        this.loading.set(id, loaded);
        try {
            return await loaded;
        } finally {
            if (this.loading.get(id) === loaded) this.loading.delete(id);
        }
    }

    // Resolves to true when a live entry was removed. The in-memory cache answers at once, so a call that is not awaited
    // has still taken effect by the time the next line runs.
    async del(key: string, type?: CacheArtifactType): Promise<boolean> {
        // the next caller starts a load of its own instead of joining one that began before the delete
        this.loading.delete(recordKey(key, type));
        const live = this.read(key, type) !== undefined;
        this.stores.get(type ?? "")?.delete(key);
        return live;
    }

    // Without a type, removes every entry; with one, only the entries of that type.
    async clear(type?: CacheArtifactType): Promise<void> {
        for (const id of this.loading.keys()) {
            if (type === undefined || id.startsWith(`${type}\u0000`)) this.loading.delete(id);
        }
        if (type === undefined) {
            for (const store of this.stores.values()) store.clear();
        } else {
            this.stores.get(type)?.clear();
        }
    }

    private policyOf(type: CacheArtifactType | undefined): CachePolicy | undefined {
        return type === undefined ? undefined : this.policies.get(type);
    }

    // Without a type, the keys of every entry; with one, only the keys of that type's entries.
    async keys(type?: CacheArtifactType): Promise<string[]> {
        return [...this.live(type)].map((entry) => entry.key);
    }

    // Every live entry with its type, time to expiry and value
    async entries(): Promise<CacheEntryInfo[]> {
        return [...this.live()].map(({ key, type, expiresInMs, value }) => ({ key, type, expiresInMs, value }));
    }

    async size(type?: CacheArtifactType): Promise<number> {
        return [...this.live(type)].length;
    }

    // Remembered and returned. Its ttlMs applies to loads that give no TTL of their own, and its maxEntries is the
    // number of entries the type holds before the least recently used one is dropped.
    async setPolicy(type: CacheArtifactType, policy: CachePolicy): Promise<void> {
        this.policies.set(type, policy);
        if (policy.maxEntries !== undefined) this.storeFor(type).lruSize = policy.maxEntries;
    }

    async policy(type: CacheArtifactType): Promise<CachePolicy | undefined> {
        return this.policyOf(type);
    }

    // Only the number of entries is real so far; hits, misses and bytes are not counted.
    async stats(type?: CacheArtifactType): Promise<CacheStats> {
        return { hits: 0, misses: 0, entries: await this.size(type), bytes: 0 };
    }
}

// Next.js bundles each route separately, so a module-level instance would be one cache per route.
const globalForCache = globalThis as typeof globalThis & { __foyerMemoryCache?: MemoryCache };
const cache = (globalForCache.__foyerMemoryCache ??= new MemoryCache());

export default cache;
