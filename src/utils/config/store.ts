import cache from "@/utils/cache";
import {
    CUSTOM_FILE_MEMBERS,
    loadConfig,
    toLoadedConfig,
    type ConfigLoadError,
    type ConfigName,
    type ConfigValues,
    type CustomFile,
    type LoadedConfig,
} from "@/utils/config/core";

// The loaded config, kept in the cache under one key once it loads without errors. The first clean load stores it, a
// clean reload replaces it, and nothing else changes it. With a disk or SQLite cache it outlives a restart until the
// next reload.
const CACHE_KEY = "foyerConfig";

// next build prerenders a few pages, with no config file to read
const EMPTY = toLoadedConfig({});

// The load in progress, so concurrent reads of a config that is not stored share one load
let loading: Promise<LoadedConfig> | undefined;

async function loadAndKeep(): Promise<LoadedConfig> {
    const loaded = loadConfig();
    if (loaded.errors.length === 0) await storeConfig(loaded);
    return loaded;
}

async function currentStore(): Promise<LoadedConfig> {
    if (process.env["NEXT_PHASE"] === "phase-production-build") return EMPTY;
    // A loader that returns undefined only reads the cache
    const stored = await cache.getOrFetch<LoadedConfig>(CACHE_KEY, async () => undefined, { label: "config" });
    if (stored) return stored;
    // loadConfig never throws. A config with errors is handed to its readers but not stored, so the next read loads
    // the file again and a fixed file shows up without a reload or restart.
    loading ??= loadAndKeep().finally(() => {
        loading = undefined;
    });
    return loading;
}

async function storeConfig(loaded: LoadedConfig) {
    await cache.getOrFetch(CACHE_KEY, async () => loaded, { refresh: true, label: "config" });
}

export async function setConfigStore(values: ConfigValues, errors: ConfigLoadError[] = []) {
    await storeConfig(toLoadedConfig(values, errors));
}

export async function clearConfigStore() {
    await cache.del(CACHE_KEY);
}

// Loads the config file again. The stored config is replaced only when the whole file loads cleanly; otherwise this
// throws with every reason and the stored config stays as it was.
export async function reloadConfigs() {
    const next = loadConfig();
    if (next.errors.length > 0) {
        throw new Error(next.errors.map(({ config, reason }) => `${config}: ${reason}`).join("; "));
    }
    await storeConfig(next);
}

// A copy of the loaded config, so callers may change what they get
export async function getConfig(name: ConfigName): Promise<unknown> {
    const value = (await currentStore()).values[name];
    return value === undefined ? undefined : structuredClone(value);
}

// The source of custom.css or custom.js, empty when the config has none
export async function getCustomFile(file: CustomFile): Promise<string> {
    const value = (await currentStore()).values[CUSTOM_FILE_MEMBERS[file]];
    return typeof value === "string" ? value : "";
}

export async function getConfigErrors(): Promise<ConfigLoadError[]> {
    return (await currentStore()).errors;
}

export async function getConfigHash(): Promise<string> {
    return (await currentStore()).hash;
}
