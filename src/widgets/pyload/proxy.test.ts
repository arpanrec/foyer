import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => {
    return {
        httpProxy: vi.fn(),
        getServiceWidget: vi.fn(),
        logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
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
        pyload: {
            api: "{url}/api/{endpoint}",
        },
    },
}));

import { peekSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import pyloadProxyHandler from "@/widgets/pyload/proxy";

describe("widgets/pyload/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("uses Basic auth when credentials work and returns data", async () => {
        getServiceWidget.mockResolvedValue({
            type: "pyload",
            url: "http://pyload",
            username: "u",
            password: "p",
        });

        httpProxy.mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ ok: true })), {}]);

        const req = { query: { group: "g", service: "svc", endpoint: "status", index: "0" } };
        const res = createMockRes();

        await pyloadProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(httpProxy.mock.calls[0]![1].headers.Authorization).toMatch(/^Basic /);
        expect(await peekSession("pyloadProxyHandler__isNg.svc")).toBe(true);
        expect(res.body).toEqual({ ok: true });
    });

    it("uses api key auth and returns data", async () => {
        getServiceWidget.mockResolvedValue({
            type: "pyload",
            url: "http://pyload",
            key: "apikey",
        });

        httpProxy.mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ ok: true })), {}]);

        const req = { query: { group: "g", service: "svc", endpoint: "status", index: "0" } };
        const res = createMockRes();

        await pyloadProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(httpProxy.mock.calls[0]![1].headers["X-API-Key"]).toBe("apikey");
        expect(await peekSession("pyloadProxyHandler__isNg.svc")).toBe(true);
        expect(res.body).toEqual({ ok: true });
    });

    it("returns error if login fails", async () => {
        getServiceWidget.mockResolvedValue({
            type: "pyload",
            url: "http://pyload",
            username: "u",
            password: "p",
        });

        httpProxy.mockResolvedValueOnce([401, "application/json", Buffer.from(JSON.stringify({ error: "bad" })), {}]);

        const req = { query: { group: "g", service: "svc", endpoint: "status", index: "0" } };
        const res = createMockRes();

        await pyloadProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ error: "Invalid credentials communicating with Pyload API" });
    });

    it("retries after 403 by clearing session and logging in again", async () => {
        getServiceWidget.mockResolvedValue({
            type: "pyload",
            url: "http://pyload",
            username: "u",
            password: "",
        });

        httpProxy
            // login -> sessionId
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify("sid1")), {}])
            // fetch -> unauthorized
            .mockResolvedValueOnce([403, "application/json", Buffer.from(JSON.stringify({ error: "bad" })), {}])
            // relogin -> sessionId
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify("sid2")), {}])
            // retry fetch -> ok
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ ok: true })), {}]);

        const req = { query: { group: "g", service: "svc", endpoint: "status", index: "0" } };
        const res = createMockRes();

        await pyloadProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(4);
        expect(await peekSession("pyloadProxyHandler__sessionId.svc")).toBe("sid2");
        expect(res.body).toEqual({ ok: true });
    });

    it("sends the session cookie without a body for an NG instance", async () => {
        getServiceWidget.mockResolvedValue({ type: "pyload", url: "http://pyload" });

        httpProxy
            // login -> NG session cookie
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify("sid1")),
                { "set-cookie": ["pyload_session=abc; Path=/"] },
            ])
            // fetch -> ok
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ ok: true })), {}]);

        const req = { query: { group: "g", service: "svc", endpoint: "status", index: "0" } };
        const res = createMockRes();

        await pyloadProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        const options = httpProxy.mock.calls[1]![1];
        expect(options.body).toBeUndefined();
        expect(options.headers.Cookie).toBe("pyload_session=abc; Path=/");
        expect(res.body).toEqual({ ok: true });
    });
});
