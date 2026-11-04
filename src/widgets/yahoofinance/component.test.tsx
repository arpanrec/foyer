// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("@/utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "@/widgets/yahoofinance/component";

const service = { widget: { type: "yahoofinance", service_group: "G", service_name: "S", index: 0 } };

const market = {
    symbol: "TCS.NS",
    name: "TCS",
    currency: "INR",
    price: 3500,
    percentChange: -1.5,
    absoluteChange: -50,
    points: [],
};

describe("widgets/yahoofinance/component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the loading state", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
        renderWithProviders(<Component service={service} />);
        expect(screen.getByText("yahoofinance.loading")).toBeInTheDocument();
    });

    it("renders an error", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });
        renderWithProviders(<Component service={service} />);
        expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    });

    it("renders a price that has no currency", () => {
        useWidgetAPI.mockReturnValue({ data: { markets: [{ ...market, currency: null }] }, error: undefined });
        renderWithProviders(<Component service={service} />);

        expect(screen.getByText("3500")).toBeInTheDocument();
    });

    it("renders the name with the symbol as tooltip, price and change for each market", () => {
        useWidgetAPI.mockReturnValue({
            data: { markets: [market, { ...market, symbol: "X", name: "", price: null, percentChange: null }] },
            error: undefined,
        });
        renderWithProviders(<Component service={service} />);

        expect(screen.getByText("TCS")).toHaveAttribute("title", "TCS.NS");
        // without a name the symbol is the label
        expect(screen.getByText("X")).toHaveAttribute("title", "X");
        expect(screen.getByText("3500")).toBeInTheDocument();
        expect(screen.getByText("-1.50%")).toBeInTheDocument();
        expect(screen.getAllByText("widget.api_error")).toHaveLength(2);
    });
});
