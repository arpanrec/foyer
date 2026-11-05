// The record layer the cache store uses when FOYER_DISK_CACHE is not true: a Keyv storage adapter that keeps every
// record in a map, so nothing is written to disk and the cache starts empty after a restart. Values are kept as they
// are, never cloned or serialized, so a value the disk layer cannot write, such as a function, is still kept here.

import { EventEmitter } from "node:events";
import { serialize } from "node:v8";

import type { RecordStore, StoredListing, StoredRecord } from "@/utils/cache/types";

// A record is live until the millisecond it expires, as in the disk layer
function isLive(data: StoredRecord, now: number) {
    return data.expires === undefined || data.expires > now;
}

// The bytes a value takes once serialized, as the disk layer would write it, or 0 for one the serializer cannot hold
function bytesOf(data: StoredRecord) {
    try {
        return serialize(data).length;
    } catch {
        return 0;
    }
}

export class MemoryStore extends EventEmitter implements RecordStore {
    readonly opts = {};
    namespace?: string | undefined;
    private readonly records = new Map<string, StoredRecord>();

    // The live record stored for a key, or undefined. An expired record is removed.
    async get(key: string): Promise<StoredRecord | undefined> {
        const data = this.records.get(key);
        if (data === undefined) return undefined;
        if (!isLive(data, Date.now())) {
            this.records.delete(key);
            return undefined;
        }
        return data;
    }

    async set(key: string, data: StoredRecord): Promise<boolean> {
        this.records.set(key, data);
        return true;
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    async delete(key: string): Promise<boolean> {
        const existed = await this.has(key);
        this.records.delete(key);
        return existed;
    }

    async clear(): Promise<void> {
        this.records.clear();
    }

    // Every live record with its key and serialized size, in the order they were first stored
    async list(): Promise<StoredListing[]> {
        await this.prune();
        return [...this.records].map(([key, data]) => ({ key, data, bytes: bytesOf(data) }));
    }

    // Removes expired records. The map has no size limit.
    async prune(): Promise<void> {
        const now = Date.now();
        for (const [key, data] of this.records) {
            if (!isLive(data, now)) this.records.delete(key);
        }
    }
}
