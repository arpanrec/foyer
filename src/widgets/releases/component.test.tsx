// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("@/utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "@/widgets/releases/component";

const releases = Array.from({ length: 7 }, (_, i) => ({
    source: i % 2 ? "gitlab" : "github",
    name: `owner/repo${i}`,
    version: `v1.${i}`,
    url: `https://example.com/${i}`,
    date: "2026-01-01T00:00:00Z",
}));

function render(widget = {}, settings = {}) {
    return renderWithProviders(<Component service={{ widget: { type: "releases", ...widget } }} />, {
        settings: { hideErrors: false, ...settings },
    });
}

describe("widgets/releases/component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders placeholders while loading", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
        const { container } = render();
        expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    });

    it("renders an error", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "Unable to fetch any releases" } });
        render();
        expect(screen.getAllByText(/Unable to fetch any releases/).length).toBeGreaterThan(0);
    });

    it("renders release rows as links", () => {
        useWidgetAPI.mockReturnValue({ data: { releases: releases.slice(0, 2), failed: 0 }, error: undefined });
        const { container } = render({}, { target: "_self" });

        const link = screen.getByText("owner/repo0").closest("a");
        expect(link).toHaveAttribute("href", "https://example.com/0");
        expect(link).toHaveAttribute("target", "_self");
        expect(screen.getByText("Latest: v1.1")).toBeInTheDocument();
        expect(container.querySelectorAll("svg")).toHaveLength(0);
        expect(screen.queryByText("releases.showMore")).toBeNull();
    });

    it("shows source icons when enabled", () => {
        useWidgetAPI.mockReturnValue({ data: { releases: releases.slice(0, 2), failed: 0 }, error: undefined });
        const { container } = render({ showSourceIcon: true });
        expect(container.querySelectorAll("svg")).toHaveLength(2);
    });

    it("collapses after 5 releases by default and expands on click", () => {
        useWidgetAPI.mockReturnValue({ data: { releases, failed: 0 }, error: undefined });
        render();

        expect(screen.getAllByRole("link")).toHaveLength(5);
        fireEvent.click(screen.getByText("releases.showMore"));
        expect(screen.getAllByRole("link")).toHaveLength(7);
        fireEvent.click(screen.getByText("releases.showLess"));
        expect(screen.getAllByRole("link")).toHaveLength(5);
    });

    it("respects collapseAfter", () => {
        useWidgetAPI.mockReturnValue({ data: { releases, failed: 0 }, error: undefined });
        const { unmount } = render({ collapseAfter: 2 });
        expect(screen.getAllByRole("link")).toHaveLength(2);
        unmount();

        render({ collapseAfter: -1 });
        expect(screen.getAllByRole("link")).toHaveLength(7);
        expect(screen.queryByText("releases.showMore")).toBeNull();
    });

    it("shows failures and downvote warnings", () => {
        useWidgetAPI.mockReturnValue({
            data: {
                releases: [
                    { ...releases[0], downvotes: 12 },
                    { ...releases[1], downvotes: 3 },
                ],
                failed: 2,
                failures: [
                    { service: "github", repo: "owner/missing", reason: "HTTP 404" },
                    { service: "gitlab", repo: "owner/broken", reason: "HTTP 500" },
                ],
            },
            error: undefined,
        });
        render();

        const failedText = screen.getByText("releases.failed");
        expect(failedText).toBeInTheDocument();
        expect(failedText).toHaveClass("text-red-600");
        expect(screen.getByText("github:owner/missing — HTTP 404")).toBeInTheDocument();
        expect(screen.getByText("gitlab:owner/broken — HTTP 500")).toBeInTheDocument();
        expect(screen.getAllByText(/⚠/)).toHaveLength(1);
    });
});
