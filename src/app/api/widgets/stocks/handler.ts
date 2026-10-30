import { firstQueryValue, numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/config";
import createLogger from "@/utils/logger";
import { cachedRequest } from "@/utils/proxy/http";

const logger = createLogger("stocks");

// Current price and percent change; both are null when Finnhub has no quote for the ticker
type FinnhubQuote = { c: number | null; dp: number | null };

async function handler(req: ApiRequest, res: ApiResponse) {
    const { watchlist, provider, cache } = req.query;

    logger.debug("Stocks API request: %o", { watchlist, provider, cache });

    const watchlistValue = firstQueryValue(watchlist);
    if (!watchlistValue) {
        return res.status(400).json({ error: "Missing watchlist" });
    }

    const watchlistArr = watchlistValue.split(",");

    if (!watchlistArr.length || watchlistArr[0] === "null" || !watchlistArr[0]) {
        return res.status(400).json({ error: "Missing watchlist" });
    }

    if (watchlistArr.length > 8) {
        return res.status(400).json({ error: "Max items in watchlist is 8" });
    }

    const hasDuplicates = new Set(watchlistArr).size !== watchlistArr.length;

    if (hasDuplicates) {
        return res.status(400).json({ error: "Watchlist contains duplicates" });
    }

    if (!provider) {
        return res.status(400).json({ error: "Missing provider" });
    }

    if (provider !== "finnhub") {
        return res.status(400).json({ error: "Invalid provider" });
    }

    const providersInConfig = getSettings()?.providers ?? {};

    let apiKey: string | undefined;
    Object.entries(providersInConfig).forEach(([key, val]) => {
        if (key === provider) apiKey = val as string;
    });

    if (typeof apiKey === "undefined") {
        return res.status(400).json({ error: "Missing or invalid API Key for provider" });
    }

    if (provider === "finnhub") {
        // Finnhub allows up to 30 calls/second
        // https://finnhub.io/docs/api/rate-limit
        const results = await Promise.all(
            watchlistArr.map(async (ticker) => {
                if (!ticker) {
                    return { ticker: null, currentPrice: null, percentChange: null };
                }
                // https://finnhub.io/docs/api/quote
                const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`;
                // Finnhub free accounts allow up to 60 calls/minute
                // https://finnhub.io/pricing
                const { c, dp } = (await cachedRequest(apiUrl, numericQueryValue(cache) || 1)) as FinnhubQuote;
                logger.debug("Finnhub API response for %s: %o", ticker, { c, dp });

                // API sometimes returns 200, but values returned are `null`
                if (c === null || dp === null) {
                    return { ticker, currentPrice: null, percentChange: null };
                }

                // Rounding percentage, but we want it back to a number for comparison
                return { ticker, currentPrice: c.toFixed(2), percentChange: parseFloat(dp.toFixed(2)) };
            })
        );

        return res.send({
            stocks: results,
        });
    }

    /* c8 ignore next 2 -- provider validation above currently makes this unreachable */
    return res.status(400).json({ error: "Invalid configuration" });
}

export default withAuth(handler);
