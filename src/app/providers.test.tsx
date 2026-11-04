// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { i18nProviderProps } = vi.hoisted(() => ({
    i18nProviderProps: { current: null as Record<string, unknown> | null },
}));

vi.mock("next-i18next/client", () => ({
    I18nProvider: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => {
        i18nProviderProps.current = props;
        return <>{children}</>;
    },
}));

vi.mock("@/utils/contexts/color", () => ({
    ColorProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/utils/contexts/theme", () => ({
    ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/utils/contexts/settings", () => ({
    SettingsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/utils/contexts/tab", () => ({
    TabProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import Providers from "@/app/providers";

import nextI18nextConfig from "../../next-i18next.config";

describe("app/providers", () => {
    it("renders the page inside the providers", () => {
        render(
            <Providers language="en" resources={{}}>
                <div>page content</div>
            </Providers>
        );

        expect(screen.getByText("page content")).toBeInTheDocument();
    });

    it("hydrates i18next with the server resources and the shared formatters", () => {
        const resources = { de: { common: { hello: "Hallo" } } };

        render(
            <Providers language="de" resources={resources}>
                <div />
            </Providers>
        );

        expect(i18nProviderProps.current).toEqual({
            language: "de",
            resources,
            fallbackLng: "en",
            localePath: "/locales",
            use: nextI18nextConfig.use,
            i18nextOptions: { cacheInBuiltFormats: false },
        });
    });
});
