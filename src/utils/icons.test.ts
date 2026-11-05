import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { httpProxy } = vi.hoisted(() => ({ httpProxy: vi.fn() }));

vi.mock("@/utils/proxy/http", () => ({ httpProxy }));
vi.mock("@/utils/logger", () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    return { default: () => logger };
});

import cache from "@/utils/cache";
import { getIcon, getRemoteImage, isIconName } from "@/utils/icons";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("utils/icons", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear("image");
    });

    afterEach(() => vi.useRealTimers());

    it("accepts plain icon names only", () => {
        expect(isIconName("home.svg")).toBe(true);
        expect(isIconName("adguard-home.png")).toBe(true);
        expect(isIconName("../x.svg")).toBe(false);
        expect(isIconName("a..b.svg")).toBe(false);
        expect(isIconName(".hidden")).toBe(false);
        expect(isIconName("a/b.svg")).toBe(false);
    });

    it("downloads mdi and simple-icons from the CDN once, then serves them from the cache", async () => {
        httpProxy.mockResolvedValue([200, "image/svg+xml", Buffer.from("<svg/>"), {}]);

        const mdi = await getIcon(["mdi", "home.svg"]);
        await getIcon(["mdi", "home.svg"]);
        const si = await getIcon(["si", "github.svg"]);

        expect(mdi).toEqual({ body: Buffer.from("<svg/>"), contentType: "image/svg+xml" });
        expect(si?.contentType).toBe("image/svg+xml");
        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(httpProxy.mock.calls[0]![0]).toBe("https://cdn.jsdelivr.net/npm/@mdi/svg@latest/svg/home.svg");
        expect(httpProxy.mock.calls[1]![0]).toBe("https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/github.svg");
    });

    it("returns undefined for unknown sets, bad formats and traversal without fetching", async () => {
        expect(await getIcon(["nope", "x.svg"])).toBeUndefined();
        expect(await getIcon(["mdi", "home.png"])).toBeUndefined();
        expect(await getIcon(["mdi", "svg", "home.svg"])).toBeUndefined();
        expect(await getIcon(["mdi", "..", "package.json"])).toBeUndefined();
        expect(await getIcon(["mdi", "../package.json"])).toBeUndefined();
        expect(await getIcon(["sh", "gif", "x.gif"])).toBeUndefined();
        expect(await getIcon(["di", "png", "x.svg"])).toBeUndefined();
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("fetches a dashboard icon once and serves it from the memory cache afterwards", async () => {
        httpProxy.mockResolvedValue([200, "image/png", PNG, {}]);

        const first = await getIcon(["di", "png", "plex.png"]);
        const second = await getIcon(["di", "png", "plex.png"]);

        expect(first?.body).toEqual(PNG);
        expect(second?.body).toEqual(PNG);
        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(httpProxy.mock.calls[0]![0]).toBe(
            "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/plex.png"
        );
    });

    it("sends a User-Agent with every download, Reddit's shape for Reddit hosts", async () => {
        httpProxy.mockResolvedValue([200, "image/png", PNG, {}]);

        await getRemoteImage("https://example.com/a.png");
        await getRemoteImage("https://external-preview.redd.it/a.jpeg");

        expect(httpProxy.mock.calls[0]![1].headers["User-Agent"]).toMatch(/^foyer\//);
        expect(httpProxy.mock.calls[1]![1].headers["User-Agent"]).toMatch(/^foyer:self-hosted-dashboard:/);
    });

    it("builds the selfh.st URL for sh icons", async () => {
        httpProxy.mockResolvedValue([200, "image/svg+xml", Buffer.from("<svg/>"), {}]);
        await getIcon(["sh", "svg", "plex.svg"]);
        expect(httpProxy.mock.calls[0]![0]).toBe("https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/plex.svg");
    });

    it("remembers a failed or non-image response for a few minutes, then tries again", async () => {
        vi.useFakeTimers();
        httpProxy.mockResolvedValueOnce([404, "text/html", Buffer.from("no"), {}]);
        expect(await getIcon(["di", "png", "missing.png"])).toBeUndefined();

        // a dead host is not asked again on the next requests
        expect(await getIcon(["di", "png", "missing.png"])).toBeUndefined();
        expect(await getIcon(["di", "png", "missing.png"])).toBeUndefined();
        expect(httpProxy).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(6 * 60 * 1000);
        httpProxy.mockResolvedValueOnce([200, "image/png", PNG, {}]);
        expect((await getIcon(["di", "png", "missing.png"]))?.body).toEqual(PNG);
        expect(httpProxy).toHaveBeenCalledTimes(2);
    });

    it("remembers a request that threw, such as a refused connection", async () => {
        httpProxy.mockRejectedValue([500, new Error("ECONNREFUSED")]);
        expect(await getIcon(["di", "png", "down.png"])).toBeUndefined();
        expect(await getIcon(["di", "png", "down.png"])).toBeUndefined();
        expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("does not retry a refresh on every request while the host is down, and serves the old copy", async () => {
        vi.useFakeTimers();
        httpProxy.mockResolvedValueOnce([200, "image/png", PNG, {}]);
        await getRemoteImage("http://nas.lan/stale.png", 60);

        vi.advanceTimersByTime(120_000);
        httpProxy.mockRejectedValue([500, new Error("ETIMEDOUT")]);
        expect((await getRemoteImage("http://nas.lan/stale.png", 60))?.body).toEqual(PNG);
        expect((await getRemoteImage("http://nas.lan/stale.png", 60))?.body).toEqual(PNG);
        expect(httpProxy).toHaveBeenCalledTimes(2);

        // after the retry delay the host is asked once more
        vi.advanceTimersByTime(6 * 60 * 1000);
        expect((await getRemoteImage("http://nas.lan/stale.png", 60))?.body).toEqual(PNG);
        expect(httpProxy).toHaveBeenCalledTimes(3);
    });

    describe("refresh, for a request with Cache-Control: no-cache", () => {
        const SVG = (text: string) => [200, "image/svg+xml", Buffer.from(text), {}];

        it("downloads a cached icon again and keeps the new copy for later requests", async () => {
            httpProxy.mockResolvedValueOnce(SVG("<svg>old</svg>"));
            await getIcon(["mdi", "home.svg"]);

            httpProxy.mockResolvedValueOnce(SVG("<svg>new</svg>"));
            expect((await getIcon(["mdi", "home.svg"], true))?.body.toString()).toBe("<svg>new</svg>");
            expect((await getIcon(["mdi", "home.svg"]))?.body.toString()).toBe("<svg>new</svg>");
            expect(httpProxy).toHaveBeenCalledTimes(2);
        });

        it("downloads an icon that was never cached", async () => {
            httpProxy.mockResolvedValueOnce(SVG("<svg/>"));

            expect((await getIcon(["mdi", "home.svg"], true))?.body.toString()).toBe("<svg/>");
            expect(httpProxy).toHaveBeenCalledTimes(1);
        });

        it("downloads again even while a failed download is remembered", async () => {
            httpProxy.mockResolvedValueOnce([404, "text/plain", Buffer.from("no"), {}]);
            expect(await getIcon(["mdi", "home.svg"])).toBeUndefined();
            expect(await getIcon(["mdi", "home.svg"])).toBeUndefined();
            expect(httpProxy).toHaveBeenCalledTimes(1);

            httpProxy.mockResolvedValueOnce(SVG("<svg/>"));
            expect((await getIcon(["mdi", "home.svg"], true))?.body.toString()).toBe("<svg/>");
            expect(httpProxy).toHaveBeenCalledTimes(2);
        });

        it("serves and keeps the old copy when the new download fails", async () => {
            httpProxy.mockResolvedValueOnce(SVG("<svg>old</svg>"));
            await getIcon(["mdi", "home.svg"]);

            httpProxy.mockResolvedValueOnce([503, "text/plain", Buffer.from("down"), {}]);
            expect((await getIcon(["mdi", "home.svg"], true))?.body.toString()).toBe("<svg>old</svg>");
            expect((await getIcon(["mdi", "home.svg"]))?.body.toString()).toBe("<svg>old</svg>");
            expect(httpProxy).toHaveBeenCalledTimes(2);
        });

        it("returns nothing when the download fails and there is no copy", async () => {
            httpProxy.mockRejectedValueOnce([500, new Error("refused")]);

            expect(await getIcon(["mdi", "home.svg"], true)).toBeUndefined();
        });

        it("downloads a remote image again", async () => {
            httpProxy.mockResolvedValueOnce([200, "image/png", PNG, {}]);
            await getRemoteImage("http://nas.lan/logo.png");

            const NEW = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]);
            httpProxy.mockResolvedValueOnce([200, "image/png", NEW, {}]);
            expect((await getRemoteImage("http://nas.lan/logo.png", undefined, false, true))?.body).toEqual(NEW);
            expect(httpProxy).toHaveBeenCalledTimes(2);
        });
    });

    describe("getRemoteImage", () => {
        it("rejects invalid and non-http URLs without fetching", async () => {
            expect(await getRemoteImage("not a url")).toBeUndefined();
            expect(await getRemoteImage("file:///etc/passwd")).toBeUndefined();
            expect(await getRemoteImage("ftp://example.com/x.png")).toBeUndefined();
            expect(httpProxy).not.toHaveBeenCalled();
        });

        it("fetches an image, keeps its content type and caches it", async () => {
            httpProxy.mockResolvedValue([200, "image/png; charset=binary", PNG, {}]);

            const first = await getRemoteImage("http://nas.lan/logo.png");
            const second = await getRemoteImage("http://nas.lan/logo.png");

            expect(first).toEqual({ body: PNG, contentType: "image/png" });
            expect(second).toEqual(first);
            expect(httpProxy).toHaveBeenCalledTimes(1);
        });

        it("asks for public hosts only when told the address came from third-party content", async () => {
            httpProxy.mockResolvedValue([200, "image/png", PNG, {}]);

            await getRemoteImage("https://feed.example/a.png", undefined, true);
            await getRemoteImage("http://nas.lan/logo.png");

            expect(httpProxy).toHaveBeenNthCalledWith(
                1,
                "https://feed.example/a.png",
                expect.objectContaining({ publicOnly: true })
            );
            expect(httpProxy).toHaveBeenNthCalledWith(
                2,
                "http://nas.lan/logo.png",
                expect.objectContaining({ publicOnly: false })
            );
        });

        it("judges the age of the shared copy by each caller's own maxAge", async () => {
            vi.useFakeTimers();
            httpProxy.mockResolvedValue([200, "image/png", PNG, {}]);
            await getRemoteImage("http://nas.lan/shared.png");
            expect(httpProxy).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(10_000);
            // a caller that allows no age at all downloads again ...
            await getRemoteImage("http://nas.lan/shared.png", 0);
            expect(httpProxy).toHaveBeenCalledTimes(2);
            // ... and does not shorten the copy for a caller that allows a day
            await getRemoteImage("http://nas.lan/shared.png");
            expect(httpProxy).toHaveBeenCalledTimes(2);
        });

        it("downloads again once the cached copy is older than maxAge, and keeps the old one if that fails", async () => {
            vi.useFakeTimers();
            httpProxy.mockResolvedValueOnce([200, "image/png", PNG, {}]);
            await getRemoteImage("http://nas.lan/p.png", 60);
            expect(httpProxy).toHaveBeenCalledTimes(1);

            // fresh: no download
            vi.advanceTimersByTime(30_000);
            await getRemoteImage("http://nas.lan/p.png", 60);
            expect(httpProxy).toHaveBeenCalledTimes(1);

            const newer = Buffer.from([1, 2, 3]);
            vi.advanceTimersByTime(60_000);
            httpProxy.mockResolvedValueOnce([200, "image/png", newer, {}]);
            expect((await getRemoteImage("http://nas.lan/p.png", 60))?.body).toEqual(newer);
            expect(httpProxy).toHaveBeenCalledTimes(2);

            vi.advanceTimersByTime(120_000);
            httpProxy.mockResolvedValueOnce([500, "text/html", Buffer.from("x"), {}]);
            expect((await getRemoteImage("http://nas.lan/p.png", 60))?.body).toEqual(newer);
        });

        it("refuses a response that is not an image", async () => {
            httpProxy.mockResolvedValue([200, "application/json", Buffer.from("{}"), {}]);
            expect(await getRemoteImage("http://nas.lan/secret.json")).toBeUndefined();
        });

        it.each([
            ["application/octet-stream", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
            ["binary/octet-stream", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])],
            [undefined, "image/gif", Buffer.from("GIF89a....")],
            ["application/octet-stream", "image/webp", Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1")],
            ["application/octet-stream", "image/avif", Buffer.from("\u0000\u0000\u0000\u0018ftypavif", "latin1")],
            ["application/octet-stream", "image/x-icon", Buffer.from([0, 0, 1, 0, 1, 0])],
        ])("serves a %s response that is a %s", async (declared, expected, body) => {
            httpProxy.mockResolvedValueOnce([200, declared, body, {}]);
            const image = await getRemoteImage(`http://nas.lan/${expected.replace("/", "-")}`);
            expect(image?.contentType).toBe(expected);
            expect(image?.body).toBe(body);
        });

        it("does not serve a generic response that is not a raster image, SVG included", async () => {
            httpProxy.mockResolvedValueOnce([200, "application/octet-stream", Buffer.from("<svg></svg>"), {}]);
            expect(await getRemoteImage("http://nas.lan/a.svg")).toBeUndefined();

            httpProxy.mockResolvedValueOnce([200, undefined, Buffer.from("<html>"), {}]);
            expect(await getRemoteImage("http://nas.lan/page")).toBeUndefined();
        });

        it("does not sniff a response that says it is something else", async () => {
            httpProxy.mockResolvedValueOnce([
                200,
                "text/html",
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
                {},
            ]);
            expect(await getRemoteImage("http://nas.lan/trap.png")).toBeUndefined();
        });

        it("refuses an empty image", async () => {
            httpProxy.mockResolvedValueOnce([200, "image/png", Buffer.alloc(0), {}]);
            expect(await getRemoteImage("http://nas.lan/empty.png")).toBeUndefined();
        });

        it("serves an image of any size and gives the download an idle timeout", async () => {
            const big = Buffer.alloc(20 * 1024 * 1024);
            httpProxy.mockResolvedValueOnce([200, "image/png", big, {}]);
            expect((await getRemoteImage("http://nas.lan/big.png"))?.body).toBe(big);
            expect(httpProxy).toHaveBeenCalledWith(
                "http://nas.lan/big.png",
                expect.objectContaining({ timeout: 30_000, useCookieJar: false })
            );
        });
    });
});
