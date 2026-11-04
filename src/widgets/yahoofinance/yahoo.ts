import cache from "@/utils/cache";
import { errorMessage } from "@/utils/error";
import { loggableUrl } from "@/utils/loggable-url";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import type { Market, MarketConfig } from "@/widgets/yahoofinance/types";

const logger = createLogger("yahoofinance");

// Yahoo Finance answers a client that sends a browser User-Agent or Origin with 429, but not one that sends
// Node's own User-Agent, which is what the yahoo_finance_api2 library does through fetch()
const HEADERS = { "User-Agent": "node", Accept: "*/*" };

const MAX_TIMER_DELAY_MS = 2147483647;

type YahooChartResponse = {
    chart?: {
        result?:
            | {
                  meta?: { currency?: string; regularMarketPrice?: number; shortName?: string };
                  indicators?: { quote?: { close?: (number | null)[] }[] };
              }[]
            | null;
    };
};

/**
 * Builds the chart URL for a symbol on Yahoo's unofficial, key-less endpoint.
 *
 * @param symbol The ticker symbol.
 * @returns The URL for one month of daily bars.
 */
const chartUrl = (symbol: string) =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;

/**
 * Gets a chart from Yahoo.
 *
 * @param url The chart URL.
 * @returns The parsed body.
 */
async function fetchChart(url: string): Promise<YahooChartResponse> {
    const [status, , data] = await httpProxy(url, {
        method: "GET",
        headers: HEADERS,
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);

    return (Buffer.isBuffer(data) ? JSON.parse(data.toString()) : data) as YahooChartResponse;
}

/**
 * Fetches one market and computes its change against the previous daily close. A response is cached only after it parses.
 *
 * @param market The configured symbol and optional name.
 * @param cacheMinutes How long to cache the chart.
 * @param where Service and group, for log lines.
 * @returns The market, or null when it could not be fetched.
 */
async function fetchMarket(
    { symbol, name }: MarketConfig,
    cacheMinutes: number,
    where: string
): Promise<Market | null> {
    try {
        const url = chartUrl(symbol);
        // Only a response with a price is cached, so a 429, a bad body or an empty result is retried next time
        let uncached: YahooChartResponse | undefined;
        const body =
            (await cache.getOrFetch(
                // Services that share a symbol can set different cache durations, so the duration is part of the key
                `${url}|${cacheMinutes}`,
                async () => {
                    const fetched = await fetchChart(url);
                    if (typeof fetched.chart?.result?.[0]?.meta?.regularMarketPrice === "number") return fetched;
                    uncached = fetched;
                    return undefined;
                },
                // setTimeout treats a delay above 2147483647 ms as 1 ms, so the TTL is capped at that value
                {
                    type: "response",
                    ttlMs: Math.min(cacheMinutes * 60 * 1000, MAX_TIMER_DELAY_MS),
                    label: loggableUrl(url),
                }
            )) ?? uncached;
        const result = body?.chart?.result?.[0];
        const price = result?.meta?.regularMarketPrice;
        if (typeof price !== "number") {
            logger.error("Yahoo Finance returned no data for market %s %s", symbol, where);
            return null;
        }

        // The change is against the close before the newest daily bar. When the newest bar has no close yet, the
        // last close is the previous one. Without a baseline there is no change to show.
        const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];
        const closes = rawCloses.filter((c): c is number => typeof c === "number");
        const newestHasClose = typeof rawCloses[rawCloses.length - 1] === "number";
        const previous = closes[newestHasClose ? closes.length - 2 : closes.length - 1];

        return {
            symbol,
            name: name ?? result?.meta?.shortName ?? "",
            currency: result?.meta?.currency ?? null,
            price,
            percentChange: previous === undefined || previous === 0 ? null : ((price - previous) / previous) * 100,
        };
    } catch (e) {
        logger.error("Error getting market %s %s from Yahoo Finance: %s", symbol, where, errorMessage(e));
        logger.debug(e);
        return null;
    }
}

/**
 * Fetches every market, leaves out those that fail, and sorts by `sortBy`.
 *
 * @param markets The configured markets.
 * @param cacheMinutes How long to cache each chart.
 * @param sortBy `change`, `absolute-change`, or unset to keep the config order.
 * @param where Service and group, for log lines.
 * @returns The markets that were fetched.
 */
export async function fetchMarkets(
    markets: MarketConfig[],
    cacheMinutes: number,
    sortBy: unknown,
    where: string
): Promise<Market[]> {
    const fetched = (await Promise.all(markets.map((m) => fetchMarket(m, cacheMinutes, where)))).filter(
        (m): m is Market => m !== null
    );

    if (sortBy === "change") {
        fetched.sort((a, b) => (b.percentChange ?? -Infinity) - (a.percentChange ?? -Infinity));
    } else if (sortBy === "absolute-change") {
        // A null change has no magnitude, so it sorts after every measured change, including 0%
        const magnitude = (m: Market) => (m.percentChange === null ? -1 : Math.abs(m.percentChange));
        fetched.sort((a, b) => magnitude(b) - magnitude(a));
    } else if (sortBy !== undefined) {
        logger.warn('The yahoofinance widget %s has sortBy "%s"; use "change" or "absolute-change"', where, sortBy);
    }

    return fetched;
}
