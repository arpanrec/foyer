import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSettings, getTranslations } = vi.hoisted(() => ({
    getSettings: vi.fn(),
    getTranslations: vi.fn(),
}));

vi.mock("@/utils/config/config", () => ({ getSettings }));
vi.mock("@/utils/config/translations", () => ({ getTranslations }));
vi.mock("@/app/providers", () => ({
    default: ({ language, resources, children }: { language: string; resources: unknown; children: ReactNode }) => (
        <div data-testid="providers" data-language={language} data-resources={JSON.stringify(resources)}>
            {children}
        </div>
    ),
}));

import RootLayout, { dynamic, viewport } from "@/app/layout";

const RESOURCES = { de: { common: { hello: "Hallo" } }, en: { common: { hello: "Hello" } } };

async function renderLayout() {
    return renderToStaticMarkup(await RootLayout({ children: <main>page</main> }));
}

describe("app/layout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSettings.mockReturnValue({ language: "de" });
        getTranslations.mockResolvedValue({ language: "de", resources: RESOURCES });
    });

    it("renders the PWA meta, custom css links and the page inside the providers", async () => {
        const html = await renderLayout();

        expect(html).toContain('<html lang="de">');
        expect(html).toContain('meta name="mobile-web-app-capable" content="yes"');
        expect(html).not.toContain('rel="manifest"');
        expect(html).toContain('link rel="stylesheet" href="/api/config/custom.css"');
        expect(html).toContain('data-language="de"');
        expect(html).toContain("<main>page</main>");
        expect(html).not.toContain("<base");
    });

    it("loads translations for the configured language", async () => {
        await renderLayout();

        expect(getTranslations).toHaveBeenCalledWith("de");
    });

    it("sets the base href from settings", async () => {
        getSettings.mockReturnValue({ base: "/base/" });

        expect(await renderLayout()).toContain('<base href="/base/"/>');
    });

    it("falls back to the default language when settings cannot be read", async () => {
        getSettings.mockImplementation(() => {
            throw new Error("bad yaml");
        });
        getTranslations.mockResolvedValue({ language: "en", resources: {} });

        expect(await renderLayout()).toContain('<html lang="en">');
        expect(getTranslations).toHaveBeenCalledWith(undefined);
    });

    it("renders on every request and keeps the viewport fixed", () => {
        expect(dynamic).toBe("force-dynamic");
        expect(viewport).toEqual({
            width: "device-width",
            initialScale: 1,
            minimumScale: 1,
            maximumScale: 1,
            userScalable: false,
        });
    });
});
