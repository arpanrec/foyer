// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuickLaunchEntry } from "@/components/quicklaunch";
import type { InfoWidgetStyle } from "@/components/widgets/widget/types";
import type { Settings, WidgetConfig } from "@/types/service";
import { ColorContext } from "@/utils/contexts/color";
import { SettingsContext } from "@/utils/contexts/settings";
import { TabContext } from "@/utils/contexts/tab";
import { ThemeContext } from "@/utils/contexts/theme";

const { state, i18n, useSWR, useWindowFocus } = vi.hoisted(() => {
    type QuickLaunchMockProps = {
        isOpen: boolean;
        servicesAndBookmarks?: QuickLaunchEntry[];
        searchString: string;
    };
    type WidgetCall = {
        widget: WidgetConfig;
        style: InfoWidgetStyle;
    };
    const state: {
        validateData: unknown;
        hashData: { hash?: string } | null;
        hashConfig: { onSuccess: (data: { hash?: string } | null) => void } | null;
        mutateHash: ReturnType<typeof vi.fn>;
        servicesData: unknown[];
        bookmarksData: unknown[];
        widgetsData: unknown[];
        quickLaunchProps: QuickLaunchMockProps | null;
        widgetCalls: WidgetCall[];
        windowFocused: boolean;
    } = {
        validateData: [],
        hashData: null,
        hashConfig: null,
        mutateHash: vi.fn(),
        servicesData: [],
        bookmarksData: [],
        widgetsData: [],
        quickLaunchProps: null,
        widgetCalls: [],
        windowFocused: false,
    };

    const i18n = { language: "en", changeLanguage: vi.fn() };

    const useSWR = vi.fn((key, config) => {
        if (key === "/api/validate") return { data: state.validateData };
        if (key === "/api/hash") {
            state.hashConfig = config;
            return { data: state.hashData, mutate: state.mutateHash };
        }
        if (key === "/api/services") return { data: state.servicesData };
        if (key === "/api/bookmarks") return { data: state.bookmarksData };
        if (key === "/api/widgets") return { data: state.widgetsData };
        return { data: undefined };
    });

    const useWindowFocus = vi.fn(() => state.windowFocused);

    return {
        state,
        i18n,
        useSWR,
        useWindowFocus,
    };
});

vi.mock("next/dynamic", () => ({
    default: () => () => null,
}));
vi.mock("next/script", () => ({ default: () => null }));

vi.mock("next-i18next/pages", () => ({
    useTranslation: () => ({
        i18n,
        t: (k: string) => k,
    }),
}));

vi.mock("swr", () => ({
    default: useSWR,
    SWRConfig: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/utils/hooks/window-focus", () => ({
    default: useWindowFocus,
}));

vi.mock("@/components/bookmarks/group", () => ({
    default: ({ bookmarks }: { bookmarks?: { name?: string } }) => (
        <div data-testid="bookmarks-group">{bookmarks?.name}</div>
    ),
}));

vi.mock("@/components/services/group", () => ({
    default: ({ group }: { group?: { name?: string } }) => <div data-testid="services-group">{group?.name}</div>,
}));

vi.mock("@/components/errorboundry", () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/tab", () => ({
    default: ({ tab }: { tab: string }) => <li data-testid="tab">{tab}</li>,
    slugifyAndEncode: (tabName?: string | number) =>
        tabName !== undefined ? encodeURIComponent(tabName.toString().replace(/\\s+/g, "-").toLowerCase()) : "",
}));

vi.mock("@/components/quicklaunch", () => ({
    default: (props: { isOpen: boolean; servicesAndBookmarks?: QuickLaunchEntry[]; searchString: string }) => {
        state.quickLaunchProps = props;
        return (
            <div data-testid="quicklaunch">
                {props.isOpen ? "open" : "closed"}:{props.servicesAndBookmarks?.length ?? 0}
            </div>
        );
    },
}));

vi.mock("@/components/widgets/widget", () => ({
    default: ({ widget, style }: { widget: WidgetConfig; style: InfoWidgetStyle }) => {
        state.widgetCalls.push({ widget, style });
        return <div data-testid="widget">{widget?.type}</div>;
    },
}));

vi.mock("@/components/toggles/revalidate", () => ({
    default: () => null,
}));

async function renderIndex({
    initialSettings = { title: "Foyer", layout: {} },
    fallback = {},
    theme = "dark",
    color = "slate",
    activeTab = "",
    settings = initialSettings,
}: {
    initialSettings?: Settings & { description?: string; favicon?: string; font?: string };
    fallback?: Record<string, unknown>;
    theme?: string;
    color?: string;
    activeTab?: string;
    settings?: Settings;
} = {}) {
    const { default: Wrapper } = await import("@/app/dashboard");

    const setTheme = vi.fn();
    const setColor = vi.fn();
    const setSettings = vi.fn();
    const setActiveTab = vi.fn();

    const renderResult = render(
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <ColorContext.Provider value={{ color, setColor }}>
                <SettingsContext.Provider value={{ settings, setSettings }}>
                    <TabContext.Provider value={{ activeTab, setActiveTab }}>
                        <Wrapper initialSettings={initialSettings} fallback={fallback} />
                    </TabContext.Provider>
                </SettingsContext.Provider>
            </ColorContext.Provider>
        </ThemeContext.Provider>
    );

    return { ...renderResult, setTheme, setColor, setSettings, setActiveTab };
}

describe("app/dashboard Wrapper", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.validateData = [];
        state.hashData = null;
        state.servicesData = [];
        state.bookmarksData = [];
        state.widgetsData = [];
        state.widgetCalls = [];
        document.documentElement.className = "dark theme-slate";
    });

    it("applies theme/color classes and renders a background overlay when configured", async () => {
        await renderIndex({
            initialSettings: {
                title: "Foyer",
                color: "slate",
                background: {
                    image: "https://example.com/bg.jpg",
                    opacity: 10,
                    blur: "",
                    saturate: "150",
                    brightness: "125",
                },
                layout: {},
            },
            theme: "dark",
            color: "emerald",
        });

        await waitFor(() => {
            expect(document.documentElement.classList.contains("scheme-dark")).toBe(true);
        });
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        expect(document.documentElement.classList.contains("theme-emerald")).toBe(true);
        expect(document.documentElement.classList.contains("theme-slate")).toBe(false);

        expect(document.querySelector("#background")).toBeTruthy();
        expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-blur");
        expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-saturate-150");
        expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-brightness-125");
    });

    it("supports legacy string backgrounds in settings", async () => {
        await renderIndex({
            initialSettings: {
                title: "Foyer",
                color: "slate",
                background: "https://example.com/bg.jpg",
                layout: {},
            },
            theme: "dark",
            color: "emerald",
        });

        expect(document.querySelector("#background")).toBeTruthy();
    });
});

describe("app/dashboard Index routing + SWR branches", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.hashData = null;
        state.mutateHash.mockClear();
        state.servicesData = [];
        state.bookmarksData = [];
        state.widgetsData = [];
    });

    it("renders the validation error screen when /api/validate returns an error", async () => {
        state.validateData = { error: "bad config" };

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });

        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("bad config")).toBeInTheDocument();
    });

    it("renders config errors when /api/validate returns a list of errors", async () => {
        state.validateData = [{ config: "services.yaml", name: "Service 1", reason: "broken", mark: { line: 4 } }];

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });

        expect(screen.getByText(/services.yaml/)).toBeInTheDocument();
        expect(screen.getByText(/line 4/)).toBeInTheDocument();
    });

    it("marks the UI stale when the hash changes and triggers a revalidate reload", async () => {
        state.validateData = [];
        state.hashData = { hash: "new-hash" };
        localStorage.setItem("hash", "old-hash");

        const fetchSpy = vi.fn(async () => ({ ok: true }));

        globalThis.fetch = fetchSpy as unknown as typeof fetch;

        let reloadSpy;
        try {
            reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
        } catch {
            // jsdom can make window.location non-configurable in some contexts.
            Object.defineProperty(window, "location", { value: { reload: vi.fn() }, writable: true });
            reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
        }

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });
        act(() => state.hashConfig?.onSuccess(state.hashData));

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith("/api/revalidate");
        });
        await waitFor(() => {
            expect(reloadSpy).toHaveBeenCalled();
        });
        expect(document.querySelector(".animate-spin")).toBeTruthy();
    });

    it("mutates the hash when the window regains focus", async () => {
        state.validateData = [];
        state.hashData = { hash: "h" };
        state.windowFocused = true;

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });

        await waitFor(() => {
            expect(state.mutateHash).toHaveBeenCalled();
        });
    });

    it("stores the initial hash in localStorage when none exists", async () => {
        state.validateData = [];
        state.hashData = { hash: "first-hash" };
        localStorage.removeItem("hash");

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });
        act(() => state.hashConfig?.onSuccess(state.hashData));

        await waitFor(() => {
            expect(localStorage.getItem("hash")).toBe("first-hash");
        });
    });

    it("ignores a hash response without a hash", async () => {
        state.validateData = [];
        localStorage.setItem("hash", "old-hash");

        await renderIndex({ initialSettings: { title: "Foyer", layout: {} }, settings: { layout: {} } });

        expect(() => act(() => state.hashConfig?.onSuccess(null))).not.toThrow();
        expect(() => act(() => state.hashConfig?.onSuccess({}))).not.toThrow();
        expect(localStorage.getItem("hash")).toBe("old-hash");
        expect(document.querySelector(".animate-spin")).toBeFalsy();
    });
});

describe("app/dashboard Home behavior", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.validateData = [];
        state.hashData = null;
        state.servicesData = [
            {
                name: "Services",
                services: [{ name: "s1", href: "http://svc/1" }, { name: "s2" }],
                groups: [{ name: "Nested", services: [{ name: "s3", href: "http://svc/3" }], groups: [] }],
            },
        ];
        state.bookmarksData = [{ name: "Bookmarks", bookmarks: [{ name: "b1", href: "http://bm/1" }, { name: "b2" }] }];
        state.widgetsData = [{ type: "glances" }, { type: "search" }];
        state.quickLaunchProps = null;
        state.widgetCalls = [];
    });

    it("passes href-bearing services and bookmarks to QuickLaunch and toggles search on keydown", async () => {
        await renderIndex({
            initialSettings: { title: "Foyer", layout: {} },
            settings: { title: "Foyer", layout: {}, language: "en" },
        });

        await waitFor(() => {
            expect(state.quickLaunchProps).toBeTruthy();
        });

        expect(state.quickLaunchProps?.servicesAndBookmarks?.map((i) => i.name)).toEqual(["b1", "s1", "s3"]);
        expect(screen.getByTestId("quicklaunch")).toHaveTextContent("closed:3");

        fireEvent.keyDown(document.body, { key: "a" });
        expect(screen.getByTestId("quicklaunch")).toHaveTextContent("open:3");
        expect(state.quickLaunchProps?.searchString).toBe("a");

        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(screen.getByTestId("quicklaunch")).toHaveTextContent("closed:3");
    });

    it("opens search on space without seeding the query with whitespace", async () => {
        await renderIndex({
            initialSettings: { title: "Foyer", layout: {} },
            settings: { title: "Foyer", layout: {}, language: "en" },
        });

        await waitFor(() => {
            expect(state.quickLaunchProps).toBeTruthy();
        });

        fireEvent.keyDown(document.body, { key: " " });
        expect(screen.getByTestId("quicklaunch")).toHaveTextContent("open:3");
        expect(state.quickLaunchProps?.searchString).toBe("");
    });

    it("renders services and bookmark groups when present", async () => {
        await renderIndex({
            initialSettings: { title: "Foyer", layout: {} },
            settings: { title: "Foyer", layout: {}, language: "en" },
        });

        expect(await screen.findByTestId("services-group")).toHaveTextContent("Services");
        expect(screen.getByTestId("bookmarks-group")).toHaveTextContent("Bookmarks");
    });

    it("renders tab navigation and filters groups by active tab", async () => {
        state.servicesData = [{ name: "Services", services: [], groups: [] }];
        state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];

        await renderIndex({
            initialSettings: { title: "Foyer", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
            settings: { title: "Foyer", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
            activeTab: "main",
        });

        expect(await screen.findAllByTestId("tab")).toHaveLength(1);
        expect(screen.getAllByTestId("services-group")[0]).toHaveTextContent("Services");
        expect(screen.getAllByTestId("bookmarks-group")[0]).toHaveTextContent("Bookmarks");
    });

    it("picks the initial tab from the location hash, or the first tab without one", async () => {
        const layout = { Services: { tab: "Main" }, Bookmarks: { tab: "Other" } };

        window.location.hash = "#other";
        const fromHash = await renderIndex({ initialSettings: { title: "Foyer", layout }, settings: { layout } });
        expect(fromHash.setActiveTab).toHaveBeenCalledWith("other");
        fromHash.unmount();

        window.location.hash = "";
        const withoutHash = await renderIndex({ initialSettings: { title: "Foyer", layout }, settings: { layout } });
        expect(withoutHash.setActiveTab).toHaveBeenCalledWith("main");
    });

    it("waits for settings.layout to populate when it differs from initial settings", async () => {
        state.servicesData = [{ name: "Services", services: [], groups: [] }];
        state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];

        await renderIndex({
            initialSettings: { title: "Foyer", layout: {} },
            // Missing layout triggers the temporary `<div />` return to avoid eager widget fetches.
            settings: { title: "Foyer" },
        });

        expect(screen.queryByTestId("services-group")).toBeNull();
        expect(screen.queryByTestId("bookmarks-group")).toBeNull();
    });

    it("applies cardBlur classes for tabs and boxed headers when configured", async () => {
        state.servicesData = [{ name: "Services", services: [], groups: [] }];
        state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];
        state.widgetsData = [{ type: "search" }];

        await renderIndex({
            initialSettings: { title: "Foyer", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
            settings: {
                title: "Foyer",
                layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } },
                headerStyle: "boxed",
                cardBlur: "sm",
            },
            activeTab: "main",
        });

        expect(document.querySelector("#myTab")?.className).toContain("backdrop-blur-sm");
        expect(document.querySelector("#information-widgets")?.className).toContain("backdrop-blur-sm");
    });

    it("applies settings-driven language/theme/color updates and renders head tags", async () => {
        state.servicesData = [];
        state.bookmarksData = [];
        state.widgetsData = [];

        const { setTheme, setColor, setSettings } = await renderIndex({
            initialSettings: { title: "Foyer", layout: {}, favicon: "/x.ico" },
            settings: {
                title: "Foyer",
                layout: {},
                language: "en",
                theme: "light",
                color: "emerald",
                disableIndexing: true,
            },
            theme: "dark",
            color: "slate",
        });

        await waitFor(() => {
            expect(setSettings).toHaveBeenCalled();
        });
        expect(i18n.changeLanguage).toHaveBeenCalledWith("en");
        expect(setTheme).toHaveBeenCalledWith("light");
        expect(setColor).toHaveBeenCalledWith("emerald");

        expect(document.querySelector('meta[name="robots"][content="noindex, nofollow"]')).toBeTruthy();
        expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/x.ico");
    });

    // Safari reads the head without running JS, so the favicon has to be there before the
    // settings context is populated, and mask-icon must not be
    it("renders a custom favicon before the settings context is populated", async () => {
        await renderIndex({
            initialSettings: { title: "Foyer", layout: {}, favicon: "/x.ico" },
            settings: {},
        });

        expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/x.ico");
        expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href")).toBe("/x.ico");
        expect(document.querySelector('link[rel="mask-icon"]')).toBeNull();
        expect(document.querySelector('link[rel="shortcut icon"]')).toBeNull();
    });

    it("marks information widgets as right-aligned for known widget types", async () => {
        await renderIndex({
            initialSettings: { title: "Foyer", layout: {} },
            settings: { title: "Foyer", layout: {}, language: "en" },
        });

        await waitFor(() => {
            expect(state.widgetCalls.length).toBeGreaterThan(0);
        });

        const rightAligned = state.widgetCalls.filter((c) => c.style?.isRightAligned).map((c) => c.widget.type);
        expect(rightAligned).toEqual(["search"]);
    });
});
