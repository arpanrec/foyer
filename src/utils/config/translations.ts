import { readFile } from "fs/promises";
import { join } from "path";

import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

import nextI18nextConfig from "../../../next-i18next.config";

const logger = createLogger("translations");

const NAMESPACE = "common";
const { defaultLocale } = nextI18nextConfig.i18n;

// Normalize language codes so older config values like zh-CN still point to the locale folders in public/locales
const LANGUAGE_ALIASES: Record<string, string> = {
    "zh-cn": "zh-Hans",
};

type Namespace = Record<string, unknown>;

const loaded = new Map<string, Promise<Namespace | null>>();

export function normalizeLanguage(language?: string | null) {
    if (!language) return defaultLocale;
    return LANGUAGE_ALIASES[language.toLowerCase()] || language;
}

async function readNamespace(language: string) {
    // The language comes from the settings config, keep it to a plain folder name
    if (!/^[\w-]+$/.test(language)) {
        warnOnce(logger, 'Ignoring settings.language "%s", which is not a locale name; using English', language);
        return null;
    }
    if (!loaded.has(language)) {
        // The foyer command sets FOYER_APP_DIR, since it runs the server outside the app folder
        const appDir = getEnv("APP_DIR") || process.cwd();
        const file = join(appDir, "public", "locales", language, `${NAMESPACE}.json`);
        loaded.set(
            language,
            readFile(file, "utf8")
                .then((contents): Namespace => JSON.parse(contents))
                .catch((e: unknown) => {
                    logger.warn('No translations for language "%s" (%s); using English', language, errorMessage(e));
                    return null;
                })
        );
    }
    return loaded.get(language) ?? null;
}

// Loads the configured language and the default one it falls back to, for the client i18n provider
export async function getTranslations(settingsLanguage?: string) {
    const requested = normalizeLanguage(settingsLanguage);
    const resources: Record<string, { [NAMESPACE]: Namespace }> = {};
    for (const language of new Set([requested, defaultLocale])) {
        const namespace = await readNamespace(language);
        if (namespace) resources[language] = { [NAMESPACE]: namespace };
    }
    return { language: resources[requested] ? requested : defaultLocale, resources };
}
