// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeContext, ThemeProvider } from "@/utils/contexts/theme";

function Reader() {
    const { theme } = useContext(ThemeContext);
    return <div data-testid="value">{theme}</div>;
}

const mockMatchMedia = (matches: boolean) =>
    vi.fn(() => ({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

describe("utils/contexts/theme", () => {
    it("initializes from localStorage and writes html classes", async () => {
        // jsdom doesn't implement matchMedia by default; ensure it exists for getInitialTheme.
        window.matchMedia = window.matchMedia || mockMatchMedia(false);

        localStorage.setItem("theme-mode", "light");
        document.documentElement.className = "";

        render(
            <ThemeProvider>
                <Reader />
            </ThemeProvider>
        );

        expect(screen.getByTestId("value")).toHaveTextContent("light");
        await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
        expect(localStorage.getItem("theme-mode")).toBe("light");
    });

    it("falls back to prefers-color-scheme when localStorage is empty", async () => {
        const matchMedia = mockMatchMedia(true);
        window.matchMedia = matchMedia;
        localStorage.removeItem("theme-mode");

        render(
            <ThemeProvider>
                <Reader />
            </ThemeProvider>
        );

        expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
        expect(screen.getByTestId("value")).toHaveTextContent("dark");
    });

    it("defaults to dark when prefers-color-scheme does not match", async () => {
        const matchMedia = mockMatchMedia(false);
        window.matchMedia = matchMedia;
        localStorage.removeItem("theme-mode");

        render(
            <ThemeProvider>
                <Reader />
            </ThemeProvider>
        );

        expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
        expect(screen.getByTestId("value")).toHaveTextContent("dark");
        await waitFor(() => expect(localStorage.getItem("theme-mode")).toBe("dark"));
    });
});
