import { beforeEach, describe, expect, it, vi } from "vitest";

const { httpProxy, logger } = vi.hoisted(() => ({
    httpProxy: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/proxy/http", () => ({ httpProxy }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { seed } from "@/test-utils/cache";
import cache from "@/utils/cache";
import { fetchMarkets } from "@/widgets/yahoofinance/yahoo";

const chart = (closes: (number | null)[], price: number, extra: object = {}) => ({
    chart: {
        result: [
            {
                meta: { currency: "INR", regularMarketPrice: price, shortName: "Short", ...extra },
                indicators: { quote: [{ close: closes }] },
            },
        ],
    },
});
const ok = (body: unknown) => [200, {}, body];

describe("widgets/yahoofinance/yahoo", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("takes the price from the meta and the change from the second-to-last close", async () => {
        httpProxy.mockResolvedValue(ok(chart([90, 100, 105], 110)));

        const [market] = await fetchMarkets([{ symbol: "RELIANCE.NS" }], 5, undefined, "w");

        expect(httpProxy).toHaveBeenCalledWith(
            expect.stringContaining("/chart/RELIANCE.NS?range=1mo&interval=1d"),
            expect.objectContaining({ method: "GET" })
        );
        expect(market).toMatchObject({ symbol: "RELIANCE.NS", name: "Short", currency: "INR", price: 110 });
        expect(market?.percentChange).toBeCloseTo(10);
        expect(await cache.keys("response")).toEqual([expect.stringContaining("RELIANCE.NS")]);
    });

    it("uses the configured name, skips null closes, and has no change with a single close", async () => {
        httpProxy.mockResolvedValue(ok(chart([null, 100], 110)));

        const [market] = await fetchMarkets([{ symbol: "SPY", name: "S&P" }], 5, undefined, "w");

        expect(market).toMatchObject({ name: "S&P", price: 110, percentChange: null });
    });

    it("leaves out markets that fail and does not cache a failed response", async () => {
        httpProxy
            .mockResolvedValueOnce([429, {}, Buffer.from("Too Many Requests")])
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(ok({ chart: { result: null } }))
            .mockResolvedValueOnce(ok(chart([1, 2], 3)));

        const markets = await fetchMarkets(
            [{ symbol: "A" }, { symbol: "B" }, { symbol: "C" }, { symbol: "D" }],
            5,
            undefined,
            "w"
        );

        expect(markets.map((m) => m.symbol)).toEqual(["D"]);
        expect(logger.error).toHaveBeenCalledTimes(3);
        expect(await cache.size("response")).toBe(1);
    });

    it("serves a cached response without a request", async () => {
        await seed(
            "https://query1.finance.yahoo.com/v8/finance/chart/A?range=1mo&interval=1d|5",
            chart([100, 110], 110),
            "response"
        );

        const [market] = await fetchMarkets([{ symbol: "A" }], 5, undefined, "w");

        expect(httpProxy).not.toHaveBeenCalled();
        expect(market?.price).toBe(110);
    });

    it("sorts by change and by absolute change", async () => {
        httpProxy.mockImplementation(async (url: string) =>
            ok(
                url.includes("/A?")
                    ? chart([100, 101], 101)
                    : url.includes("/B?")
                      ? chart([100, 90], 90)
                      : chart([100, 100.5], 100.5)
            )
        );
        // each chart's second-to-last close is its first element, because the price is the newest bar
        const markets = [{ symbol: "A" }, { symbol: "B" }, { symbol: "C" }];

        expect((await fetchMarkets(markets, 5, "change", "w")).map((m) => m.symbol)).toEqual(["A", "C", "B"]);
        expect((await fetchMarkets(markets, 5, "absolute-change", "w")).map((m) => m.symbol)).toEqual(["B", "A", "C"]);

        await fetchMarkets(markets, 5, "nope", "w");
        expect(logger.warn).toHaveBeenCalled();
    });

    it("sends Node's own User-Agent, because Yahoo Finance rejects a browser one", async () => {
        httpProxy.mockResolvedValue(ok(chart([1, 2], 3)));

        await fetchMarkets([{ symbol: "A" }], 5, undefined, "w");

        const { headers } = httpProxy.mock.calls[0]![1] as { headers: Record<string, string> };
        expect(headers["User-Agent"]).toBe("node");
        expect(Object.keys(headers)).not.toContain("Origin");
    });

    it("parses a JSON body that arrives as a Buffer", async () => {
        httpProxy.mockResolvedValue(ok(Buffer.from(JSON.stringify(chart([100, 110], 110)))));

        const [market] = await fetchMarkets([{ symbol: "A" }], 5, undefined, "w");

        expect(market?.price).toBe(110);
    });

    it("copes with a result that has no closes, name, currency or previous close", async () => {
        httpProxy.mockResolvedValue(ok({ chart: { result: [{ meta: { regularMarketPrice: 50 } }] } }));

        const [market] = await fetchMarkets([{ symbol: "A" }], 5, undefined, "w");

        expect(market).toEqual({ symbol: "A", name: "", currency: null, price: 50, percentChange: null });
    });

    it("has no change when the previous close is zero", async () => {
        httpProxy.mockResolvedValue(ok(chart([0, 5], 5)));

        const [market] = await fetchMarkets([{ symbol: "A" }], 5, undefined, "w");

        expect(market?.percentChange).toBeNull();
    });

    it("sorts a market without a change after the others", async () => {
        httpProxy.mockImplementation(async (url: string) =>
            ok(
                url.includes("/A?") || url.includes("/D?")
                    ? chart([0, 5], 5)
                    : url.includes("/B?")
                      ? chart([100, 110], 110)
                      : chart([100, 80], 80)
            )
        );
        // two markets without a change, so each side of the comparison can be missing
        const markets = [{ symbol: "A" }, { symbol: "D" }, { symbol: "B" }, { symbol: "C" }];

        const bySymbol = async (sortBy: string) => (await fetchMarkets(markets, 5, sortBy, "w")).map((m) => m.symbol);
        expect((await bySymbol("change")).slice(0, 2)).toEqual(["B", "C"]);
        expect((await bySymbol("change")).slice(2).sort()).toEqual(["A", "D"]);
        expect((await bySymbol("absolute-change")).slice(0, 2)).toEqual(["C", "B"]);
        expect((await bySymbol("absolute-change")).slice(2).sort()).toEqual(["A", "D"]);
    });
});
