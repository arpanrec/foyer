import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => {
    return {
        httpProxy: vi.fn(),
        getServiceWidget: vi.fn(),
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

vi.mock("@/widgets/widgets", () => ({
    default: {
        booklore: {
            api: "{url}/{endpoint}",
        },
    },
}));

import cache from "@/utils/cache";
import bookloreProxyHandler from "@/widgets/booklore/proxy";

describe("widgets/booklore/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("returns 400 when Booklore credentials are missing", async () => {
        getServiceWidget.mockResolvedValue({ type: "booklore", url: "http://booklore" });

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await bookloreProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Missing Booklore credentials" });
    });

    it("logs in and summarizes libraries and book statuses", async () => {
        getServiceWidget.mockResolvedValue({
            type: "booklore",
            url: "http://booklore",
            username: "u",
            password: "p",
        });

        const books = [
            { readStatus: "reading" },
            { readStatus: "read" },
            { readStatus: "READ" },
            { readStatus: "other" },
        ];

        httpProxy
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ accessToken: "tok" }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify([{ id: 1 }, { id: 2 }]))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify(books))]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await bookloreProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(3);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            libraries: 2,
            books: 4,
            reading: 1,
            finished: 2,
        });
    });

    const query = { group: "g", service: "svc", index: "0" };
    const widget = { type: "booklore", url: "http://booklore", username: "u", password: "p" };
    const json = (value: unknown) => Buffer.from(JSON.stringify(value));
    const login = [200, "application/json", json({ accessToken: "tok" })];

    it("answers 400 when the request names no group or service", async () => {
        const res = createMockRes();
        await bookloreProxyHandler({ query: { group: "g" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(getServiceWidget).not.toHaveBeenCalled();
    });

    it("answers 400 when the service has no widget", async () => {
        getServiceWidget.mockResolvedValue(undefined);
        const res = createMockRes();
        await bookloreProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("answers 401 and logs an error when the login is refused", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([401, "application/json", json({ message: "no" })]);
        const res = createMockRes();
        await bookloreProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "Error fetching libraries" });
        expect(logger.error).toHaveBeenCalled();
    });

    it("answers 401 when the login reply has no token or is not JSON", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([200, "application/json", json({})]);
        const noToken = createMockRes();
        await bookloreProxyHandler({ query }, noToken as ApiResponse);
        expect(noToken.statusCode).toBe(401);

        httpProxy.mockResolvedValueOnce([200, "text/html", Buffer.from("<html>")]);
        const notJson = createMockRes();
        await bookloreProxyHandler({ query }, notJson as ApiResponse);
        expect(notJson.statusCode).toBe(401);
        expect(logger.error).toHaveBeenCalled();
    });

    it("logs in again when the API rejects the token, then carries on", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce(login)
            .mockResolvedValueOnce([401, "application/json", json({})])
            .mockResolvedValueOnce([200, "application/json", json({ accessToken: "fresh" })])
            .mockResolvedValueOnce([200, "application/json", json([{ id: 1 }])])
            .mockResolvedValueOnce([200, "application/json", json([{ readStatus: "READING" }])]);
        const res = createMockRes();
        await bookloreProxyHandler({ query }, res as ApiResponse);

        expect(httpProxy.mock.calls[3]![1].headers.Authorization).toBe("Bearer fresh");
        expect(res.body).toEqual({ libraries: 1, books: 1, reading: 1, finished: 0 });
    });

    it("passes on the rejection when logging in again fails", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce(login)
            .mockResolvedValueOnce([403, "application/json", json({})])
            .mockResolvedValueOnce([401, "application/json", json({})]);
        const res = createMockRes();
        await bookloreProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(403);
    });

    it("passes on an error status from the API, and an unparsable body", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce(login).mockResolvedValueOnce([500, "text/plain", Buffer.from("oops")]);
        const failed = createMockRes();
        await bookloreProxyHandler({ query }, failed as ApiResponse);
        expect(failed.statusCode).toBe(500);

        httpProxy.mockResolvedValueOnce([200, "text/html", Buffer.from("<html>")]);
        const broken = createMockRes();
        await bookloreProxyHandler({ query }, broken as ApiResponse);
        expect(broken.statusCode).toBe(200);
        expect(broken.body).toEqual({ error: "Error fetching libraries" });
        expect(logger.error).toHaveBeenCalled();
    });

    it("passes on a failure fetching the books", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce(login)
            .mockResolvedValueOnce([200, "application/json", json([{ id: 1 }])])
            .mockResolvedValueOnce([500, "text/plain", Buffer.from("oops")]);
        const res = createMockRes();
        await bookloreProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "Error fetching books" });
    });
});
