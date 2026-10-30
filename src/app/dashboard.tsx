"use client";

import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import dynamic from "next/dynamic";
import Script from "next/script";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BiError } from "react-icons/bi";
import useSWR, { SWRConfig } from "swr";

import BookmarksGroup from "@/components/bookmarks/group";
import ErrorBoundary from "@/components/errorboundry";
import QuickLaunch, { type QuickLaunchEntry } from "@/components/quicklaunch";
import ServicesGroup from "@/components/services/group";
import Tab, { slugifyAndEncode } from "@/components/tab";
import Revalidate from "@/components/toggles/revalidate";
import type { BookmarkGroup, GroupLayout } from "@/components/types";
import Widget from "@/components/widgets/widget";
import type { InfoWidgetEntry } from "@/components/widgets/widget/types";
import type { Service, ServiceGroup, Settings } from "@/types/service";
import { ColorContext } from "@/utils/contexts/color";
import { SettingsContext } from "@/utils/contexts/settings";
import { TabContext } from "@/utils/contexts/tab";
import { ThemeContext } from "@/utils/contexts/theme";
import useWindowFocus from "@/utils/hooks/window-focus";
import themes from "@/utils/styles/themes";

const ThemeToggle = dynamic(() => import("@/components/toggles/theme"), {
    ssr: false,
});

const ColorToggle = dynamic(() => import("@/components/toggles/color"), {
    ssr: false,
});

const SignOut = dynamic(() => import("@/components/toggles/signout"), {
    ssr: false,
});

const Version = dynamic(() => import("@/components/version"), {
    ssr: false,
});

const rightAlignedWidgets = ["weatherapi", "openweathermap", "weather", "openmeteo", "search", "datetime"];

// Normalize language codes so older config values like zh-CN still point to the locale folders in public/locales
const LANGUAGE_ALIASES: Record<string, string> = {
    "zh-cn": "zh-Hans",
};

type DashboardSettings = Settings & {
    description?: string;
    favicon?: string;
    font?: string;
};

type DashboardProps = {
    initialSettings: DashboardSettings;
    fallback: Record<string, unknown>;
};

type ValidateErrorEntry = {
    name?: string;
    config?: string;
    reason?: string;
    mark?: { line?: number };
};

type ValidateResponse = ValidateErrorEntry[] & {
    error?: string;
};

const normalizeLanguage = (language?: string) => {
    if (!language) return "en";
    const alias = LANGUAGE_ALIASES[language.toLowerCase()];
    return alias || language;
};

function Index({ initialSettings, fallback }: DashboardProps) {
    const windowFocused = useWindowFocus();
    const [stale, setStale] = useState(false);
    const { data: errorsData } = useSWR<ValidateResponse>("/api/validate");
    const { error: validateError } = errorsData || {};

    const handleHashData = useCallback((hashData?: { hash?: string } | null) => {
        if (typeof window === "undefined" || !hashData?.hash) return;

        const previousHash = localStorage.getItem("hash");

        if (!previousHash) {
            localStorage.setItem("hash", hashData.hash);
        }

        if (previousHash && previousHash !== hashData.hash) {
            setStale(true);
            localStorage.setItem("hash", hashData.hash);

            fetch("/api/revalidate").then((res) => {
                if (res.ok) {
                    window.location.reload();
                }
            });
        }
    }, []);

    const { mutate: mutateHash } = useSWR("/api/hash", { onSuccess: handleHashData });

    useEffect(() => {
        if (windowFocused) {
            mutateHash();
        }
    }, [windowFocused, mutateHash]);

    if (validateError) {
        return (
            <div className="w-full h-screen container m-auto justify-center p-10 pointer-events-none">
                <div className="flex flex-col">
                    <div className="basis-1/2 bg-theme-500 dark:bg-theme-600 text-theme-600 dark:text-theme-300 m-2 rounded-md font-mono shadow-md border-4 border-transparent">
                        <div className="bg-rose-200 text-rose-800 dark:text-rose-200 dark:bg-rose-800 p-2 rounded-md font-bold">
                            <BiError className="float-right w-6 h-6" />
                            Error
                        </div>
                        <div className="p-2 text-theme-100 dark:text-theme-200">
                            <pre className="opacity-50 font-bold pb-2">{validateError}</pre>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (stale) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-24 h-24 border-2 border-theme-400 border-solid rounded-full animate-spin border-t-transparent" />
            </div>
        );
    }

    if (errorsData && errorsData.length > 0) {
        return (
            <div className="w-full h-screen container m-auto justify-center p-10 pointer-events-none">
                <div className="flex flex-col">
                    {errorsData.map((error, i) => (
                        <div
                            className="basis-1/2 bg-theme-500 dark:bg-theme-600 text-theme-600 dark:text-theme-300 m-2 rounded-md font-mono shadow-md border-4 border-transparent"
                            key={i}
                        >
                            <div className="bg-amber-200 text-amber-800 dark:text-amber-200 dark:bg-amber-800 p-2 rounded-md font-bold">
                                <BiError className="float-right w-6 h-6" />
                                {error.name} - {error.config}
                            </div>
                            <div className="p-2 text-theme-100 dark:text-theme-200">
                                <pre className="opacity-50 font-bold pb-2">
                                    Reason: &quot;{error.reason}&quot;
                                    {error.mark?.line !== undefined && ` at line ${error.mark.line}`}
                                </pre>
                                <pre className="font-italic">Check logs for details.</pre>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <SWRConfig
            value={{
                fallback,
                fetcher: (resource, init) => fetch(resource, init).then((res) => res.json()),
            }}
        >
            <ErrorBoundary>
                <Home initialSettings={initialSettings} />
            </ErrorBoundary>
        </SWRConfig>
    );
}

const headerStyles: Record<string, string> = {
    boxed: "m-5 mb-0 sm:m-9 sm:mb-0 rounded-md shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5 p-3",
    underlined: "m-5 mb-0 sm:m-9 sm:mb-1 border-b-2 pb-4 border-theme-800 dark:border-theme-200/50",
    clean: "m-5 mb-0 sm:m-9 sm:mb-0",
    boxedWidgets: "m-5 mb-0 sm:m-9 sm:mb-0 sm:mt-1",
};

function getAllServices(services: ServiceGroup[] = []) {
    function getServices(group: ServiceGroup): Service[] {
        let nestedServices = [...group.services];
        if (group.groups && group.groups.length > 0) {
            nestedServices = [...nestedServices, ...group.groups.map(getServices).flat()];
        }
        return nestedServices;
    }

    return [...services.map(getServices).flat()];
}

function Home({ initialSettings }: { initialSettings: DashboardSettings }) {
    const { i18n } = useTranslation();
    const { theme, setTheme } = useContext(ThemeContext);
    const { color, setColor } = useContext(ColorContext);
    const { settings, setSettings } = useContext(SettingsContext);
    const { activeTab, setActiveTab } = useContext(TabContext);

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings, setSettings]);

    const { data: services } = useSWR<ServiceGroup[]>("/api/services");
    const { data: bookmarks } = useSWR<BookmarkGroup[]>("/api/bookmarks");
    const { data: widgets } = useSWR<InfoWidgetEntry[]>("/api/widgets");

    const servicesAndBookmarks = [
        ...(bookmarks?.map((bg) => bg.bookmarks).flat() ?? []),
        ...getAllServices(services),
    ].filter((i): i is QuickLaunchEntry => Boolean(i?.href));

    useEffect(() => {
        const language = normalizeLanguage(settings.language);
        if (language) {
            i18n.changeLanguage(language);
        }

        if (settings.theme && theme !== settings.theme) {
            setTheme(settings.theme);
        }

        if (settings.color && color !== settings.color) {
            setColor(settings.color);
        }
    }, [i18n, settings, color, setColor, theme, setTheme]);

    const [searching, setSearching] = useState(false);
    const [searchString, setSearchString] = useState("");
    const headerStyle = settings?.headerStyle || "underlined";

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            if (target?.tagName === "BODY" || target?.id === "inner_wrapper") {
                if (
                    (e.key.length === 1 &&
                        e.key.match(/(\w|\s|[à-ü]|[À-Ü]|[\w\u0430-\u044f])/gi) &&
                        !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) ||
                    // accented characters and the bang may require modifier keys
                    e.key.match(/([à-ü]|[À-Ü]|!)/g) ||
                    (e.key === "v" && (e.ctrlKey || e.metaKey))
                ) {
                    if (e.key.length === 1 && !(e.key === "v" && (e.ctrlKey || e.metaKey))) {
                        e.preventDefault();
                        // whitespace opens the search but shouldn't be in it
                        if (e.key.trim()) {
                            setSearchString((currentSearchString) => currentSearchString + e.key);
                        }
                    }
                    setSearching(true);
                } else if (e.key === "Escape") {
                    setSearchString("");
                    setSearching(false);
                }
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return function cleanup() {
            document.removeEventListener("keydown", handleKeyDown);
        };
    });

    const tabs = useMemo(
        () => [
            ...new Set(
                Object.keys(settings.layout ?? {})
                    .map((groupName) => (settings.layout?.[groupName] as GroupLayout | undefined)?.tab?.toString())
                    .filter((group): group is string => Boolean(group))
            ),
        ],
        [settings.layout]
    );

    useEffect(() => {
        if (!activeTab) {
            const asPath = window.location.hash || "/";
            const initialTab = asPath.substring(asPath.indexOf("#") + 1);
            setActiveTab(initialTab === "/" ? slugifyAndEncode(tabs[0]) : initialTab);
        }
    });

    const servicesAndBookmarksGroups = useMemo(() => {
        const getGroupLayout = (name: string) => settings.layout?.[name] as GroupLayout | undefined;
        const tabGroupFilter = <T extends ServiceGroup | BookmarkGroup>(g: T | undefined): g is T =>
            Boolean(g && [activeTab, ""].includes(slugifyAndEncode(getGroupLayout(g.name)?.tab)));
        const undefinedGroupFilter = (g: ServiceGroup | BookmarkGroup) => settings.layout?.[g.name] === undefined;

        const layoutGroups = Object.keys(settings.layout ?? {})
            .map(
                (groupName) =>
                    services?.find((g) => g.name === groupName) ?? bookmarks?.find((b) => b.name === groupName)
            )
            .filter(tabGroupFilter);

        if (!settings.layout && JSON.stringify(settings.layout) !== JSON.stringify(initialSettings.layout)) {
            // wait for settings to populate (if different from initial settings), otherwise all the widgets will be requested initially even if we are on a single tab
            return <div />;
        }

        const serviceGroups = services?.filter(tabGroupFilter).filter(undefinedGroupFilter);
        const bookmarkGroups = bookmarks?.filter(tabGroupFilter).filter(undefinedGroupFilter);

        return (
            <>
                {tabs.length > 0 && (
                    <div key="tabs" id="tabs" className="m-5 sm:m-9 sm:mt-4 sm:mb-0">
                        <ul
                            className={classNames(
                                "sm:flex rounded-md bg-theme-100/20 dark:bg-white/5",
                                settings.cardBlur !== undefined &&
                                    `backdrop-blur${settings.cardBlur.length ? "-" : ""}${settings.cardBlur}`
                            )}
                            id="myTab"
                            data-tabs-toggle="#myTabContent"
                            role="tablist"
                        >
                            {tabs.map((tab) => (
                                <Tab key={tab} tab={tab} />
                            ))}
                        </ul>
                    </div>
                )}
                {layoutGroups.length > 0 && (
                    <div
                        key="layoutGroups"
                        id="layout-groups"
                        className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2"
                    >
                        {layoutGroups.map((group) =>
                            "services" in group ? (
                                <ServicesGroup
                                    key={group.name}
                                    group={group}
                                    layout={getGroupLayout(group.name)}
                                    maxGroupColumns={settings.fiveColumns ? 5 : settings.maxGroupColumns}
                                    disableCollapse={settings.disableCollapse}
                                    useEqualHeights={settings.useEqualHeights}
                                    groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                                />
                            ) : (
                                <BookmarksGroup
                                    key={group.name}
                                    bookmarks={group}
                                    layout={getGroupLayout(group.name)}
                                    disableCollapse={settings.disableCollapse}
                                    maxGroupColumns={settings.maxBookmarkGroupColumns ?? settings.maxGroupColumns}
                                    groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                                />
                            )
                        )}
                    </div>
                )}
                {serviceGroups && serviceGroups.length > 0 && (
                    <div key="services" id="services" className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
                        {serviceGroups.map((group) => (
                            <ServicesGroup
                                key={group.name}
                                group={group}
                                layout={getGroupLayout(group.name)}
                                maxGroupColumns={settings.fiveColumns ? 5 : settings.maxGroupColumns}
                                disableCollapse={settings.disableCollapse}
                                groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                            />
                        ))}
                    </div>
                )}
                {bookmarkGroups && bookmarkGroups.length > 0 && (
                    <div key="bookmarks" id="bookmarks" className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
                        {bookmarkGroups.map((group) => (
                            <BookmarksGroup
                                key={group.name}
                                bookmarks={group}
                                layout={getGroupLayout(group.name)}
                                disableCollapse={settings.disableCollapse}
                                maxGroupColumns={settings.maxBookmarkGroupColumns ?? settings.maxGroupColumns}
                                groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                                bookmarksStyle={settings.bookmarksStyle}
                            />
                        ))}
                    </div>
                )}
            </>
        );
    }, [
        tabs,
        activeTab,
        services,
        bookmarks,
        settings.layout,
        settings.fiveColumns,
        settings.maxGroupColumns,
        settings.maxBookmarkGroupColumns,
        settings.disableCollapse,
        settings.useEqualHeights,
        settings.cardBlur,
        settings.groupsInitiallyCollapsed,
        settings.bookmarksStyle,
        initialSettings.layout,
    ]);

    return (
        <>
            {/* React hoists these into the document head */}
            <>
                <title>{initialSettings.title || "Foyer"}</title>
                <meta
                    name="description"
                    content={
                        initialSettings.description ||
                        "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations."
                    }
                />
                {/* only on the authenticated dashboard, since the manifest route requires a session */}
                <link rel="manifest" href="/site.webmanifest?v=4" crossOrigin="use-credentials" />
                {settings.disableIndexing && <meta name="robots" content="noindex, nofollow" />}
                {/* from props, not context so its set before running JS */}
                {initialSettings.favicon ? (
                    <>
                        <link rel="icon" href={initialSettings.favicon} />
                        <link rel="apple-touch-icon" sizes="180x180" href={initialSettings.favicon} />
                    </>
                ) : (
                    <>
                        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=4" />
                        <link rel="shortcut icon" href="/foyer.ico" />
                        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4" />
                        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4" />
                        <link rel="mask-icon" href="/safari-pinned-tab.svg?v=4" color="#1e9cd7" />
                    </>
                )}
                <meta
                    name="msapplication-TileColor"
                    content={themes[settings.color || "slate"][settings.theme || "dark"]}
                />
                <meta name="theme-color" content={themes[settings.color || "slate"][settings.theme || "dark"]} />
                <meta name="color-scheme" content="dark light"></meta>
            </>

            <Script src="/api/config/custom.js" />

            <div
                className={classNames(
                    settings.fullWidth ? "" : "container",
                    "relative m-auto flex flex-col justify-start z-10 h-full min-h-screen"
                )}
            >
                <QuickLaunch
                    servicesAndBookmarks={servicesAndBookmarks}
                    searchString={searchString}
                    setSearchString={setSearchString}
                    isOpen={searching}
                    setSearching={setSearching}
                />
                <div
                    id="information-widgets"
                    className={classNames(
                        "flex flex-row flex-wrap justify-between z-20",
                        headerStyles[headerStyle],
                        settings.cardBlur !== undefined &&
                            headerStyle === "boxed" &&
                            `backdrop-blur${settings.cardBlur.length ? "-" : ""}${settings.cardBlur}`
                    )}
                >
                    <div
                        id="widgets-wrap"
                        className={classNames("flex flex-row w-full flex-wrap justify-between gap-x-2")}
                    >
                        {widgets && (
                            <>
                                {widgets
                                    .filter((widget) => !rightAlignedWidgets.includes(widget.type))
                                    .map((widget, i) => (
                                        <Widget
                                            key={i}
                                            widget={widget}
                                            style={{
                                                header: headerStyle,
                                                isRightAligned: false,
                                                cardBlur: settings.cardBlur,
                                            }}
                                        />
                                    ))}

                                <div
                                    id="information-widgets-right"
                                    className={classNames(
                                        "m-auto flex flex-wrap grow sm:basis-auto justify-between md:justify-end",
                                        "m-auto flex flex-wrap grow sm:basis-auto justify-between md:justify-end gap-x-2"
                                    )}
                                >
                                    {widgets
                                        .filter((widget) => rightAlignedWidgets.includes(widget.type))
                                        .map((widget, i) => (
                                            <Widget
                                                key={i}
                                                widget={widget}
                                                style={{
                                                    header: headerStyle,
                                                    isRightAligned: true,
                                                    cardBlur: settings.cardBlur,
                                                }}
                                            />
                                        ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {servicesAndBookmarksGroups}

                <div id="footer" className="flex flex-col mt-auto p-8 w-full">
                    <div id="style" className="flex w-full justify-end">
                        {!settings?.color && <ColorToggle />}
                        <Revalidate />
                        <SignOut />
                        {!settings.theme && <ThemeToggle />}
                    </div>

                    <div id="version" className="flex mt-4 w-full justify-end">
                        {!settings.hideVersion && <Version />}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function Wrapper({ initialSettings, fallback }: DashboardProps) {
    const { theme } = useContext(ThemeContext);
    const { color } = useContext(ColorContext);
    let backgroundImage = "";
    let opacity = initialSettings?.backgroundOpacity ?? 0;
    let backgroundBlur = false;
    let backgroundBlurSize = "";
    let backgroundSaturate: string | undefined;
    let backgroundBrightness: string | undefined;
    if (initialSettings?.background) {
        const bg = initialSettings.background;
        if (typeof bg === "object") {
            backgroundImage = bg.image || "";
            if (bg.opacity !== undefined) {
                opacity = 1 - bg.opacity / 100;
            }
            backgroundBlur = bg.blur !== undefined;
            backgroundBlurSize = typeof bg.blur === "string" ? bg.blur : "";
            backgroundSaturate = bg.saturate !== undefined ? String(bg.saturate) : undefined;
            backgroundBrightness = bg.brightness !== undefined ? String(bg.brightness) : undefined;
        } else {
            backgroundImage = bg;
        }
    }

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        html.classList.remove("dark", "scheme-dark", "scheme-light", "font-plex", "font-plex-data");
        if (initialSettings.font === "plex") html.classList.add("font-plex");
        if (initialSettings.font === "plexData") html.classList.add("font-plex-data");
        html.classList.toggle("dark", theme === "dark");
        html.classList.add(theme === "dark" ? "scheme-dark" : "scheme-light");

        const desiredThemeClass = `theme-${color || initialSettings.color || "slate"}`;
        const themeClassesToRemove = Array.from(html.classList).filter(
            (cls) => cls.startsWith("theme-") && cls !== desiredThemeClass
        );
        if (themeClassesToRemove.length) {
            html.classList.remove(...themeClassesToRemove);
        }
        if (!html.classList.contains(desiredThemeClass)) {
            html.classList.add(desiredThemeClass);
        }

        // Remove any previously applied inline styles
        body.style.backgroundImage = "";
        body.style.backgroundColor = "";
        body.style.backgroundAttachment = "";
    }, [backgroundImage, opacity, theme, color, initialSettings.color, initialSettings.font]);

    return (
        <>
            {backgroundImage && (
                <div
                    id="background"
                    aria-hidden="true"
                    style={{
                        backgroundImage: `linear-gradient(rgb(var(--bg-color) / ${opacity}), rgb(var(--bg-color) / ${opacity})), url('${backgroundImage}')`,
                    }}
                />
            )}
            <div id="page_wrapper" className="relative h-full">
                <div
                    id="inner_wrapper"
                    tabIndex={-1}
                    className={classNames(
                        "w-full h-full overflow-auto",
                        backgroundBlur && `backdrop-blur${backgroundBlurSize.length ? `-${backgroundBlurSize}` : ""}`,
                        backgroundSaturate !== undefined && `backdrop-saturate-${backgroundSaturate}`,
                        backgroundBrightness !== undefined && `backdrop-brightness-${backgroundBrightness}`
                    )}
                >
                    <Index initialSettings={initialSettings} fallback={fallback} />
                </div>
            </div>
        </>
    );
}
