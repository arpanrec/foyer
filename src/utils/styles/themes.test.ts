import { describe, expect, it } from "vitest";

import themes, { getThemeColor, getThemeColors } from "@/utils/styles/themes";

describe("utils/styles/themes", () => {
    it("contains expected theme palettes", () => {
        expect(themes).toHaveProperty("slate");
        expect(themes["slate"]).toEqual(
            expect.objectContaining({
                light: expect.stringMatching(/^#[0-9a-f]{6}$/i),
                dark: expect.stringMatching(/^#[0-9a-f]{6}$/i),
                iconStart: expect.stringMatching(/^#[0-9a-f]{6}$/i),
                iconEnd: expect.stringMatching(/^#[0-9a-f]{6}$/i),
            })
        );
    });
});

describe("getThemeColors", () => {
    it("returns the palette of a known color", () => {
        expect(getThemeColors("zinc")).toBe(themes["zinc"]);
    });

    it.each([undefined, "", "not-a-color"])("falls back to slate for %j", (color) => {
        expect(getThemeColors(color)).toBe(themes["slate"]);
    });
});

describe("getThemeColor", () => {
    it("picks the light or dark background", () => {
        expect(getThemeColor("zinc", "light")).toBe(themes["zinc"]?.light);
        expect(getThemeColor("zinc", "dark")).toBe(themes["zinc"]?.dark);
    });

    it("uses the dark background when the theme is missing, and slate for an unknown color", () => {
        expect(getThemeColor("not-a-color", undefined)).toBe(themes["slate"]?.dark);
    });
});
