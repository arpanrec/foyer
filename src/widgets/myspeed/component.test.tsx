// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";
import { expectBlockValue } from "@/test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("@/utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "@/widgets/myspeed/component";

describe("widgets/myspeed/component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders placeholders while loading", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

        const { container } = renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(container.querySelectorAll(".service-block")).toHaveLength(3);
        expect(screen.getByText("myspeed.download")).toBeInTheDocument();
        expect(screen.getByText("myspeed.upload")).toBeInTheDocument();
        expect(screen.getByText("myspeed.ping")).toBeInTheDocument();
    });

    it("renders error UI when endpoint errors", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

        renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
        expect(screen.getByText("nope")).toBeInTheDocument();
    });

    it("renders the proxy error, not a crash, when the upstream call fails", () => {
        // useWidgetAPI lifts the proxy's { error } into error but still returns the object as data
        const proxyError = { message: "HTTP Error", url: "myspeed.local (see logs for details)" };
        useWidgetAPI.mockReturnValue({ data: { error: proxyError }, error: proxyError });

        renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
        expect(screen.getByText("HTTP Error")).toBeInTheDocument();
    });

    it("renders the message MySpeed answers with", () => {
        useWidgetAPI.mockReturnValue({ data: { message: "Invalid password" }, error: undefined });

        renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
        expect(screen.getByText("Invalid password")).toBeInTheDocument();
    });

    it("renders the error of the latest speed test", () => {
        useWidgetAPI.mockReturnValue({
            data: [{ download: 0, upload: 0, ping: 0, error: '{"message":"Speedtest failed"}' }],
            error: undefined,
        });

        renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(screen.getByText("Speedtest failed")).toBeInTheDocument();
    });

    it("renders placeholders when there are no speed tests yet", () => {
        useWidgetAPI.mockReturnValue({ data: [], error: undefined });

        const { container } = renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        expect(container.querySelectorAll(".service-block")).toHaveLength(3);
        expect(screen.queryByText(/widget\.api_error/i)).not.toBeInTheDocument();
    });

    it("renders download, upload and ping when loaded", () => {
        useWidgetAPI.mockReturnValue({ data: [{ download: 1, upload: 2, ping: 3 }], error: undefined });

        const { container } = renderWithProviders(<Component service={{ widget: { type: "myspeed" } }} />, {
            settings: { hideErrors: false },
        });

        // t("common.bitrate") returns the raw value from setup; widget multiplies by 1e6.
        expectBlockValue(container, "myspeed.download", 1000 * 1000);
        expectBlockValue(container, "myspeed.upload", 2 * 1000 * 1000);
        expectBlockValue(container, "myspeed.ping", 3);
    });
});
