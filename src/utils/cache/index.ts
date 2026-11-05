// The cache every caller imports: the disk store, so entries outlive a restart.

export { default } from "@/utils/cache/disk";
export type {
    CacheArtifactType,
    CacheEntryInfo,
    CacheLoadOptions,
    CachePolicy,
    CacheStats,
    CacheStore,
} from "@/utils/cache/types";
