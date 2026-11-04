import { createHash } from "crypto";

import type { ConfigLoadError, ConfigMember, ConfigValues, LoadedConfig } from "@/utils/config/core/constants";
import { isRecord } from "@/utils/config/types";
import createLogger from "@/utils/logger";
import themes from "@/utils/styles/themes";

const logger = createLogger("config");

function describe(value: unknown) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "an array";
    return `a ${typeof value}`;
}

// A member's value as the store keeps it. Parsed JSON is always plain data, so only the custom CSS and JS members,
// which must be strings, are checked.
export function readMember(member: ConfigMember, value: unknown): unknown {
    if ((member === "customCss" || member === "customJs") && typeof value !== "string") {
        throw new Error(`${member} must be a string, not ${describe(value)}`);
    }
    return value;
}

// settings.layout may be a list of single-key objects; readers get the object form
function normalizeSettings(settings: unknown) {
    if (!isRecord(settings)) return settings;

    const color = settings["color"];
    if (typeof color === "string" && color !== "" && !(color in themes)) {
        logger.warn(
            'Unknown settings.color "%s", using slate. Known colors: %s',
            color,
            Object.keys(themes).join(", ")
        );
    }

    if (!Array.isArray(settings["layout"])) return settings;

    const layout: Record<string, unknown> = {};
    for (const item of settings["layout"] as unknown[]) {
        if (!isRecord(item)) {
            logger.warn("Skipping a settings.layout entry that is not an object: %j", item);
            continue;
        }
        const name = Object.keys(item)[0];
        if (name !== undefined) layout[name] = item[name];
    }
    return { ...settings, layout };
}

// Two servers that load the same config get the same hash, so the browser can tell when the config changed
function hashValues(values: ConfigValues) {
    return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

// The values as readers get them, with their errors and hash
export function toLoadedConfig(values: ConfigValues, errors: ConfigLoadError[] = []): LoadedConfig {
    const stored = "settings" in values ? { ...values, settings: normalizeSettings(values.settings) } : values;
    return { values: stored, errors, hash: hashValues(stored) };
}
