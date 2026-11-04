// @vitest-environment jsdom

// A browser with no internet must be able to load the dashboard. Every image, icon, background and favicon the config
// names has to reach the browser through Foyer, so this renders the dashboard from a config that points at outside
// hosts in every way it can and fails if anything in the page would make the browser contact one.

import { render, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findExternalReferences } from "@/test-utils/external-references";
import { ColorContext } from "@/utils/contexts/color";
import { SettingsContext } from "@/utils/contexts/settings";
import { TabContext } from "@/utils/contexts/tab";
import { ThemeContext } from "@/utils/contexts/theme";

const { data } = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/script", () => ({ default: () => null }));
// next/image needs the Next runtime; the app's config serves its images unoptimized, as a plain <img>
vi.mock("next/image", () => ({
    default: ({ src, alt, style, className }: ImgHTMLAttributes<HTMLImageElement>) => (
        // oxlint-disable-next-line next/no-img-element -- the stand-in for next/image in a unit test
        <img src={String(src)} alt={alt} style={style} className={className} />
    ),
}));
vi.mock("next-i18next/pages", () => ({
    useTranslation: () => ({ i18n: { language: "en", changeLanguage: vi.fn() }, t: (key: string) => key }),
}));
vi.mock("swr", () => ({
    default: (key: string) => ({ data: typeof key === "string" ? data[key] : undefined }),
    SWRConfig: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/utils/hooks/hydrated", () => ({ default: () => true }));
vi.mock("@/utils/hooks/window-focus", () => ({ default: () => false }));

const origin = window.location.origin;

// every way the config can name an image
const EXTERNAL_ICONS = [
    "https://cdn.example.com/icon.png",
    "http://cdn.example.com/icon.svg",
    "HTTPS://CDN.EXAMPLE.COM/UPPER.png",
    "//cdn.example.com/scheme-relative.png",
    "https://user:password@cdn.example.com/with-credentials.png",
    "https://cdn.example.com/with-query.png?token=SECRET",
];
const ICON_SET_ICONS = ["mdi-home", "mdi-home-#ff00ff", "si-github", "sh-plex", "sh-plex.svg", "plex.png", "plex.webp"];

const services = [
    {
        name: "Group",
        type: "group",
        services: [...EXTERNAL_ICONS, ...ICON_SET_ICONS].map((icon, index) => ({
            name: `Service ${index}`,
            href: `https://service-${index}.example.com`,
            description: "A service",
            icon,
            widgets: [],
        })),
        groups: [],
    },
];

const bookmarks = [
    {
        name: "Bookmarks",
        bookmarks: [...EXTERNAL_ICONS, ...ICON_SET_ICONS].map((icon, index) => ({
            name: `Bookmark ${index}`,
            href: `https://bookmark-${index}.example.com`,
            icon,
            abbr: "BK",
        })),
    },
];

async function renderDashboard(initialSettings: Record<string, unknown>) {
    const { default: Wrapper } = await import("@/app/dashboard");
    const settings = { title: "Foyer", layout: {}, ...initialSettings };

    return render(
        <ThemeContext.Provider value={{ theme: "dark", setTheme: vi.fn() }}>
            <ColorContext.Provider value={{ color: "slate", setColor: vi.fn() }}>
                <SettingsContext.Provider value={{ settings, setSettings: vi.fn() }}>
                    <TabContext.Provider value={{ activeTab: "", setActiveTab: vi.fn(), isPending: false }}>
                        <Wrapper initialSettings={settings} fallback={{}} />
                    </TabContext.Provider>
                </SettingsContext.Provider>
            </ColorContext.Provider>
        </ThemeContext.Provider>
    );
}

describe("a dashboard whose config names outside hosts", () => {
    beforeEach(() => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        data["/api/validate"] = [];
        data["/api/hash"] = null;
        data["/api/services"] = services;
        data["/api/bookmarks"] = bookmarks;
        data["/api/widgets"] = [];
    });

    it("asks the browser for nothing from another host", async () => {
        const { container } = await renderDashboard({
            favicon: "https://cdn.example.com/favicon.ico",
            background: "https://cdn.example.com/background.jpg",
        });

        await waitFor(() => expect(container.querySelectorAll("img").length).toBeGreaterThan(0));

        expect(findExternalReferences([document.head, document.body], origin)).toEqual([]);
    });

    it("renders every icon and bookmark, so the check above looks at something", async () => {
        const { container } = await renderDashboard({});

        await waitFor(() => expect(container.querySelectorAll("img").length).toBeGreaterThan(0));

        const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
        // two lists render each icon: services and bookmarks
        expect(sources.filter((src) => src.startsWith("/api/icon-proxy?url="))).toHaveLength(EXTERNAL_ICONS.length * 2);
        expect(sources.filter((src) => src.startsWith("/api/icons/"))).toHaveLength(
            ICON_SET_ICONS.filter((icon) => !icon.startsWith("mdi-") && !icon.startsWith("si-")).length * 2
        );
        // an icon from a set that is drawn as a mask is a div, and its URL points at Foyer too
        const masks = [...container.querySelectorAll("div")].filter((div) =>
            /url\(/.test(div.getAttribute("style") ?? "")
        );
        expect(masks.length).toBeGreaterThan(0);
        for (const mask of masks) expect(mask.getAttribute("style")).toMatch(/url\(\/api\/icons\//);
    });

    it("sends a background and a favicon through Foyer", async () => {
        await renderDashboard({
            favicon: "https://cdn.example.com/favicon.ico",
            background: { image: "https://cdn.example.com/background.jpg", opacity: 50 },
        });

        await waitFor(() => expect(document.querySelector("#background")).not.toBeNull());

        expect(document.querySelector("#background")?.getAttribute("style")).toContain("url('/api/background')");
        expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toMatch(/^\/api\/icon-proxy\?url=/);
        expect(findExternalReferences([document.head, document.body], origin)).toEqual([]);
    });

    it("leaves a relative background and favicon alone", async () => {
        await renderDashboard({ favicon: "/icons/fav.png", background: "/images/bg.jpg" });

        await waitFor(() => expect(document.querySelector("#background")).not.toBeNull());

        expect(document.querySelector("#background")?.getAttribute("style")).toContain("url('/images/bg.jpg')");
        expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/icons/fav.png");
    });

    it("would notice an outside host if one slipped in", () => {
        document.body.innerHTML = '<img src="https://cdn.example.com/leak.png">';
        expect(findExternalReferences([document.body], origin)).toHaveLength(1);
    });
});
