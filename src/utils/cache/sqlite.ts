// SQLite cache store, built on Node's node:sqlite. It has the same default export as memory.ts and disk.ts, a
// CacheStore, so a caller switches stores by changing one import. All entries live in one database file, one row per
// type and key, with the value written by the V8 serializer so buffers, dates and maps survive. A database that cannot
// be opened is replaced by an in-memory one with one warning.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deserialize, serialize } from "node:v8";

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

const DB_FILE = "/tmp/foyer/cache.sqlite";
const UNTYPED = "untyped";

type Row = { type: string; key: string; expires: number | null; value: Uint8Array };

function recordKey(key: string, type: CacheArtifactType | undefined) {
    return `${type ?? ""}\u0000${key}`;
}

export class SqliteCacheStore implements CacheStore {
    private readonly db: DatabaseSync;
    private readonly loading = new Map<string, Promise<unknown>>();
    private readonly policies = new Map<CacheArtifactType, CachePolicy>();

    constructor(file: string = DB_FILE) {
        this.db = this.open(file);
        this.db.exec(
            `CREATE TABLE IF NOT EXISTS cache (
                type TEXT NOT NULL,
                key TEXT NOT NULL,
                expires INTEGER,
                value BLOB NOT NULL,
                PRIMARY KEY (type, key)
            )`
        );
        this.sweep();
    }

    private open(file: string): DatabaseSync {
        try {
            if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
            return new DatabaseSync(file);
        } catch (error) {
            warnOnce(
                logger,
                "The cache database %s cannot be opened, so entries are not kept across restarts: %s",
                file,
                errorMessage(error)
            );
            return new DatabaseSync(":memory:");
        }
    }

    // Removes the rows that expired
    private sweep() {
        this.db.prepare("DELETE FROM cache WHERE expires IS NOT NULL AND expires <= ?").run(Date.now());
    }

    private read(type: CacheArtifactType | undefined, key: string): unknown {
        const row = this.db
            .prepare("SELECT expires, value FROM cache WHERE type = ? AND key = ?")
            .get(type ?? "", key) as Pick<Row, "expires" | "value"> | undefined;
        if (!row) return undefined;
        if (row.expires !== null && row.expires <= Date.now()) {
            this.db.prepare("DELETE FROM cache WHERE type = ? AND key = ?").run(type ?? "", key);
            return undefined;
        }
        try {
            return deserialize(row.value);
        } catch (error) {
            logger.debug("Cache row of type %s cannot be decoded: %s", type ?? UNTYPED, errorMessage(error));
            this.db.prepare("DELETE FROM cache WHERE type = ? AND key = ?").run(type ?? "", key);
            return undefined;
        }
    }

    // A value the serializer cannot hold, such as a function, is not kept.
    private write(type: CacheArtifactType | undefined, key: string, value: unknown, ttlMs: number | undefined) {
        if (ttlMs !== undefined && (typeof ttlMs !== "number" || Number.isNaN(ttlMs) || ttlMs <= 0)) {
            throw new Error("Cache timeout must be a positive number");
        }
        let data: Buffer;
        try {
            data = serialize(value);
        } catch (error) {
            logger.debug("Cache entry of type %s cannot be written: %s", type ?? UNTYPED, errorMessage(error));
            return;
        }
        this.db
            .prepare("INSERT OR REPLACE INTO cache (type, key, expires, value) VALUES (?, ?, ?, ?)")
            .run(type ?? "", key, ttlMs === undefined ? null : Date.now() + ttlMs, data);
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
            const found = this.read(type, key) as T | undefined;
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
            this.write(type, key, value, ttl);
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
        this.loading.delete(recordKey(key, type));
        const live = this.read(type, key) !== undefined;
        this.db.prepare("DELETE FROM cache WHERE type = ? AND key = ?").run(type ?? "", key);
        return live;
    }

    async clear(type?: CacheArtifactType): Promise<void> {
        for (const id of this.loading.keys()) {
            if (type === undefined || id.startsWith(`${type}\u0000`)) this.loading.delete(id);
        }
        if (type === undefined) this.db.exec("DELETE FROM cache");
        else this.db.prepare("DELETE FROM cache WHERE type = ?").run(type);
    }

    // The live rows of one type, or of every type
    private live(type?: CacheArtifactType): Row[] {
        this.sweep();
        const rows =
            type === undefined
                ? this.db.prepare("SELECT type, key, expires, value FROM cache").all()
                : this.db.prepare("SELECT type, key, expires, value FROM cache WHERE type = ?").all(type);
        return rows as Row[];
    }

    async keys(type?: CacheArtifactType): Promise<string[]> {
        return this.live(type).map((row) => row.key);
    }

    async entries(): Promise<CacheEntryInfo[]> {
        const now = Date.now();
        return this.live().map((row) => ({
            key: row.key,
            type: row.type === "" ? undefined : (row.type as CacheArtifactType),
            expiresInMs: row.expires === null ? undefined : Math.max(0, row.expires - now),
            value: deserialize(row.value),
        }));
    }

    async size(type?: CacheArtifactType): Promise<number> {
        return this.live(type).length;
    }

    // Only ttlMs is applied; maxEntries is ignored because the database has no entry limit
    async setPolicy(type: CacheArtifactType, policy: CachePolicy): Promise<void> {
        this.policies.set(type, policy);
    }

    async policy(type: CacheArtifactType): Promise<CachePolicy | undefined> {
        return this.policies.get(type);
    }

    async stats(type?: CacheArtifactType): Promise<CacheStats> {
        const rows = this.live(type);
        return {
            hits: 0,
            misses: 0,
            entries: rows.length,
            bytes: rows.reduce((sum, row) => sum + row.value.byteLength, 0),
        };
    }
}

// Next.js bundles each route separately, so a module-level instance would be one cache per route.
const globalForCache = globalThis as typeof globalThis & { __foyerSqliteCache?: SqliteCacheStore };
const cache = (globalForCache.__foyerSqliteCache ??= new SqliteCacheStore());

export default cache;
