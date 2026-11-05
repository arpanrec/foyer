import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import cache from "@/utils/cache";
import getServiceWidget from "@/utils/config/service-helpers";
import { byDateDesc } from "@/utils/dates";
import { errorMessage } from "@/utils/error";
import { allowImageUrl } from "@/utils/image-allowlist";
import createLogger from "@/utils/logger";
import { sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { foyerUserAgent } from "@/utils/proxy/user-agent";
import type { FeedItem, FeedOptions } from "@/widgets/feed/types";
import { httpUrl, isYouTubeShort, parseFeed } from "@/widgets/feed/utils";

const logger = createLogger("feedProxyHandler");
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

type FeedFetched = { items: FeedItem[] };
type FeedFailed = { status: number; error: { message: string; url: string } };

// Thrown by the loader so that everyone waiting on the same feed gets the failure, which is never cached
class FeedFailure extends Error {
    constructor(readonly failure: FeedFailed) {
        super(failure.error.message);
    }
}

/**
 * Downloads and parses one feed.
 *
 * @param url The feed URL.
 * @returns The feed items.
 */
async function loadFeed(url: URL): Promise<FeedItem[]> {
    const [status, , data] = await httpProxy(url, {
        headers: {
            "User-Agent": foyerUserAgent(url),
            Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
        },
    });

    if (status !== 200) {
        logger.debug("HTTP %d retrieving feed %s", status, url.href);
        throw new FeedFailure({ status, error: { message: "HTTP Error", url: sanitizeErrorURL(url) } });
    }

    try {
        return parseFeed(Buffer.from(data as Uint8Array).toString());
    } catch (e) {
        logger.error("Error parsing feed %s: %s", url.host, errorMessage(e));
        logger.debug("Error parsing feed %s: %s", url.href, errorMessage(e));
        throw new FeedFailure({ status: 500, error: { message: "Invalid feed", url: sanitizeErrorURL(url) } });
    }
}

/**
 * Fetches and parses one feed, serving it from the cache when caching is on.
 *
 * @param url The feed URL.
 * @param cacheMs Cache lifetime in milliseconds, 0 to skip the cache.
 * @returns The items, or the HTTP status and error to answer with.
 */
async function fetchFeed(url: URL, cacheMs: number): Promise<FeedFetched | FeedFailed> {
    try {
        // only successful fetches are cached, and a TTL of 0 fetches on every request
        const items =
            cacheMs > 0
                ? await cache.getOrFetch(`feed:${url.href}`, () => loadFeed(url), {
                      type: "feed",
                      ttlMs: cacheMs,
                      label: `feed ${url.href}`,
                  })
                : await loadFeed(url);
        return { items: items ?? [] };
    } catch (e) {
        if (e instanceof FeedFailure) return e.failure;
        throw e;
    }
}

const LINK_TARGETS = ["item", "comments"];

/**
 * Answers a feed widget request with the merged, filtered and sorted items of its configured feeds.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
export default async function feedProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const widget = (await getServiceWidget(group, service, index)) as (WidgetConfig & FeedOptions) | undefined;

    if (widget?.url && widget?.urls) {
        logger.warn("url and urls are mutually exclusive for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "url and urls are mutually exclusive" });
    }

    if (widget?.urls && !Array.isArray(widget.urls)) {
        logger.warn("urls must be a list for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "urls must be a list" });
    }

    const linkTo = widget?.linkTo ?? "item";
    if (!LINK_TARGETS.includes(linkTo)) {
        logger.warn("linkTo must be item or comments for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "linkTo must be item or comments" });
    }

    // milliseconds to keep each fetched feed, 0 fetches on every request
    const cacheMs = widget?.cache === undefined ? DEFAULT_CACHE_MS : Number(widget.cache);
    if (!Number.isFinite(cacheMs) || cacheMs < 0) {
        logger.warn("cache must be a number of milliseconds, 0 or more for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "cache must be a number of milliseconds, 0 or more" });
    }

    const configured = widget?.urls ?? (widget?.url ? [widget.url] : []);
    if (!Array.isArray(configured) || !configured.length) {
        logger.warn("Missing feed URL for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Missing feed URL" });
    }

    const candidates: unknown[] = configured;
    const parsed = candidates.map((value) => (typeof value === "string" ? httpUrl(value) : null));
    const hrefs = parsed.filter((href): href is string => !!href);
    if (hrefs.length !== parsed.length) {
        logger.warn("Invalid feed URL for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid feed URL" });
    }

    const results = await Promise.all(
        hrefs.map(async (href) => {
            const feedResult = await fetchFeed(new URL(href), cacheMs);
            return { href, feedResult };
        })
    );
    const fetched = results.filter(
        (entry): entry is { href: string; feedResult: FeedFetched } => "items" in entry.feedResult
    );

    // a single failing feed only fails the widget when nothing else loaded; with at least one URL and every result
    // either items or an error, nothing loaded means there is a failure to report
    const [failure] = results.flatMap(({ feedResult }) => ("error" in feedResult ? [feedResult] : []));
    if (!fetched.length && failure) {
        return res.status(failure.status).json({ error: failure.error });
    }

    const disableYouTubeShorts = widget?.disableYouTubeShorts !== false && widget?.disableYouTubeShorts !== "false";

    let items = fetched.flatMap(({ href, feedResult }) => {
        if (href.startsWith("https://www.youtube.com/") && disableYouTubeShorts) {
            return feedResult.items.filter((item) => !isYouTubeShort(item));
        }
        return feedResult.items;
    });
    if (hrefs.length > 1) {
        items = [...items].sort(byDateDesc);
    }

    const limit = parseInt(String(widget?.maxItems), 10);
    const maxItems = limit > 0 ? limit : 5;
    const showImages = widget?.images !== false && widget?.images !== "false";

    const shown = items.slice(0, maxItems).map(({ image, comments, ...item }) => ({
        ...item,
        // items without a comments page keep their own link
        ...(linkTo === "comments" && comments ? { link: comments } : {}),
        ...(showImages && image ? { image } : {}),
    }));
    // the browser loads these images through /api/icon-proxy, which only fetches addresses recorded here
    await Promise.all(shown.map((item) => allowImageUrl("image" in item ? item.image : undefined, { external: true })));

    return res.status(200).json({ items: shown });
}
