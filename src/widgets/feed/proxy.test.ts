import cache from "memory-cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";
import type { FeedResponseItem } from "@/widgets/feed/types";

type FeedBody = { items: FeedResponseItem[]; error?: unknown };

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    logger: {
        debug: vi.fn(),
    },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));

vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));

import feedProxyHandler from "@/widgets/feed/proxy";

const items = Array.from(
    { length: 7 },
    (_, i) => `<item><title>Item ${i}</title><link>https://example.com/${i}</link>
    <media:thumbnail url="https://example.com/${i}.jpg" /></item>`
).join("");
const feed = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>${items}</channel></rss>`;

const req = { query: { group: "g", service: "svc", index: "0" } };

describe("widgets/feed/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cache.clear();
    });

    it("returns 400 when the url is missing or invalid", async () => {
        getServiceWidget.mockResolvedValueOnce({ type: "feed" });
        let res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Missing feed URL" });

        getServiceWidget.mockResolvedValueOnce({ type: "feed", url: "nope" });
        res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Invalid feed URL" });

        getServiceWidget.mockResolvedValueOnce({ type: "feed", url: "file:///etc/passwd" });
        res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Invalid feed URL" });
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("returns the first 5 items by default", async () => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml" });
        httpProxy.mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(feed)]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(httpProxy.mock.calls[0][0].href).toBe("https://example.com/feed.xml");
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(5);
        expect(res.body.items[0]).toEqual({
            title: "Item 0",
            link: "https://example.com/0",
            date: null,
            image: "https://example.com/0.jpg",
        });
    });

    it.each([-1, 0, "abc"])("falls back to 5 items for maxItems %j", async (maxItems) => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml", maxItems });
        httpProxy.mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(feed)]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(res.body.items).toHaveLength(5);
    });

    it("respects maxItems and drops images when disabled", async () => {
        getServiceWidget.mockResolvedValue({
            type: "feed",
            url: "https://example.com/feed.xml",
            maxItems: "2",
            images: false,
        });
        httpProxy.mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(feed)]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(res.body.items).toEqual([
            { title: "Item 0", link: "https://example.com/0", date: null },
            { title: "Item 1", link: "https://example.com/1", date: null },
        ]);
    });

    it("links to the comments page when linkTo is comments, falling back to the item link", async () => {
        const discussed = `<rss><channel>
      <item><title>Discussed</title><link>https://example.com/a</link><comments>https://news.example.com/a</comments></item>
      <item><title>Plain</title><link>https://example.com/b</link></item>
    </channel></rss>`;
        getServiceWidget
            .mockResolvedValueOnce({ type: "feed", url: "https://example.com/feed.xml" })
            .mockResolvedValueOnce({ type: "feed", url: "https://example.com/feed.xml", linkTo: "comments" });
        httpProxy.mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(discussed)]);

        const byItem = createMockRes<FeedBody>();
        await feedProxyHandler(req, byItem as ApiResponse);
        const byComments = createMockRes<FeedBody>();
        await feedProxyHandler(req, byComments as ApiResponse);

        expect(byItem.body.items.map((item) => item.link)).toEqual(["https://example.com/a", "https://example.com/b"]);
        expect(byComments.body.items.map((item) => item.link)).toEqual([
            "https://news.example.com/a",
            "https://example.com/b",
        ]);
        expect(byComments.body.items.every((item) => !("comments" in item))).toBe(true);
        expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("returns 400 for an unknown linkTo value", async () => {
        getServiceWidget.mockResolvedValueOnce({
            type: "feed",
            url: "https://example.com/feed.xml",
            linkTo: "discussion",
        });
        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "linkTo must be item or comments" });
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid cache value", async () => {
        for (const cacheValue of ["soon", -1]) {
            getServiceWidget.mockResolvedValueOnce({
                type: "feed",
                url: "https://example.com/feed.xml",
                cache: cacheValue,
            });
            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ error: "cache must be a number of milliseconds, 0 or more" });
        }
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("keeps a feed for the configured number of milliseconds", async () => {
        const put = vi.spyOn(cache, "put");
        getServiceWidget.mockResolvedValueOnce({ type: "feed", url: "https://example.com/feed.xml", cache: "5000" });
        httpProxy.mockResolvedValue([200, "application/rss+xml", Buffer.from(feed)]);

        await feedProxyHandler(req, createMockRes<FeedBody>() as ApiResponse);

        expect(put).toHaveBeenCalledWith("feed:https://example.com/feed.xml", expect.any(Array), 5000);
        put.mockRestore();
    });

    it("fetches on every request when cache is 0", async () => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml", cache: 0 });
        httpProxy.mockResolvedValue([200, "application/rss+xml", Buffer.from(feed)]);

        await feedProxyHandler(req, createMockRes<FeedBody>() as ApiResponse);
        await feedProxyHandler(req, createMockRes<FeedBody>() as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(cache.size()).toBe(0);
    });

    it("passes through http errors without leaking the url", async () => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml?token=secret" });
        httpProxy.mockResolvedValueOnce([404, "text/html", Buffer.from("Not found")]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: { message: "HTTP Error", url: "example.com (see logs for details)" } });
    });

    it("never includes any part of the configured url in the response", async () => {
        getServiceWidget.mockResolvedValue({
            type: "feed",
            url: "https://user:hunter2@nas.lan/feeds/s3cr3t/rss.xml?token=abc123",
        });
        const relative = `<rss><channel>
      <item><title>Path</title><link>item/1</link><enclosure url="img.jpg" type="image/jpeg" /></item>
      <item><title>Root</title><link>/x</link></item>
      <item><title>Fragment</title><link>#top</link></item>
    </channel></rss>`;
        httpProxy.mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(relative)]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(res.body.items.map((item) => item.link)).toEqual([null, null, null]);
        expect(JSON.stringify(res.body)).not.toMatch(/user|hunter2|nas\.lan|s3cr3t|token|abc123/);
    });

    it("returns 500 for unparseable feeds", async () => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml" });
        httpProxy.mockResolvedValueOnce([200, "text/html", Buffer.from("<html></html>")]);

        const res = createMockRes<FeedBody>();
        await feedProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: { message: "Invalid feed", url: "example.com (see logs for details)" } });
    });

    it("shares one cached fetch across widgets with different options", async () => {
        getServiceWidget
            .mockResolvedValueOnce({ type: "feed", url: "https://example.com/feed.xml", maxItems: 1 })
            .mockResolvedValueOnce({ type: "feed", url: "https://example.com/feed.xml", images: false });
        httpProxy.mockResolvedValue([200, "application/rss+xml", Buffer.from(feed)]);

        const first = createMockRes<FeedBody>();
        await feedProxyHandler(req, first as ApiResponse);
        const second = createMockRes<FeedBody>();
        await feedProxyHandler(req, second as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(first.body.items).toHaveLength(1);
        expect(second.body.items).toHaveLength(5);
        expect(second.body.items[0].image).toBeUndefined();
    });

    it("does not cache failures", async () => {
        getServiceWidget.mockResolvedValue({ type: "feed", url: "https://example.com/feed.xml" });
        httpProxy
            .mockResolvedValueOnce([404, "text/html", Buffer.from("Not found")])
            .mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(feed)]);

        const failed = createMockRes<FeedBody>();
        await feedProxyHandler(req, failed as ApiResponse);
        const recovered = createMockRes<FeedBody>();
        await feedProxyHandler(req, recovered as ApiResponse);

        expect(failed.statusCode).toBe(404);
        expect(recovered.statusCode).toBe(200);
        expect(httpProxy).toHaveBeenCalledTimes(2);
    });

    describe("urls", () => {
        const dated = (name: string, days: number[]) =>
            Buffer.from(
                `<rss><channel>${days
                    .map(
                        (day) => `<item><title>${name} ${day}</title><link>https://example.com/${name}/${day}</link>
            <pubDate>2026-10-${String(day).padStart(2, "0")}T00:00:00Z</pubDate></item>`
                    )
                    .join("")}</channel></rss>`
            );

        it("rejects url and urls together, non-list urls and invalid entries", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "feed",
                url: "https://example.com/a.xml",
                urls: ["https://example.com/b.xml"],
            });
            let res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ error: "url and urls are mutually exclusive" });

            getServiceWidget.mockResolvedValueOnce({ type: "feed", urls: "https://example.com/a.xml" });
            res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ error: "urls must be a list" });

            getServiceWidget.mockResolvedValueOnce({ type: "feed", urls: [] });
            res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ error: "Missing feed URL" });

            getServiceWidget.mockResolvedValueOnce({
                type: "feed",
                urls: ["https://example.com/a.xml", "file:///etc/passwd"],
            });
            res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ error: "Invalid feed URL" });

            expect(httpProxy).not.toHaveBeenCalled();
        });

        it("merges feeds newest first and applies maxItems after merging", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                urls: ["https://example.com/a.xml", "https://example.com/b.xml"],
                maxItems: 4,
            });
            httpProxy.mockImplementation(async (url) => [
                200,
                "application/rss+xml",
                url.href.endsWith("a.xml") ? dated("a", [1, 5, 3]) : dated("b", [4, 2, 6]),
            ]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(httpProxy).toHaveBeenCalledTimes(2);
            expect(res.statusCode).toBe(200);
            expect(res.body.items.map((item) => item.title)).toEqual(["b 6", "a 5", "b 4", "a 3"]);
        });

        it("keeps undated items after dated ones", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                urls: ["https://example.com/a.xml", "https://example.com/b.xml"],
            });
            httpProxy
                .mockResolvedValueOnce([200, "application/rss+xml", Buffer.from(feed)])
                .mockResolvedValueOnce([200, "application/rss+xml", dated("b", [1])]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.body.items.map((item) => item.title)).toEqual(["b 1", "Item 0", "Item 1", "Item 2", "Item 3"]);
        });

        it("skips failing feeds while any feed loads, and errors when none do", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                urls: ["https://example.com/down.xml?token=secret", "https://example.com/b.xml"],
            });
            httpProxy.mockImplementation(async (url) =>
                url.pathname === "/down.xml"
                    ? [503, "text/html", Buffer.from("down")]
                    : [200, "application/rss+xml", dated("b", [1, 2])]
            );

            const partial = createMockRes<FeedBody>();
            await feedProxyHandler(req, partial as ApiResponse);
            expect(partial.statusCode).toBe(200);
            expect(partial.body.items.map((item) => item.title)).toEqual(["b 2", "b 1"]);

            cache.clear();
            httpProxy.mockImplementation(async (url) =>
                url.pathname === "/down.xml"
                    ? [503, "text/html", Buffer.from("down")]
                    : [200, "text/html", Buffer.from("<html></html>")]
            );

            const failed = createMockRes<FeedBody>();
            await feedProxyHandler(req, failed as ApiResponse);
            expect(failed.statusCode).toBe(503);
            expect(failed.body).toEqual({
                error: { message: "HTTP Error", url: "example.com (see logs for details)" },
            });
            expect(JSON.stringify(failed.body)).not.toMatch(/secret|down\.xml/);
        });

        it("shares the per-url cache with single url widgets", async () => {
            getServiceWidget
                .mockResolvedValueOnce({ type: "feed", url: "https://example.com/a.xml" })
                .mockResolvedValueOnce({
                    type: "feed",
                    urls: ["https://example.com/a.xml", "https://example.com/b.xml"],
                });
            httpProxy.mockImplementation(async (url) => [
                200,
                "application/rss+xml",
                url.href.endsWith("a.xml") ? dated("a", [1]) : dated("b", [2]),
            ]);

            await feedProxyHandler(req, createMockRes<FeedBody>() as ApiResponse);
            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(httpProxy.mock.calls.map(([url]) => url.pathname)).toEqual(["/a.xml", "/b.xml"]);
            expect(res.body.items.map((item) => item.title)).toEqual(["b 2", "a 1"]);
        });

        it("drops images from merged items when disabled", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                urls: ["https://example.com/feed.xml", "https://example.com/b.xml"],
                images: "false",
            });
            httpProxy.mockImplementation(async (url) => [
                200,
                "application/rss+xml",
                url.href.endsWith("feed.xml") ? Buffer.from(feed) : dated("b", [1]),
            ]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.body.items.every((item) => !("image" in item))).toBe(true);
        });
    });

    describe("YouTube Shorts filtering", () => {
        const youtubeAtomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>YouTube Channel</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UC123" />
  <entry>
    <title>Long Video 1</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=long1" />
    <published>2026-10-24T12:00:00Z</published>
  </entry>
  <entry>
    <title>Short Video 1</title>
    <link rel="alternate" href="https://www.youtube.com/shorts/short1" />
    <published>2026-10-24T11:00:00Z</published>
  </entry>
  <entry>
    <title>Long Video 2</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=long2" />
    <published>2026-10-24T10:00:00Z</published>
  </entry>
</feed>`;

        it("filters out YouTube shorts by default when url starts with https://www.youtube.com/", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
            });
            httpProxy.mockResolvedValueOnce([200, "application/atom+xml", Buffer.from(youtubeAtomFeed)]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.map((i) => i.title)).toEqual(["Long Video 1", "Long Video 2"]);
            expect(res.body.items.every((i) => !i.link?.includes("/shorts/"))).toBe(true);
        });

        it("filters out YouTube shorts when disableYouTubeShorts is explicitly true", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
                disableYouTubeShorts: true,
            });
            httpProxy.mockResolvedValueOnce([200, "application/atom+xml", Buffer.from(youtubeAtomFeed)]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.map((i) => i.title)).toEqual(["Long Video 1", "Long Video 2"]);
        });

        it.each([false, "false"])(
            "includes YouTube shorts when disableYouTubeShorts is %j",
            async (disableYouTubeShorts) => {
                getServiceWidget.mockResolvedValue({
                    type: "feed",
                    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
                    disableYouTubeShorts,
                });
                httpProxy.mockResolvedValueOnce([200, "application/atom+xml", Buffer.from(youtubeAtomFeed)]);

                const res = createMockRes<FeedBody>();
                await feedProxyHandler(req, res as ApiResponse);

                expect(res.statusCode).toBe(200);
                expect(res.body.items.map((i) => i.title)).toEqual(["Long Video 1", "Short Video 1", "Long Video 2"]);
            }
        );

        it("does not filter shorts when the feed url does not start with https://www.youtube.com/", async () => {
            getServiceWidget.mockResolvedValue({
                type: "feed",
                url: "https://example.com/videos.xml",
            });
            httpProxy.mockResolvedValueOnce([200, "application/atom+xml", Buffer.from(youtubeAtomFeed)]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.map((i) => i.title)).toEqual(["Long Video 1", "Short Video 1", "Long Video 2"]);
        });

        it("applies disableYouTubeShorts selectively to YouTube feeds in urls", async () => {
            const otherFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Other Short</title>
    <link rel="alternate" href="https://example.com/shorts/other" />
    <published>2026-10-24T13:00:00Z</published>
  </entry>
</feed>`;

            getServiceWidget.mockResolvedValue({
                type: "feed",
                urls: ["https://www.youtube.com/feeds/videos.xml?channel_id=UC123", "https://example.com/other.xml"],
            });

            httpProxy.mockImplementation(async (url) => [
                200,
                "application/atom+xml",
                url.href.includes("youtube.com") ? Buffer.from(youtubeAtomFeed) : Buffer.from(otherFeed),
            ]);

            const res = createMockRes<FeedBody>();
            await feedProxyHandler(req, res as ApiResponse);

            expect(res.statusCode).toBe(200);
            const titles = res.body.items.map((i) => i.title);
            expect(titles).toContain("Other Short");
            expect(titles).toContain("Long Video 1");
            expect(titles).toContain("Long Video 2");
            expect(titles).not.toContain("Short Video 1");
        });
    });
});
