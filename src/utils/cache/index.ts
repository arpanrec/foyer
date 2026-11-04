// The cache every caller imports. To change where the cache lives, change the import below to another store with the
// same CacheStore interface: "@/utils/cache/memory", "@/utils/cache/disk" or "@/utils/cache/sqlite".

export { default } from "@/utils/cache/memory";
export type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
