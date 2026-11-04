import { existsSync } from "fs";

import {
    CONFIG_FILE,
    CONFIG_MEMBERS,
    type ConfigLoadError,
    type ConfigValues,
    type LoadedConfig,
} from "@/utils/config/core/constants";
import { readMember, toLoadedConfig } from "@/utils/config/core/members";
import { checkConfigShape, parseConfigText } from "@/utils/config/core/parse";
import { renderConfigTemplate } from "@/utils/config/core/render";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("config");

function failure(config: string, e: unknown): ConfigLoadError {
    return { config, name: e instanceof Error ? e.name : "Error", reason: errorMessage(e) ?? String(e) };
}

// Renders and parses the config file. Never throws: a file that does not load gives no values and one error for
// "file", and a member that fails is left out with an error of its own.
export function loadConfig(): LoadedConfig {
    let config: Record<string, unknown>;
    try {
        if (!existsSync(CONFIG_FILE)) {
            throw new Error(
                `The config file ${CONFIG_FILE} does not exist. Create it, or set FOYER_CONFIG_FILE to its path; ` +
                    "see https://foyer.arpanrec.com/configs/"
            );
        }
        const parsed = parseConfigText(renderConfigTemplate(CONFIG_FILE));
        checkConfigShape(parsed);
        config = parsed;
    } catch (e) {
        const error = failure("file", e);
        logger.error("Could not load the config file %s: %s", CONFIG_FILE, error.reason);
        return toLoadedConfig({}, [error]);
    }

    const values: ConfigValues = {};
    const errors: ConfigLoadError[] = [];
    for (const member of CONFIG_MEMBERS) {
        const value = config[member];
        if (value === undefined) continue;
        try {
            values[member] = readMember(member, value);
        } catch (e) {
            const error = failure(member, e);
            logger.error("Failed to load the %s config: %s", member, error.reason);
            errors.push(error);
        }
    }

    logger.info(
        "Loaded the config file %s: %s%s",
        CONFIG_FILE,
        Object.keys(values).join(", ") || "no members",
        errors.length ? `; ${errors.length} member(s) failed to load` : ""
    );
    return toLoadedConfig(values, errors);
}
