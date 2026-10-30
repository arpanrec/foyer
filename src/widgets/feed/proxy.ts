import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { FeedItem, FeedOptions } from "@/widgets/feed/types";
import { httpUrl, isYouTubeShort, parseFeed } from "@/widgets/feed/utils";

const logger = createLogger("feedProxyHandler");
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

type FeedFetched = { items: FeedItem[] };
type FeedFailed = { status: number; error: { message: string; url: string } };

async function fetchFeed(url: URL, cacheMs: number): Promise<FeedFetched | FeedFailed> {
    const cacheKey = `feed:${url.href}`;
    const cached: FeedItem[] | null = cacheMs > 0 ? cache.get(cacheKey) : null;
    if (cached) return { items: cached };

    const [status, , data] = await httpProxy(url, {
        headers: {
            "User-Agent": `foyer/${process.env.NEXT_PUBLIC_VERSION || "dev"}`,
            Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
        },
    });

    if (status !== 200) {
        logger.debug("HTTP %d retrieving feed %s//%s%s", status, url.protocol, url.host, url.pathname);
        return { status, error: { message: "HTTP Error", url: sanitizeErrorURL(url) } };
    }

    let items: FeedItem[];
    try {
        items = parseFeed(Buffer.from(data as Uint8Array).toString());
    } catch (e) {
        logger.debug("Error parsing feed %s//%s%s: %s", url.protocol, url.host, url.pathname, errorMessage(e));
        return { status: 500, error: { message: "Invalid feed", url: sanitizeErrorURL(url) } };
    }

    // only successful fetches are cached
    if (cacheMs > 0) cache.put(cacheKey, items, cacheMs);
    return { items };
}

const LINK_TARGETS = ["item", "comments"];

// newest first, undated items last
const byDateDesc = (a: FeedItem, b: FeedItem) => (b.date ?? "").localeCompare(a.date ?? "");

export default async function feedProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const widget = (await getServiceWidget(group, service, index)) as (WidgetConfig & FeedOptions) | undefined;

    if (widget?.url && widget?.urls) {
        return res.status(400).json({ error: "url and urls are mutually exclusive" });
    }

    if (widget?.urls && !Array.isArray(widget.urls)) {
        return res.status(400).json({ error: "urls must be a list" });
    }

    const linkTo = widget?.linkTo ?? "item";
    if (!LINK_TARGETS.includes(linkTo)) {
        return res.status(400).json({ error: "linkTo must be item or comments" });
    }

    // milliseconds to keep each fetched feed, 0 fetches on every request
    const cacheMs = widget?.cache === undefined ? DEFAULT_CACHE_MS : Number(widget.cache);
    if (!Number.isFinite(cacheMs) || cacheMs < 0) {
        return res.status(400).json({ error: "cache must be a number of milliseconds, 0 or more" });
    }

    const configured = widget?.urls ?? (widget?.url ? [widget.url] : []);
    if (!Array.isArray(configured) || !configured.length) {
        return res.status(400).json({ error: "Missing feed URL" });
    }

    const candidates: unknown[] = configured;
    const parsed = candidates.map((value) => (typeof value === "string" ? httpUrl(value) : null));
    const hrefs = parsed.filter((href): href is string => !!href);
    if (hrefs.length !== parsed.length) {
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

    // a single failing feed only fails the widget when nothing else loaded
    if (!fetched.length) {
        const [{ feedResult }] = results.filter(
            (entry): entry is { href: string; feedResult: FeedFailed } => "error" in entry.feedResult
        );
        return res.status(feedResult.status).json({ error: feedResult.error });
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

    return res.status(200).json({
        items: items.slice(0, maxItems).map(({ image, comments, ...item }) => ({
            ...item,
            // items without a comments page keep their own link
            ...(linkTo === "comments" && comments ? { link: comments } : {}),
            ...(showImages && image ? { image } : {}),
        })),
    });
}
