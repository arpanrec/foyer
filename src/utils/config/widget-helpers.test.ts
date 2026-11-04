import { beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({
    store: {
        getConfig: vi.fn(),
    },
}));

vi.mock("@/utils/config/store", () => ({ getConfig: store.getConfig }));

import { cleanWidgetGroups, getPrivateWidgetOptions, widgetsFromConfig } from "@/utils/config/widget-helpers";

describe("utils/config/widget-helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("widgetsFromConfig maps the widgets config into a typed widgets array with indices", async () => {
        store.getConfig.mockReturnValueOnce([{ search: { provider: "google", url: "http://x", key: "k" } }]);

        const widgets = await widgetsFromConfig();
        expect(widgets).toEqual([
            {
                type: "search",
                options: { index: 0, provider: "google", url: "http://x", key: "k" },
            },
        ]);
    });

    it("widgetsFromConfig leaves out an empty widget object and keeps the config positions as indices", async () => {
        store.getConfig.mockReturnValueOnce([{}, { datetime: { text_size: "xl" } }]);

        expect(await widgetsFromConfig()).toEqual([{ type: "datetime", options: { index: 1, text_size: "xl" } }]);
    });

    it("cleanWidgetGroups removes private options and hides url except for search/glances", async () => {
        const cleaned = await cleanWidgetGroups([
            { type: "search", options: { index: 0, url: "http://x", username: "u", password: "p" } },
            { type: "something", options: { index: 1, url: "http://y", key: "k", foo: 1 } },
            { type: "glances", options: { index: 2, url: "http://z", apiKey: "k", bar: 2 } },
        ]);

        expect(cleaned[0]!.options.url).toBe("http://x");
        expect(cleaned[0]!.options.username).toBeUndefined();

        expect(cleaned[1]!.options.url).toBeUndefined();
        expect(cleaned[1]!.options.key).toBeUndefined();
        expect(cleaned[1]!.options["foo"]).toBe(1);

        expect(cleaned[2]!.options.url).toBe("http://z");
        expect(cleaned[2]!.options.apiKey).toBeUndefined();
    });

    it("cleanWidgetGroups removes customapi request options", async () => {
        const cleaned = await cleanWidgetGroups([
            {
                type: "customapi",
                options: {
                    index: 0,
                    url: "http://x",
                    headers: { a: "b" },
                    requestBody: "body",
                    method: "POST",
                    icon: "mdi-x",
                },
            },
        ]);

        expect(cleaned[0]!.options).toEqual({ index: 0, icon: "mdi-x" });
    });

    it("getPrivateWidgetOptions returns private options for a specific widget", async () => {
        store.getConfig.mockReturnValueOnce([{ search: { url: "http://x", username: "u", password: "p", key: "k" } }]);

        const options = await getPrivateWidgetOptions("search", 0);
        expect(options).toEqual(
            expect.objectContaining({
                index: 0,
                url: "http://x",
                username: "u",
                password: "p",
                key: "k",
            })
        );

        // And the full list when no args are provided
        store.getConfig.mockReturnValueOnce([{ search: { url: "http://x", username: "u" } }]);
        const all = await getPrivateWidgetOptions();
        expect(Array.isArray(all)).toBe(true);
        expect(all[0]!.options.url).toBe("http://x");
    });
});
