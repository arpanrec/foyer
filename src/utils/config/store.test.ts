import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoadedConfig } from "@/utils/config/core";

const { loadConfig } = vi.hoisted(() => ({ loadConfig: vi.fn<() => LoadedConfig>() }));

vi.mock("@/utils/config/core", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/utils/config/core")>()),
    loadConfig,
}));

import cache from "@/utils/cache";
import { toLoadedConfig } from "@/utils/config/core";
import {
    clearConfigStore,
    getConfig,
    getConfigErrors,
    getConfigHash,
    getCustomFile,
    reloadConfigs,
    setConfigStore,
} from "@/utils/config/store";

const broken = { config: "file", name: "SyntaxError", reason: "CommaExpected at line 2, column 1" };

describe("utils/config/store", () => {
    const originalPhase = process.env["NEXT_PHASE"];

    beforeEach(async () => {
        await clearConfigStore();
        vi.clearAllMocks();
        loadConfig.mockReturnValue(toLoadedConfig({ settings: { title: "one" }, customCss: "body{}" }));
    });

    afterEach(async () => {
        await clearConfigStore();
        if (originalPhase === undefined) delete process.env["NEXT_PHASE"];
        else process.env["NEXT_PHASE"] = originalPhase;
    });

    it("loads the config on the first read and keeps it", async () => {
        expect(loadConfig).not.toHaveBeenCalled();

        expect(await getConfig("settings")).toEqual({ title: "one" });
        expect(await getConfig("services")).toBeUndefined();
        expect(await getCustomFile("custom.css")).toBe("body{}");
        expect(await getCustomFile("custom.js")).toBe("");
        expect(await getConfigErrors()).toEqual([]);
        expect(await getConfigHash()).toMatch(/^[0-9a-f]{64}$/);

        expect(loadConfig).toHaveBeenCalledOnce();
    });

    it("keeps the config as a regular cache entry and shares one load between concurrent reads", async () => {
        await Promise.all([getConfig("settings"), getConfigErrors(), getConfigHash()]);

        expect(loadConfig).toHaveBeenCalledOnce();
        expect(await cache.keys()).toContain("foyerConfig");
    });

    it("loads the config again once the cache entry is gone", async () => {
        await getConfig("settings");
        await cache.clear();
        await getConfig("settings");

        expect(loadConfig).toHaveBeenCalledTimes(2);
    });

    it("hands out a copy each reader may change", async () => {
        ((await getConfig("settings")) as { title: string }).title = "changed";

        expect(await getConfig("settings")).toEqual({ title: "one" });
    });

    it("hands out a config that failed to load without storing it, so the next read loads the file again", async () => {
        loadConfig.mockReturnValue(toLoadedConfig({}, [broken]));

        expect(await getConfigErrors()).toEqual([broken]);
        expect(await getConfig("settings")).toBeUndefined();
        expect(loadConfig).toHaveBeenCalledTimes(2);
        expect(await cache.keys()).not.toContain("foyerConfig");

        loadConfig.mockReturnValue(toLoadedConfig({ settings: { title: "fixed" } }));

        expect(await getConfigErrors()).toEqual([]);
        expect(await getConfig("settings")).toEqual({ title: "fixed" });
        expect(loadConfig).toHaveBeenCalledTimes(3);
        expect(await cache.keys()).toContain("foyerConfig");
    });

    it("shares one load between concurrent reads of a config that fails to load", async () => {
        loadConfig.mockReturnValue(toLoadedConfig({}, [broken]));

        const errors = await Promise.all([getConfigErrors(), getConfigErrors(), getConfigHash()]);

        expect(loadConfig).toHaveBeenCalledOnce();
        expect(errors[0]).toEqual([broken]);
        expect(errors[1]).toEqual([broken]);
    });

    it("does not store a config whose members failed, but hands out the members that loaded", async () => {
        const memberError = { config: "customCss", name: "Error", reason: "customCss must be a string, not a number" };
        loadConfig.mockReturnValue(toLoadedConfig({ settings: { title: "one" } }, [memberError]));

        expect(await getConfig("settings")).toEqual({ title: "one" });
        expect(await getConfigErrors()).toEqual([memberError]);
        expect(await cache.keys()).not.toContain("foyerConfig");
    });

    it("replaces the config on a clean reload", async () => {
        const before = await getConfigHash();
        loadConfig.mockReturnValue(toLoadedConfig({ settings: { title: "two" } }));

        await reloadConfigs();

        expect(await getConfig("settings")).toEqual({ title: "two" });
        expect(await getConfigHash()).not.toBe(before);
    });

    it("keeps the config and throws every reason when a reload finds errors", async () => {
        const before = await getConfigHash();
        loadConfig.mockReturnValue(
            toLoadedConfig({ settings: { title: "two" } }, [
                broken,
                { config: "customCss", name: "Error", reason: "customCss must be a string, not a number" },
            ])
        );

        await expect(reloadConfigs()).rejects.toThrow(
            "file: CommaExpected at line 2, column 1; customCss: customCss must be a string, not a number"
        );
        expect(await getConfig("settings")).toEqual({ title: "one" });
        expect(await getConfigHash()).toBe(before);
    });

    it("loads nothing while next build prerenders pages", async () => {
        process.env["NEXT_PHASE"] = "phase-production-build";

        expect(await getConfig("settings")).toBeUndefined();
        expect(await getConfigErrors()).toEqual([]);
        expect(loadConfig).not.toHaveBeenCalled();
    });

    it("stores values set directly, as tests do", async () => {
        await setConfigStore({ settings: { layout: [{ A: {} }] } });

        expect(await getConfig("settings")).toEqual({ layout: { A: {} } });
        expect(loadConfig).not.toHaveBeenCalled();
    });
});
