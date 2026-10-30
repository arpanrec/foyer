import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));

vi.mock("fs/promises", () => ({ readFile }));

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
            resources: { de: { common: LOCALES.de }, en: { common: LOCALES.en } },
        });
        expect(readFile).toHaveBeenCalledWith(
            expect.stringMatching(/public[\\/]locales[\\/]de[\\/]common\.json$/),
            "utf8"
        );
    });

    it("loads only English when no language is configured", async () => {
        const { getTranslations } = await loadTranslations();

        expect(await getTranslations()).toEqual({ language: "en", resources: { en: { common: LOCALES.en } } });
    });

    it("normalizes legacy language codes", async () => {
        const { getTranslations } = await loadTranslations();

        expect((await getTranslations("zh-CN")).language).toBe("zh-Hans");
    });

    it("falls back to English when the language has no locale folder", async () => {
        const { getTranslations } = await loadTranslations();

        expect(await getTranslations("xx")).toEqual({ language: "en", resources: { en: { common: LOCALES.en } } });
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
});
