import { beforeEach, describe, expect, it, vi } from "vitest";

describe("utils/config/settings", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("getSettings reads the loaded settings and converts a layout list to an object", async () => {
        const { setConfigStore, clearConfigStore } = await import("@/utils/config/store");
        await setConfigStore({ settings: { title: "MyTitle", layout: [{ GroupA: { style: "row" } }] } });

        try {
            const mod = await import("@/utils/config/settings");
            const settings = await mod.getSettings();
            expect(settings.title).toBe("MyTitle");
            expect(settings.layout).toEqual({ GroupA: { style: "row" } });
        } finally {
            await clearConfigStore();
        }
    });

    it("getSettings returns an empty object when the settings did not load", async () => {
        const { setConfigStore, clearConfigStore } = await import("@/utils/config/store");
        await setConfigStore({});

        try {
            const mod = await import("@/utils/config/settings");
            expect(await mod.getSettings()).toEqual({});
        } finally {
            await clearConfigStore();
        }
    });
});
