import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getServiceWidget, fetchMarkets, logger } = vi.hoisted(() => ({
    getServiceWidget: vi.fn(),
    fetchMarkets: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/config/service-helpers", () => ({ default: getServiceWidget }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));
vi.mock("@/widgets/yahoofinance/yahoo", () => ({ fetchMarkets }));

import yahooFinanceProxyHandler from "@/widgets/yahoofinance/proxy";

type Body = { error?: string; markets?: unknown[] };

async function call(query: Record<string, string | undefined>) {
    const res = createMockRes<Body>();
    await yahooFinanceProxyHandler({ query }, res as ApiResponse);
    return res;
}

describe("widgets/yahoofinance/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects a request without group and service", async () => {
        expect((await call({})).statusCode).toBe(400);
    });

    it("rejects a service whose widget is not a markets widget", async () => {
        getServiceWidget.mockResolvedValue({ type: "stocks" });
        expect((await call({ group: "G", service: "S" })).statusCode).toBe(403);
    });

    it("rejects a widget without markets", async () => {
        getServiceWidget.mockResolvedValue({ type: "yahoofinance", markets: [{ name: "no symbol" }] });
        const res = await call({ group: "G", service: "S" });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe("Missing markets");
    });

    it("skips a market with a blank symbol or a non-string name", async () => {
        getServiceWidget.mockResolvedValue({
            type: "yahoofinance",
            markets: [{ symbol: "   " }, { symbol: "NVDA", name: { x: 1 } }],
        });
        const res = await call({ group: "G", service: "S" });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe("Missing markets");
        expect(logger.warn).toHaveBeenCalledTimes(3);
    });

    it("keeps a market without a name or with a string name", async () => {
        getServiceWidget.mockResolvedValue({
            type: "yahoofinance",
            markets: [{ symbol: "NVDA" }, { symbol: "AMD", name: "AMD" }],
        });
        fetchMarkets.mockResolvedValue([{ symbol: "NVDA" }]);
        await call({ group: "G", service: "S" });
        expect(fetchMarkets.mock.calls[0]![0]).toHaveLength(2);
    });

    it("rejects a widget whose markets is not a list", async () => {
        getServiceWidget.mockResolvedValue({ type: "yahoofinance", markets: "NVDA" });
        const res = await call({ group: "G", service: "S" });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe("Missing markets");
    });

    it("returns 500 when no market could be fetched", async () => {
        getServiceWidget.mockResolvedValue({ type: "yahoofinance", markets: [{ symbol: "A" }] });
        fetchMarkets.mockResolvedValue([]);
        expect((await call({ group: "G", service: "S" })).statusCode).toBe(500);
    });

    it("fetches the configured markets with the widget's cache and sortBy", async () => {
        getServiceWidget.mockResolvedValue({
            type: "yahoofinance",
            cache: 10,
            sortBy: "change",
            markets: [{ symbol: "TCS.NS" }, { symbol: "" }],
        });
        fetchMarkets.mockResolvedValue([{ symbol: "TCS.NS" }]);

        const res = await call({ group: "G", service: "S", index: "0" });
        expect(fetchMarkets).toHaveBeenCalledWith([{ symbol: "TCS.NS" }], 10, "change", expect.stringContaining('"S"'));
        expect(res.body.markets).toEqual([{ symbol: "TCS.NS" }]);
    });
});
