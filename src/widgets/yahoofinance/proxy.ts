import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import type { MarketConfig } from "@/widgets/yahoofinance/types";
import { fetchMarkets } from "@/widgets/yahoofinance/yahoo";

const logger = createLogger("yahooFinanceProxyHandler");
const DEFAULT_CACHE_MINUTES = 5;

/**
 * Answers a Yahoo Finance widget request with the configured markets' prices and changes, skipping markets with a blank symbol or a non-string name.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
export default async function yahooFinanceProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);
    if (!widget || widget.type !== "yahoofinance") {
        logger.warn("Service '%s' in group '%s' has no yahoofinance widget", service, group);
        return res.status(403).json({ error: "Service does not support API calls" });
    }

    const where = `of service "${String(service)}" in group "${String(group)}"`;
    const configured: unknown[] = Array.isArray(widget["markets"]) ? widget["markets"] : [];
    const markets = configured.filter((m): m is MarketConfig => {
        const valid = typeof m === "object" && m !== null && typeof (m as MarketConfig).symbol === "string";
        if (!valid || !(m as MarketConfig).symbol.trim()) {
            logger.warn("The yahoofinance widget %s has a market without a symbol; it was skipped", where);
            return false;
        }
        const name = (m as MarketConfig).name;
        if (name !== undefined && name !== null && typeof name !== "string") {
            logger.warn("The yahoofinance widget %s has a market with a non-string name; it was skipped", where);
            return false;
        }
        return true;
    });

    if (!markets.length) {
        logger.warn("The yahoofinance widget %s has no markets", where);
        return res.status(400).json({ error: "Missing markets" });
    }

    const cacheOption = widget["cache"];
    const cacheMinutes = typeof cacheOption === "number" && cacheOption > 0 ? cacheOption : DEFAULT_CACHE_MINUTES;

    const results = await fetchMarkets(markets, cacheMinutes, widget["sortBy"], where);
    if (!results.length) {
        return res.status(500).json({ error: "Could not fetch any market from Yahoo Finance" });
    }

    return res.send({ markets: results });
}
