import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

import cache from "memory-cache";

import type { Settings } from "@/types/service";
import { loadYaml } from "@/utils/config/yaml";
import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";

type SettingsLayoutItem = Record<string, Record<string, unknown> | undefined>;

const cacheKey = "foyerEnvironmentVariables";
const envPrefix = "FOYER_";
const varType = "VAR_";
const fileType = "FILE_";

export const CONF_DIR = getEnv("CONFIG_DIR") || join(/* turbopackIgnore: true */ process.cwd(), "config");

export default function checkAndCopyConfig(config: string) {
    // Ensure config directory exists
    if (!existsSync(CONF_DIR)) {
        try {
            mkdirSync(CONF_DIR, { recursive: true });
        } catch (e) {
            console.warn(`Could not create config directory ${CONF_DIR}: ${errorMessage(e)}`);
            return false;
        }
    }

    const configYaml = join(CONF_DIR, config);

    // If the config file doesn't exist, try to copy the skeleton
    if (!existsSync(configYaml)) {
        const configSkeleton = join(process.cwd(), "src", "skeleton", config);
        try {
            copyFileSync(configSkeleton, configYaml);
            console.info("%s was copied to the config folder", config);
        } catch (err) {
            console.error("❌ Failed to initialize required config: %s", configYaml);
            console.error("Reason: %s", errorMessage(err));
            console.error("Hint: Make /app/config writable or manually place the config file.");
            process.exit(1);
        }

        return true;
    }

    try {
        loadYaml(readFileSync(configYaml, "utf8"));
        return true;
    } catch (e) {
        return { ...(e as Record<string, unknown>), config };
    }
}

type EnvironmentVar = [name: string, value: string];

function getCachedEnvironmentVars(): EnvironmentVar[] {
    let cachedVars: EnvironmentVar[] | null = cache.get(cacheKey);
    if (!cachedVars) {
        cachedVars = Object.entries(process.env).flatMap(([key, value]): EnvironmentVar[] => {
            if (!key.startsWith(`${envPrefix}${varType}`) && !key.startsWith(`${envPrefix}${fileType}`)) return [];
            return [[key.slice(envPrefix.length), value as string]];
        });
        cache.put(cacheKey, cachedVars);
    }
    return cachedVars;
}

export function substituteEnvironmentVars(str: string) {
    let result = str;
    if (result.includes("{{")) {
        // crude check if we have vars to replace
        const cachedVars = getCachedEnvironmentVars();
        cachedVars.forEach(([name, value]) => {
            const placeholder = `{{${envPrefix}${name}}}`;
            if (!result.includes(placeholder)) return;

            // files are read only when their placeholder is used
            const replacement = name.startsWith(fileType) ? readFileSync(value, "utf8") : value;
            result = result.replaceAll(placeholder, () => replacement);
        });
    }
    return result;
}

// instanceName is read from settings.yaml by the Docker and Kubernetes discovery
export type AppSettings = Settings & { instanceName?: string };

export function getSettings(): AppSettings {
    checkAndCopyConfig("settings.yaml");

    const settingsYaml = join(CONF_DIR, "settings.yaml");
    const rawFileContents = readFileSync(settingsYaml, "utf8");
    const fileContents = substituteEnvironmentVars(rawFileContents);
    const loaded = loadYaml(fileContents) ?? {};
    // layout may still be the old list form, which is converted below
    const initialSettings = loaded as Omit<Settings, "layout"> & { layout?: Settings["layout"] | SettingsLayoutItem[] };

    if (initialSettings.layout) {
        // support yaml list but old spec was object so convert to that
        // see https://github.com/gethomepage/homepage/issues/1546
        if (Array.isArray(initialSettings.layout)) {
            const layoutItems = initialSettings.layout;
            const layout: NonNullable<Settings["layout"]> = {};
            initialSettings.layout = layout;
            layoutItems.forEach((i) => {
                const name = Object.keys(i)[0];
                layout[name] = i[name];
            });
        }
    }
    return initialSettings as AppSettings;
}
