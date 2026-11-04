// Disk cache store, built on cacheable's Cacheable class with a file store as its `secondary` layer. It has the same
// default export as memory.ts, a CacheStore, so a caller switches stores by changing one import. Entries are written to
// disk as they are stored, so they outlive a restart; Cacheable keeps the entries it has read or written in memory too,
// and `entries`, `keys`, `size` and `stats` read the folder.

import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";

import { Cacheable, Keyv } from "cacheable";

import type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
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

// What Keyv stores for a key. `expires` is undefined for a record that never expires.
export type FileRecord = { value: unknown; expires?: number | undefined };
type FileContent = { v: number; key: string; data: FileRecord };

export type FileListing = { key: string; data: FileRecord; bytes: number };

function isLive(content: FileContent | undefined, now: number): content is FileContent {
    return (
        content?.v === FORMAT &&
        typeof content.key === "string" &&
        (content.data.expires === undefined || (typeof content.data.expires === "number" && content.data.expires > now))
    );
}

export class FileStore extends EventEmitter {
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
    async get(key: string): Promise<FileRecord | undefined> {
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
    async set(key: string, data: FileRecord): Promise<boolean> {
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
    async list(): Promise<FileListing[]> {
        if (!(await this.available())) return [];
        const names = await readdir(this.dir).catch(() => [] as string[]);
        const now = Date.now();
        const listing: FileListing[] = [];
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

const DISK_DIR = "/tmp/foyer/cache";
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
    private readonly files: FileStore;
    private readonly cache: Cacheable;
    private readonly loading = new Map<string, Promise<unknown>>();
    private readonly policies = new Map<CacheArtifactType, CachePolicy>();

    constructor(dir: string = DISK_DIR) {
        this.files = new FileStore(dir);
        this.cache = new Cacheable({
            secondary: new Keyv({
                store: this.files as never,
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

        if (!refresh) {
            const found = await this.cache.get<T>(id);
            if (found !== undefined) {
                logger.debug("Cache disk hit: %s", label);
                return found;
            }
        }

        const running = this.loading.get(id);
        if (running) {
            logger.debug("Cache load shared: %s", label);
            return (await running) as T | undefined;
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
        for (const { key } of await this.files.list()) {
            if (splitKey(key).type === type) await this.cache.delete(key);
        }
    }

    // The live entries in the folder, with their type and key split out
    private async list(type?: CacheArtifactType) {
        return (await this.files.list())
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

    // Only ttlMs is applied; maxEntries is ignored because the disk store has no entry limit
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

    // Removes expired and undecodable files from the folder
    async prune(): Promise<void> {
        await this.files.prune();
    }
}

// Next.js bundles each route separately, so a module-level instance would be one cache per route.
const globalForCache = globalThis as typeof globalThis & { __foyerDiskCache?: DiskCacheStore };
const cache = (globalForCache.__foyerDiskCache ??= new DiskCacheStore());

export default cache;
