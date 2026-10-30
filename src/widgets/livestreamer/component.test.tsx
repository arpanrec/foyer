// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("@/utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "@/widgets/livestreamer/component";
import type { LiveStreamerChannel } from "@/widgets/livestreamer/types";

const mockChannels: LiveStreamerChannel[] = [
    {
        platform: "twitch",
        login: "streamer1",
        name: "Streamer One",
        url: "https://twitch.tv/streamer1",
        exists: true,
        avatarUrl: "https://example.com/avatar1.jpg",
        isLive: true,
        viewersCount: 15420,
        game: "Just Chatting",
        streamTitle: "Chilling and chatting today",
        startedAt: "2026-10-24T10:00:00Z",
        previewUrl: "https://example.com/preview1.jpg",
    },
    {
        platform: "twitch",
        login: "streamer2",
        name: "Streamer Two",
        url: "https://twitch.tv/streamer2",
        exists: true,
        avatarUrl: "https://example.com/avatar2.jpg",
        isLive: false,
        viewersCount: -1,
    },
    {
        platform: "twitch",
        login: "streamer3",
        name: "Streamer Three",
        url: "https://twitch.tv/streamer3",
        exists: false,
        isLive: false,
        viewersCount: -1,
    },
    {
        platform: "twitch",
        login: "streamer4",
        name: "Streamer Four",
        url: "https://twitch.tv/streamer4",
        exists: true,
        isLive: true,
        viewersCount: 2300,
        game: "Valorant",
        streamTitle: "Ranked grind",
    },
    {
        platform: "twitch",
        login: "streamer5",
        name: "Streamer Five",
        url: "https://twitch.tv/streamer5",
        exists: true,
        isLive: false,
        viewersCount: -1,
    },
    {
        platform: "twitch",
        login: "streamer6",
        name: "Streamer Six",
        url: "https://twitch.tv/streamer6",
        exists: true,
        isLive: true,
        viewersCount: 500,
        game: "Minecraft",
    },
];

function render(widget = {}, settings = {}) {
    return renderWithProviders(<Component service={{ widget: { type: "livestreamer", ...widget } }} />, {
        settings: { hideErrors: false, ...settings },
    });
}

describe("widgets/livestreamer/component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders placeholders while loading", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
        const { container } = render();
        expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    });

    it("renders an error message when API call fails", () => {
        useWidgetAPI.mockReturnValue({
            data: undefined,
            error: { message: "channels must be a non-empty list of <platform>:<name> entries" },
        });
        render();
        expect(screen.getByText(/channels must be a non-empty list/)).toBeInTheDocument();
    });

    it("renders channel rows with links and correct statuses", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: mockChannels.slice(0, 3) },
            error: undefined,
        });
        render({}, { target: "_blank" });

        // Live channel
        expect(screen.getByText("Streamer One")).toBeInTheDocument();
        expect(screen.getByText("livestreamer.live")).toBeInTheDocument();
        expect(screen.getByText(/15420/)).toBeInTheDocument();
        expect(screen.getByText("Just Chatting")).toBeInTheDocument();
        expect(screen.getAllByText("Chilling and chatting today").length).toBeGreaterThanOrEqual(1);
        const liveLink = screen.getByText("Streamer One").closest("a");
        expect(liveLink).toHaveAttribute("href", "https://twitch.tv/streamer1");
        expect(liveLink).toHaveAttribute("target", "_blank");

        // Offline channel
        expect(screen.getByText("Streamer Two")).toBeInTheDocument();
        expect(screen.getByText("livestreamer.offline")).toBeInTheDocument();
        expect(screen.getByText("twitch.tv/streamer2")).toBeInTheDocument();
        const offlineLink = screen.getByText("Streamer Two").closest("a");
        expect(offlineLink).toHaveAttribute("href", "https://twitch.tv/streamer2");

        // Non-existent channel
        expect(screen.getByText("Streamer Three")).toBeInTheDocument();
        expect(screen.getByText("livestreamer.notFound")).toBeInTheDocument();
        const notFoundLink = screen.getByText("Streamer Three").closest("a");
        expect(notFoundLink).toBeNull();
    });

    it("collapses after 5 channels by default and expands on click", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: mockChannels },
            error: undefined,
        });
        const { container } = render();

        expect(container.querySelectorAll(".group")).toHaveLength(5);
        expect(screen.getByText("livestreamer.showMore")).toBeInTheDocument();

        fireEvent.click(screen.getByText("livestreamer.showMore"));
        expect(container.querySelectorAll(".group")).toHaveLength(6);
        expect(screen.getByText("Streamer Six")).toBeInTheDocument();
        expect(screen.getByText("livestreamer.showLess")).toBeInTheDocument();

        fireEvent.click(screen.getByText("livestreamer.showLess"));
        expect(container.querySelectorAll(".group")).toHaveLength(5);
        expect(screen.queryByText("Streamer Six")).toBeNull();
    });

    it("respects collapseAfter option", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: mockChannels },
            error: undefined,
        });
        const { container, unmount } = render({ collapseAfter: 2 });
        expect(container.querySelectorAll(".group")).toHaveLength(2);
        unmount();

        const { container: containerAll } = render({ collapseAfter: -1 });
        expect(containerAll.querySelectorAll(".group")).toHaveLength(6);
        expect(screen.getByText("Streamer Six")).toBeInTheDocument();
        expect(screen.queryByText("livestreamer.showMore")).toBeNull();
    });

    it("filters out offline channels when hideOffline is true", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: mockChannels },
            error: undefined,
        });
        render({ hideOffline: true });

        expect(screen.getByText("Streamer One")).toBeInTheDocument();
        expect(screen.getByText("Streamer Four")).toBeInTheDocument();
        expect(screen.getByText("Streamer Six")).toBeInTheDocument();
        expect(screen.queryByText("Streamer Two")).toBeNull();
        expect(screen.queryByText("Streamer Five")).toBeNull();
    });

    it("shows no channels message when filtered list is empty", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: [mockChannels[1], mockChannels[4]] }, // only offline
            error: undefined,
        });
        render({ hideOffline: true });

        expect(screen.getByText("livestreamer.noChannels")).toBeInTheDocument();
    });

    it("falls back to platform icon when avatarUrl fails to load or is missing", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: [{ ...mockChannels[0], avatarUrl: undefined }] },
            error: undefined,
        });
        const { container } = render();
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("shows category and stream title tooltip next to mouse cursor on hover when live", () => {
        useWidgetAPI.mockReturnValue({
            data: { channels: [mockChannels[0]] },
            error: undefined,
        });
        const { container } = render();
        const liveRow = container.querySelector(".group")!;

        // Before hover, tooltip with fixed positioning is not rendered
        expect(document.body.querySelector('[style*="position: fixed"]')).toBeNull();

        // Mouse enter at x: 200, y: 150
        fireEvent.mouseEnter(liveRow, { clientX: 200, clientY: 150 });

        const tooltip = document.body.querySelector('[style*="position: fixed"]');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveStyle({ position: "fixed" });
        expect(tooltip).toHaveTextContent("Just Chatting");
        expect(tooltip).toHaveTextContent("Chilling and chatting today");

        // Mouse move updates position
        fireEvent.mouseMove(liveRow, { clientX: 250, clientY: 200 });
        expect(tooltip).toHaveStyle({ left: "266px", top: "216px" });

        // Mouse leave hides tooltip
        fireEvent.mouseLeave(liveRow);
        expect(document.body.querySelector('[style*="position: fixed"]')).toBeNull();
    });
});
