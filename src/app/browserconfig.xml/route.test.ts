import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import themes from "@/utils/styles/themes";

const { getSettings } = vi.hoisted(() => ({
    getSettings: vi.fn(),
}));

vi.mock("@/utils/config/config", () => ({
    getSettings,
}));

import { GET } from "@/app/browserconfig.xml/route";

const request = () => new NextRequest("http://localhost:3000/");

describe("app/browserconfig.xml", () => {
    it("writes a browserconfig xml response using the selected theme color", async () => {
        getSettings.mockReturnValueOnce({ color: "slate", theme: "dark" });
        const res = await GET(request());

        expect(res.headers.get("Content-Type")).toBe("text/xml");

        const xml = await res.text();
        expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
        expect(xml).toContain('<square150x150logo src="/mstile-150x150.png?v=2"/>');
        expect(xml).toContain(`<TileColor>${themes.slate.dark}</TileColor>`);
    });
});
