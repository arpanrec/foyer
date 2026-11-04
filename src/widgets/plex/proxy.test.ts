import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, fakeXml, logger } = vi.hoisted(() => {
    return {
        httpProxy: vi.fn(),
        getServiceWidget: vi.fn(),
        fakeXml: vi.fn((xml) => {
            if (xml === "sessions") return JSON.stringify({ MediaContainer: { _attributes: { size: "2" } } });
            if (xml === "libraries")
                return JSON.stringify({
                    MediaContainer: {
                        Directory: [
                            { _attributes: { type: "movie", key: "1" } },
                            { _attributes: { type: "show", key: "2" } },
                            { _attributes: { type: "artist", key: "3" } },
                        ],
                    },
                });
            if (xml === "movies") return JSON.stringify({ MediaContainer: { _attributes: { size: "10" } } });
            if (xml === "tv") return JSON.stringify({ MediaContainer: { _attributes: { totalSize: "20" } } });
            if (xml === "albums") return JSON.stringify({ MediaContainer: { _attributes: { size: "30" } } });
            if (xml === "not json") throw new Error("not xml");
            return JSON.stringify({ MediaContainer: { _attributes: { size: "0" } } });
        }),
        logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    };
});

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));
vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));
vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));
vi.mock("@/utils/xml", () => ({
    xmlToCompact: (xml: string) => JSON.parse(fakeXml(xml)),
}));
vi.mock("@/widgets/widgets", () => ({
    default: {
        plex: {
            api: "{url}{endpoint}",
        },
    },
}));

import cache from "@/utils/cache";
import plexProxyHandler from "@/widgets/plex/proxy";

describe("widgets/plex/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("fetches sessions and library counts, caching intermediate results", async () => {
        getServiceWidget.mockResolvedValue({ type: "plex", url: "http://plex" });

        httpProxy
            // sessions
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("sessions")])
            // libraries
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("libraries")])
            // movies
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("movies")])
            // tv
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("tv")])
            // albums
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("albums")]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await plexProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ streams: "2", albums: 30, movies: 10, tv: 20 });
        expect(await cache.size("response")).toBeGreaterThan(0);
    });

    it("reuses cached libraries and counts on a later request", async () => {
        getServiceWidget.mockResolvedValue({ type: "plex", url: "http://plex" });

        httpProxy
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("sessions")])
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("libraries")])
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("movies")])
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("tv")])
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("albums")])
            // second request: sessions only
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("sessions")]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        await plexProxyHandler(req, createMockRes() as ApiResponse);
        const res = createMockRes();
        await plexProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(6);
        expect(res.body).toEqual({ streams: "2", albums: 30, movies: 10, tv: 20 });
    });

    it("answers 400 when the request names no group or service", async () => {
        const res = createMockRes();
        await plexProxyHandler({ query: { group: "g" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(getServiceWidget).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("answers 400 when the service has no widget", async () => {
        getServiceWidget.mockResolvedValue(undefined);
        const res = createMockRes();
        await plexProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("answers 403 when the widget type has no API", async () => {
        getServiceWidget.mockResolvedValue({ type: "unknown", url: "http://plex" });
        const res = createMockRes();
        await plexProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(403);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("passes on an HTTP error from Plex with its body", async () => {
        getServiceWidget.mockResolvedValue({ type: "plex", url: "http://plex" });
        httpProxy.mockResolvedValueOnce([500, "text/plain", Buffer.from("broken")]);
        const res = createMockRes();
        await plexProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: { message: "HTTP error communicating with Plex API", data: "broken" } });
        expect(logger.error).toHaveBeenCalled();
    });

    it("answers with zero counts when the Plex reply cannot be decoded", async () => {
        getServiceWidget.mockResolvedValue({ type: "plex", url: "http://plex" });
        // the mocked decoder throws on anything it does not know as JSON
        httpProxy.mockResolvedValue([200, "application/xml", Buffer.from("not json")]);
        const res = createMockRes();
        await plexProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ streams: undefined, albums: 0, movies: 0, tv: 0 });
        expect(logger.error).toHaveBeenCalled();
    });
});
