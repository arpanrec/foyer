// The cache store, built on CacheableMemory from @cacheable/memory, implementing the CacheStore interface in types.ts.
// Each entry has its own TTL, and there is no limit on the number or size of entries.

import { serialize } from "node:v8";

import { CacheableMemory } from "@cacheable/memory";

import type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
import createLogger from "@/utils/logger";

const logger = createLogger("cache");

// How often expired entries are removed, so an entry that is never read again does not stay in the cache. The timer is
// unref'd, so it never keeps the process alive.
export const EXPIRY_CHECK_INTERVAL_MS = 60_000;
// CacheableMemory evicts the least recently used entry once it holds this many; 0 turns that off, so the cache has no
// limit on the number of entries.
export const LRU_SIZE = 0;

// One entry as CacheableMemory holds it: `expires` is the millisecond it expires, or undefined for one that never does
type Item = { key: string; value: unknown; expires?: number | undefined };

// An entry is live until the millisecond it expires
function isLive(item: Item, now: number) {
    return item.expires === undefined || item.expires > now;
}

// The bytes a value takes once serialized, or 0 for one the serializer cannot hold, such as a function
function bytesOf(value: unknown) {
    try {
        return serialize(value).length;
    } catch {
        return 0;
    }
}

const UNTYPED = "untyped";
const SEPARATOR = "\u0000";

// The key an entry is stored under: the same key under two types is two entries
function recordKey(key: string, type: CacheArtifactType | undefined) {
    return `${type ?? ""}${SEPARATOR}${key}`;
}

function splitKey(stored: string): { type: CacheArtifactType | undefined; key: string } {
    const at = stored.indexOf(SEPARATOR);
    const type = stored.slice(0, at);
    return { type: type === "" ? undefined : (type as CacheArtifactType), key: stored.slice(at + 1) };
}

export class MemoryCacheStore implements CacheStore {
    private readonly memory = new CacheableMemory({
        // Values are stored as they are, never cloned, so a caller must not change what it gets back
        useClone: false,
        lruSize: LRU_SIZE,
        checkInterval: EXPIRY_CHECK_INTERVAL_MS,
    });
    private readonly loading = new Map<string, Promise<unknown>>();
    private readonly policies = new Map<CacheArtifactType, CachePolicy>();

    // The live entry stored under a key, checked against this codebase's own now >= expires convention:
    // CacheableMemory's own check treats the exact expiry millisecond as still live.
    private live(id: string): Item | undefined {
        const item = this.memory.getRaw(id) as Item | undefined;
        return item !== undefined && isLive(item, Date.now()) ? item : undefined;
    }

    async getOrFetch<T>(
        key: string,
        load: () => Promise<T | undefined>,
        options: CacheLoadOptions<T> = {}
    ): Promise<T | undefined> {
        const { type, ttlMs, refresh } = options;
        const id = recordKey(key, type);
        const label = `${type ?? UNTYPED} ${options.label ?? key}`;

        // Checked and registered synchronously, with no await in between, so two concurrent calls for the same key
        // cannot both miss this and each start their own load.
        const running = this.loading.get(id);
        if (running) {
            logger.debug("Cache load shared: %s", label);
            return (await running) as T | undefined;
        }

        // A hit is never registered as a running load, so a refresh that starts while it is being returned still loads
        if (!refresh) {
            const item = this.live(id);
            if (item?.value !== undefined) {
                logger.debug("Cache hit: %s", label);
                return item.value as T;
            }
        }

        logger.debug(refresh ? "Cache refresh: %s" : "Cache miss: %s", label);
        const run: { promise?: Promise<T | undefined> } = {};
        const loaded = (run.promise = (async () => {
            const value = await load();
            if (value === undefined) return undefined;
            // a key that was deleted or cleared while it loaded is not brought back by the old load
            if (this.loading.get(id) !== run.promise) return value;
            const ttl =
                typeof ttlMs === "function"
                    ? ttlMs(value)
                    : (ttlMs ?? (type === undefined ? undefined : this.policies.get(type)?.ttlMs));
            if (ttl !== undefined && (typeof ttl !== "number" || Number.isNaN(ttl) || ttl <= 0)) {
                throw new Error("Cache timeout must be a positive number");
            }
            this.memory.set(id, value, ttl);
            return value;
        })());

        this.loading.set(id, loaded);
        try {
            return await loaded;
        } finally {
            if (this.loading.get(id) === loaded) this.loading.delete(id);
        }
    }

    async del(key: string, type?: CacheArtifactType): Promise<boolean> {
        const id = recordKey(key, type);
        this.loading.delete(id);
        const live = this.live(id) !== undefined;
        this.memory.delete(id);
        return live;
    }

    async clear(type?: CacheArtifactType): Promise<void> {
        for (const id of this.loading.keys()) {
            if (type === undefined || id.startsWith(`${type}${SEPARATOR}`)) this.loading.delete(id);
        }
        if (type === undefined) {
            this.memory.clear();
            return;
        }
        for (const id of this.memory.keys) {
            if (splitKey(id).type === type) this.memory.delete(id);
        }
    }

    // The live entries, with their type and key split out
    private list(type?: CacheArtifactType) {
        const now = Date.now();
        return [...(this.memory.items as IterableIterator<Item>)]
            .filter((item) => isLive(item, now))
            .map((item) => ({ ...splitKey(item.key), expires: item.expires, value: item.value }))
            .filter((entry) => type === undefined || entry.type === type);
    }

    async keys(type?: CacheArtifactType): Promise<string[]> {
        return this.list(type).map((entry) => entry.key);
    }

    async entries(): Promise<CacheEntryInfo[]> {
        const now = Date.now();
        return this.list().map(({ key, type, expires, value }) => ({
            key,
            type,
            expiresInMs: expires === undefined ? undefined : Math.max(0, expires - now),
            value,
        }));
    }

    async size(type?: CacheArtifactType): Promise<number> {
        return this.list(type).length;
    }

    async setPolicy(type: CacheArtifactType, policy: CachePolicy): Promise<void> {
        this.policies.set(type, policy);
    }

    async policy(type: CacheArtifactType): Promise<CachePolicy | undefined> {
        return this.policies.get(type);
    }

    async stats(type?: CacheArtifactType): Promise<CacheStats> {
        const entries = this.list(type);
        return {
            hits: 0,
            misses: 0,
            entries: entries.length,
            bytes: entries.reduce((sum, entry) => sum + bytesOf(entry.value), 0),
        };
    }

    // Stops the expiry timer
    close(): void {
        this.memory.stopIntervalCheck();
    }
}

// Next.js bundles each route separately, so a module-level instance would be one cache per route.
const globalForCache = globalThis as typeof globalThis & { __foyerCache?: MemoryCacheStore };
const cache = (globalForCache.__foyerCache ??= new MemoryCacheStore());

export default cache;
