// The cache every caller imports: one shared store, kept in memory, or on disk with FOYER_DISK_CACHE=true so entries
// outlive a restart.

export { default } from "@/utils/cache/disk";
export type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
