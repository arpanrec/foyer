// The cache store, built on cacheable's Cacheable class with a record layer as its `secondary` layer, implementing the
// CacheStore interface in types.ts. With FOYER_DISK_CACHE=true the record layer is a file store, so entries are written
// to disk as they are stored and outlive a restart; otherwise it is a map (memory.ts), nothing is written to disk and
// the cache starts empty after a restart. Cacheable keeps the entries it has read or written in its memory layer too,
// and `entries`, `keys`, `size` and `stats` read the record layer.

import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";

import { Cacheable, createKeyv, Keyv } from "cacheable";

import { MemoryStore } from "@/utils/cache/memory";
import type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
    RecordStore,
    StoredListing,
    StoredRecord,
} from "@/utils/cache/types";
import { dataDir, getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

const logger = createLogger("cache");

// A Keyv storage adapter that keeps one file per entry in a private folder. Keyv hands it `{ value, expires }` records,
// which it writes with the V8 serializer, so buffers, dates and maps survive. A file is named by a hash of the key and
// holds the key, because a key can be a URL with a token in it, which is one more reason the folder is private. Nothing
// here throws on disk trouble: a folder that cannot be created or written turns the adapter off with one warning, and a
// file that cannot be read or decoded is a miss.
const SUFFIX = ".v8";
// Bumped when the layout of a file changes, so an older file reads as a miss
const FORMAT = 4;
// A temp file older than this is the leftover of an interrupted write
const STALE_TEMP_MS = 60_000;

type FileContent = { v: number; key: string; data: StoredRecord };

function isLive(content: FileContent | undefined, now: number): content is FileContent {
    return (
        content?.v === FORMAT &&
        typeof content.key === "string" &&
        (content.data.expires === undefined || (typeof content.data.expires === "number" && content.data.expires > now))
    );
}

export class FileStore extends EventEmitter implements RecordStore {
    readonly opts = {};
    namespace?: string | undefined;
    private ready: Promise<boolean> | undefined;

    constructor(private readonly dir: string) {
        super();
    }

    private fileOf(key: string) {
        return join(this.dir, `${createHash("sha256").update(key).digest("hex")}${SUFFIX}`);
    }

    // Creates the folder once, and prunes it in the background the first time
    private available(): Promise<boolean> {
        this.ready ??= mkdir(this.dir, { recursive: true, mode: 0o700 }).then(
            () => {
                void this.prune();
                return true;
            },
            (error: unknown) => {
                warnOnce(
                    logger,
                    "The cache folder %s cannot be created, so entries are not cached: %s",
                    this.dir,
                    errorMessage(error)
                );
                return false;
            }
        );
        return this.ready;
    }

    // The live record stored for a key, or undefined. A file that is no longer any use is removed.
    async get(key: string): Promise<StoredRecord | undefined> {
        if (!(await this.available())) return undefined;
        const file = this.fileOf(key);
        let content: FileContent;
        try {
            content = deserialize(await readFile(file)) as FileContent;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.debug("Cache disk file %s cannot be read: %s", file, errorMessage(error));
                await unlink(file).catch(() => undefined);
            }
            return undefined;
        }
        if (!isLive(content, Date.now()) || content.key !== key) {
            await unlink(file).catch(() => undefined);
            return undefined;
        }
        return content.data;
    }

    // A value the serializer cannot hold, such as a function, is not kept.
    async set(key: string, data: StoredRecord): Promise<boolean> {
        let bytes: Buffer;
        try {
            bytes = serialize({ v: FORMAT, key, data } satisfies FileContent);
        } catch (error) {
            logger.debug("Cache entry cannot be written to disk: %s", errorMessage(error));
            return false;
        }
        if (!(await this.available())) return false;
        const file = this.fileOf(key);
        // written under another name and renamed, so a reader never sees half a file
        const temp = `${file}.${process.pid}.tmp`;
        try {
            await writeFile(temp, bytes, { mode: 0o600 });
            await rename(temp, file);
        } catch (error) {
            await unlink(temp).catch(() => undefined);
            warnOnce(logger, "A cache entry cannot be written to %s: %s", this.dir, errorMessage(error));
            return false;
        }
        return true;
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    async delete(key: string): Promise<boolean> {
        const existed = await this.has(key);
        await unlink(this.fileOf(key)).catch(() => undefined);
        return existed;
    }

    async clear(): Promise<void> {
        const names = await readdir(this.dir).catch(() => [] as string[]);
        await Promise.all(
            names
                .filter((name) => name.endsWith(SUFFIX))
                .map((name) => unlink(join(this.dir, name)).catch(() => undefined))
        );
    }

    // Every live entry with its key, record and file size. A file that cannot be decoded is left out and not removed.
    async list(): Promise<StoredListing[]> {
        if (!(await this.available())) return [];
        const names = await readdir(this.dir).catch(() => [] as string[]);
        const now = Date.now();
        const listing: StoredListing[] = [];
        for (const name of names) {
            if (!name.endsWith(SUFFIX)) continue;
            try {
                const file = join(this.dir, name);
                const content = deserialize(await readFile(file)) as FileContent;
                if (!isLive(content, now)) continue;
                listing.push({ key: content.key, data: content.data, bytes: (await stat(file)).size });
            } catch {
                continue;
            }
        }
        return listing;
    }

    // Removes files that expired or cannot be decoded, and leftovers of an interrupted write. The folder has no size
    // limit.
    async prune(): Promise<void> {
        const names = await readdir(this.dir).catch(() => [] as string[]);
        const now = Date.now();
        for (const name of names) {
            const file = join(this.dir, name);
            if (name.endsWith(".tmp")) {
                const age = await stat(file).then(
                    (info) => now - info.mtimeMs,
                    () => 0
                );
                if (age > STALE_TEMP_MS) await unlink(file).catch(() => undefined);
                continue;
            }
            if (!name.endsWith(SUFFIX)) continue;
            try {
                if (!isLive(deserialize(await readFile(file)) as FileContent, now)) await unlink(file);
            } catch {
                await unlink(file).catch(() => undefined);
            }
        }
    }
}

const DISK_DIR = join(dataDir(), "cache");

// FOYER_DISK_CACHE: `true` writes entries to disk, unset or `false` keeps them in memory. Any other value keeps them in
// memory with a warning.
export function isDiskCacheEnabled(): boolean {
    const value = getEnv("DISK_CACHE");
    if (value === undefined || value === "" || value === "false") return false;
    if (value === "true") return true;
    logger.warn(
        "FOYER_DISK_CACHE is %s, not true or false, so the cache is kept in memory only",
        JSON.stringify(value)
    );
    return false;
}
const UNTYPED = "untyped";
const SEPARATOR = "\u0000";

// The key a record is stored under: the same key under two types is two entries
function recordKey(key: string, type: CacheArtifactType | undefined) {
    return `${type ?? ""}${SEPARATOR}${key}`;
}

function splitKey(stored: string): { type: CacheArtifactType | undefined; key: string } {
    const at = stored.indexOf(SEPARATOR);
    const type = stored.slice(0, at);
    return { type: type === "" ? undefined : (type as CacheArtifactType), key: stored.slice(at + 1) };
}

// Keyv's own serializer is turned off, so the file store receives the record as it is and writes it with the V8
// serializer
const passThrough = ((data: unknown) => data) as never;

export class DiskCacheStore implements CacheStore {
    private readonly records: RecordStore;
    private readonly cache: Cacheable;
    private readonly loading = new Map<string, Promise<unknown>>();
    private readonly policies = new Map<CacheArtifactType, CachePolicy>();

    // `onDisk` picks the record layer: one file per entry under `dir`, or a map, which leaves `dir` untouched
    constructor(dir: string = DISK_DIR, onDisk: boolean = isDiskCacheEnabled()) {
        this.records = onDisk ? new FileStore(dir) : new MemoryStore();
        this.cache = new Cacheable({
            // Values are stored as they are, never cloned, so a caller must not change what it gets back
            primary: createKeyv({ useClone: false }),
            secondary: new Keyv({
                store: this.records as never,
                serialize: passThrough,
                deserialize: passThrough,
                useKeyPrefix: false,
            }),
            nonBlocking: false,
        });
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
        // cannot both miss this and each start their own disk read or load.
        const running = this.loading.get(id);
        if (running) {
            logger.debug("Cache load shared: %s", label);
            return (await running) as T | undefined;
        }

        const run: { promise?: Promise<T | undefined> } = {};
        const loaded = (run.promise = (async () => {
            if (!refresh) {
                // getRaw, not get, so expiry is checked against this codebase's own now >= expires convention:
                // Cacheable's own primary-layer check treats the exact expiry millisecond as still live.
                const raw = await this.cache.getRaw<T>(id);
                if (raw?.value !== undefined && (raw.expires === undefined || raw.expires > Date.now())) {
                    logger.debug("Cache disk hit: %s", label);
                    return raw.value;
                }
            }

            logger.debug(refresh ? "Cache refresh: %s" : "Cache miss: %s", label);
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
            await this.cache.set(id, value, ttl);
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
        const live = await this.cache.has(id);
        await this.cache.delete(id);
        return live;
    }

    async clear(type?: CacheArtifactType): Promise<void> {
        for (const id of this.loading.keys()) {
            if (type === undefined || id.startsWith(`${type}${SEPARATOR}`)) this.loading.delete(id);
        }
        if (type === undefined) {
            await this.cache.clear();
            return;
        }
        for (const { key } of await this.records.list()) {
            if (splitKey(key).type === type) await this.cache.delete(key);
        }
    }

    // The live entries in the record layer, with their type and key split out
    private async list(type?: CacheArtifactType) {
        return (await this.records.list())
            .map(({ key, data, bytes }) => ({ ...splitKey(key), expires: data.expires, value: data.value, bytes }))
            .filter((entry) => type === undefined || entry.type === type);
    }

    async keys(type?: CacheArtifactType): Promise<string[]> {
        return (await this.list(type)).map((entry) => entry.key);
    }

    async entries(): Promise<CacheEntryInfo[]> {
        const now = Date.now();
        return (await this.list()).map(({ key, type, expires, value }) => ({
            key,
            type,
            expiresInMs: expires === undefined ? undefined : Math.max(0, expires - now),
            value,
        }));
    }

    async size(type?: CacheArtifactType): Promise<number> {
        return (await this.list(type)).length;
    }

    async setPolicy(type: CacheArtifactType, policy: CachePolicy): Promise<void> {
        this.policies.set(type, policy);
    }

    async policy(type: CacheArtifactType): Promise<CachePolicy | undefined> {
        return this.policies.get(type);
    }

    async stats(type?: CacheArtifactType): Promise<CacheStats> {
        const entries = await this.list(type);
        return { hits: 0, misses: 0, entries: entries.length, bytes: entries.reduce((sum, e) => sum + e.bytes, 0) };
    }

    // Removes expired records, and on disk undecodable files too
    async prune(): Promise<void> {
        await this.records.prune();
    }
}

// The shared instance, created once per process with one line saying where entries are kept
function createSharedCache(): DiskCacheStore {
    const onDisk = isDiskCacheEnabled();
    if (onDisk) logger.info("Cache entries are written to %s", DISK_DIR);
    else logger.info("Cache entries are kept in memory only; set FOYER_DISK_CACHE=true to keep them on disk");
    return new DiskCacheStore(DISK_DIR, onDisk);
}

// Next.js bundles each route separately, so a module-level instance would be one cache per route.
const globalForCache = globalThis as typeof globalThis & { __foyerDiskCache?: DiskCacheStore };
const cache = (globalForCache.__foyerDiskCache ??= createSharedCache());

export default cache;
