import { join } from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));

vi.mock("fs/promises", () => ({ readFile }));

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

const LOCALES: Record<string, Record<string, string>> = {
    en: { hello: "Hello" },
    de: { hello: "Hallo" },
    "zh-Hans": { hello: "你好" },
};

async function loadTranslations() {
    vi.resetModules();
    return import("@/utils/config/translations");
}

describe("normalizeLanguage", () => {
    it("maps legacy codes to locale folders and defaults to English", async () => {
        const { normalizeLanguage } = await loadTranslations();

        expect(normalizeLanguage("zh-CN")).toBe("zh-Hans");
        expect(normalizeLanguage("de")).toBe("de");
        expect(normalizeLanguage(undefined)).toBe("en");
    });
});

describe("getTranslations", () => {
    beforeEach(() => {
        logger.warn.mockClear();
        readFile.mockReset();
        readFile.mockImplementation(async (file) => {
            const language = file.split(/[\\/]/).at(-2);
            if (!LOCALES[language]) throw Object.assign(new Error("missing"), { code: "ENOENT" });
            return JSON.stringify(LOCALES[language]);
        });
    });

    it("loads the configured language with English as its fallback", async () => {
        const { getTranslations } = await loadTranslations();

        expect(await getTranslations("de")).toEqual({
            language: "de",
            resources: { de: { common: LOCALES["de"] }, en: { common: LOCALES["en"] } },
        });
        expect(readFile).toHaveBeenCalledWith(
            expect.stringMatching(/public[\\/]locales[\\/]de[\\/]common\.json$/),
            "utf8"
        );
    });

    it("loads only English when no language is configured", async () => {
        const { getTranslations } = await loadTranslations();

        expect(await getTranslations()).toEqual({ language: "en", resources: { en: { common: LOCALES["en"] } } });
    });

    it("normalizes legacy language codes", async () => {
        const { getTranslations } = await loadTranslations();

        expect((await getTranslations("zh-CN")).language).toBe("zh-Hans");
    });

    it("falls back to English when the language has no locale folder", async () => {
        const { getTranslations } = await loadTranslations();

        expect(await getTranslations("xx")).toEqual({ language: "en", resources: { en: { common: LOCALES["en"] } } });
    });

    it("never reads outside the locales folder", async () => {
        const { getTranslations } = await loadTranslations();

        expect((await getTranslations("../../config")).language).toBe("en");
        expect(readFile).toHaveBeenCalledTimes(1);
    });

    it("reads each locale file once", async () => {
        const { getTranslations } = await loadTranslations();

        await getTranslations("de");
        await getTranslations("de");

        expect(readFile).toHaveBeenCalledTimes(2);
    });

    it("reads the locales from the current folder", async () => {
        const { getTranslations } = await loadTranslations();

        await getTranslations("de");

        expect(readFile).toHaveBeenCalledWith(join(process.cwd(), "public", "locales", "de", "common.json"), "utf8");
    });

    it("reads the locales from FOYER_APP_DIR when the foyer command sets it", async () => {
        vi.stubEnv("FOYER_APP_DIR", "/opt/foyer");
        try {
            const { getTranslations } = await loadTranslations();

            await getTranslations("de");

            expect(readFile).toHaveBeenCalledWith(join("/opt/foyer", "public", "locales", "de", "common.json"), "utf8");
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it("warns when the language has no locale file", async () => {
        const { getTranslations } = await loadTranslations();

        await getTranslations("xx");

        expect(logger.warn).toHaveBeenCalledWith(
            'No translations for language "%s" (%s); using English',
            "xx",
            "missing"
        );
    });

    it("warns once about a language that is not a locale name", async () => {
        const { getTranslations } = await loadTranslations();

        await getTranslations("../../config");
        await getTranslations("../../config");

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'Ignoring settings.language "%s", which is not a locale name; using English',
            "../../config"
        );
    });
});
