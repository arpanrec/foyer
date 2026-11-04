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
        npm: {
            api: "{url}/{endpoint}",
        },
    },
}));

import { seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import npmProxyHandler from "@/widgets/npm/proxy";

describe("widgets/npm/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in when token is missing and uses Bearer token for requests", async () => {
        getServiceWidget.mockResolvedValue({
            type: "npm",
            url: "http://npm",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ token: "t1", expires: new Date(Date.now() + 60_000).toISOString() })),
            ])
            .mockResolvedValueOnce([200, "application/json", Buffer.from("data")]);

        const req = { query: { group: "g", service: "svc", endpoint: "api/v1/stats", index: "0" } };
        const res = createMockRes();

        await npmProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(httpProxy.mock.calls[0]![0]).toBe("http://npm/api/tokens");
        expect(httpProxy.mock.calls[1]![1].headers.Authorization).toBe("Bearer t1");
        expect(res.body).toEqual(Buffer.from("data"));
    });

    it("retries after a 403 response by clearing cache and logging in again", async () => {
        await seedSession("npmProxyHandler__token.svc", "old");

        getServiceWidget.mockResolvedValue({
            type: "npm",
            url: "http://npm",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([403, "application/json", Buffer.from("nope")])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ token: "new", expires: new Date(Date.now() + 60_000).toISOString() })),
            ])
            .mockResolvedValueOnce([200, "application/json", Buffer.from("ok")]);

        const req = { query: { group: "g", service: "svc", endpoint: "api/v1/stats", index: "0" } };
        const res = createMockRes();

        await npmProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(3);
        expect(httpProxy.mock.calls[0]![1].headers.Authorization).toBe("Bearer old");
        expect(httpProxy.mock.calls[1]![0]).toBe("http://npm/api/tokens");
        expect(httpProxy.mock.calls[2]![1].headers.Authorization).toBe("Bearer new");
        expect(res.body).toEqual(Buffer.from("ok"));
    });

    const query = { group: "g", service: "svc", endpoint: "api/v1/stats", index: "0" };
    const widget = { type: "npm", url: "http://npm", username: "u", password: "p" };
    const tokenReply = (token: string) =>
        Buffer.from(JSON.stringify({ token, expires: new Date(Date.now() + 60_000).toISOString() }));

    it("answers 400 when the request names no group or service", async () => {
        const res = createMockRes();
        await npmProxyHandler({ query: { endpoint: "x" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(logger.warn).toHaveBeenCalled();
    });

    it("answers 403 when the service has no widget with an API", async () => {
        getServiceWidget.mockResolvedValue({ type: "unknown" });
        const res = createMockRes();
        await npmProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(403);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("passes on a failed login with a JSON body", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([401, "application/json", Buffer.from(JSON.stringify({ error: "bad" }))]);
        const res = createMockRes();
        await npmProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "bad" });
        expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("logs an error and passes on the raw body when the login reply is not JSON", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([502, "text/html", Buffer.from("<html>bad gateway</html>")]);
        const res = createMockRes();
        await npmProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(502);
        expect(logger.error).toHaveBeenCalled();
    });

    it("gives up when logging in again after a 403 fails", async () => {
        await seedSession("npmProxyHandler__token.svc", "old");
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce([403, "application/json", Buffer.from("nope")])
            .mockResolvedValueOnce([401, "application/json", Buffer.from(JSON.stringify({ error: "bad" }))]);
        const res = createMockRes();
        await npmProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual(Buffer.from("nope"));
        expect(httpProxy).toHaveBeenCalledTimes(2);
    });

    it("passes on an error status from the API", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce([200, "application/json", tokenReply("t1")])
            .mockResolvedValueOnce([500, "text/plain", Buffer.from("oops")]);
        const res = createMockRes();
        await npmProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual(Buffer.from("oops"));
    });
});
