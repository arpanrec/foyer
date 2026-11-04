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
        beszel: {
            api: "{url}/{endpoint}",
            mappings: {
                authv1: { endpoint: "api/auth" },
                authv2: { endpoint: "api/auth/v2" },
            },
        },
    },
}));

import { seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import beszelProxyHandler from "@/widgets/beszel/proxy";

describe("widgets/beszel/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in when token is missing and uses Bearer token for requests", async () => {
        getServiceWidget.mockResolvedValue({
            type: "beszel",
            url: "http://beszel",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ token: "t1" }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ items: [1] }))]);

        const req = { query: { group: "g", service: "svc", endpoint: "items", index: "0" } };
        const res = createMockRes();

        await beszelProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(httpProxy.mock.calls[0]![0]).toBe("http://beszel/api/auth");
        expect(httpProxy.mock.calls[1]![0].toString()).toBe("http://beszel/items");
        expect(httpProxy.mock.calls[1]![1]).toEqual({
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer t1",
            },
        });
        expect(res.send).toHaveBeenCalledWith(Buffer.from(JSON.stringify({ items: [1] })));
    });

    it("retries after receiving an empty list by clearing cache and logging in again", async () => {
        await seedSession("beszelProxyHandler__token.svc", "old");

        getServiceWidget.mockResolvedValue({
            type: "beszel",
            url: "http://beszel",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ items: [] }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ token: "new" }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ items: [1] }))]);

        const req = { query: { group: "g", service: "svc", endpoint: "items", index: "0" } };
        const res = createMockRes();

        await beszelProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(3);
        expect(httpProxy.mock.calls[0]![1].headers.Authorization).toBe("Bearer old");
        expect(httpProxy.mock.calls[1]![0]).toBe("http://beszel/api/auth");
        expect(httpProxy.mock.calls[2]![1].headers.Authorization).toBe("Bearer new");
        expect(res.send).toHaveBeenCalledWith(Buffer.from(JSON.stringify({ items: [1] })));
    });

    const query = { group: "g", service: "svc", endpoint: "items", index: "0" };
    const widget = { type: "beszel", url: "http://beszel", username: "u", password: "p" };
    const json = (value: unknown) => Buffer.from(JSON.stringify(value));

    it("answers 400 when the request names no group or service", async () => {
        const res = createMockRes();
        await beszelProxyHandler({ query: { endpoint: "items" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(logger.warn).toHaveBeenCalled();
    });

    it("answers 403 when the service has no widget with an API", async () => {
        getServiceWidget.mockResolvedValue({ type: "unknown" });
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(403);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("logs in at the version 2 endpoint when the widget asks for version 2", async () => {
        getServiceWidget.mockResolvedValue({ ...widget, version: 2 });
        httpProxy
            .mockResolvedValueOnce([200, "application/json", json({ token: "t2" })])
            .mockResolvedValueOnce([200, "application/json", json({ items: [1] })]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(httpProxy.mock.calls[0]![0]).toBe("http://beszel/api/auth/v2");
        expect(res.send).toHaveBeenCalledWith(json({ items: [1] }));
    });

    it("passes on a failed login with a JSON body", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([401, "application/json", json({ message: "bad login" })]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ message: "bad login" });
        expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("logs an error when the login reply is not JSON", async () => {
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([502, "text/html", Buffer.from("<html>bad gateway</html>")]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(502);
        expect(logger.error).toHaveBeenCalled();
    });

    it("logs in again after a 403 and gives up when that login fails", async () => {
        await seedSession("beszelProxyHandler__token.svc", "old");
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce([403, "application/json", json({ message: "forbidden" })])
            .mockResolvedValueOnce([401, "application/json", json({ message: "bad login" })]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual(json({ message: "forbidden" }));
        expect(httpProxy).toHaveBeenCalledTimes(2);
    });

    it("logs in again after a 400 and passes on what the second call returns", async () => {
        await seedSession("beszelProxyHandler__token.svc", "old");
        getServiceWidget.mockResolvedValue(widget);
        httpProxy
            .mockResolvedValueOnce([400, "application/json", json({ message: "bad request" })])
            .mockResolvedValueOnce([200, "application/json", json({ token: "new" })])
            .mockResolvedValueOnce([500, "text/plain", Buffer.from("oops")]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(httpProxy.mock.calls[2]![1].headers.Authorization).toBe("Bearer new");
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual(Buffer.from("oops"));
    });

    it("passes on a reply that is not JSON", async () => {
        await seedSession("beszelProxyHandler__token.svc", "old");
        getServiceWidget.mockResolvedValue(widget);
        httpProxy.mockResolvedValueOnce([200, "text/plain", Buffer.from("plain text")]);
        const res = createMockRes();
        await beszelProxyHandler({ query }, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(res.send).toHaveBeenCalledWith(Buffer.from("plain text"));
    });
});
