// The config loader. Everything outside this folder reads the config through @/utils/config/store, which calls
// loadConfig and toLoadedConfig from here; replacing the loader means replacing this folder behind these exports.

export {
    CONFIG_FILE,
    CONFIG_MEMBERS,
    CONFIG_NAMES,
    CUSTOM_FILE_MEMBERS,
    CUSTOM_FILES,
    DEFAULT_CONFIG_FILE,
    type ConfigLoadError,
    type ConfigMember,
    type ConfigName,
    type ConfigValues,
    type CustomFile,
    type CustomMember,
    type LoadedConfig,
} from "@/utils/config/core/constants";
export { loadConfig } from "@/utils/config/core/load";
export { toLoadedConfig } from "@/utils/config/core/members";
