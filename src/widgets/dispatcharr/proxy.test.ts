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
        dispatcharr: {
            api: "{url}/{endpoint}",
            mappings: {
                token: { endpoint: "auth/token" },
            },
        },
    },
}));

import { seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import dispatcharrProxyHandler from "@/widgets/dispatcharr/proxy";

describe("widgets/dispatcharr/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in when token is missing and uses Bearer token for requests", async () => {
        getServiceWidget.mockResolvedValue({
            type: "dispatcharr",
            url: "http://dispatcharr",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ access: "t1" }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from("data")]);

        const req = { query: { group: "g", service: "svc", endpoint: "items", index: "0" } };
        const res = createMockRes();

        await dispatcharrProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(httpProxy.mock.calls[0]![0].toString()).toBe("http://dispatcharr/auth/token");
        expect(httpProxy.mock.calls[1]![1].headers.Authorization).toBe("Bearer t1");
        expect(res.body).toEqual(Buffer.from("data"));
    });

    it("answers 401 to a request that joined a login that failed", async () => {
        getServiceWidget.mockResolvedValue({
            type: "dispatcharr",
            url: "http://dispatcharr",
            username: "u",
            password: "wrong",
        });
        httpProxy.mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return [401, "application/json", Buffer.from(JSON.stringify({ detail: "no" }))];
        });

        const req = { query: { group: "g", service: "svc", endpoint: "items", index: "0" } };
        const first = createMockRes();
        const second = createMockRes();
        await Promise.all([
            dispatcharrProxyHandler(req, first as ApiResponse),
            dispatcharrProxyHandler(req, second as ApiResponse),
        ]);

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(first.statusCode).toBe(401);
        expect(second.statusCode).toBe(401);
    });

    it("retries after a bad response by clearing cache and logging in again", async () => {
        await seedSession("dispatcharrProxyHandler__token.svc", "old");

        getServiceWidget.mockResolvedValue({
            type: "dispatcharr",
            url: "http://dispatcharr",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([400, "application/json", Buffer.from(JSON.stringify({ items: [] }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ access: "new" }))])
            .mockResolvedValueOnce([200, "application/json", Buffer.from("ok")]);

        const req = { query: { group: "g", service: "svc", endpoint: "items", index: "0" } };
        const res = createMockRes();

        await dispatcharrProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(3);
        expect(httpProxy.mock.calls[1]![0].toString()).toBe("http://dispatcharr/auth/token");
        expect(httpProxy.mock.calls[2]![1].headers.Authorization).toBe("Bearer new");
        expect(res.body).toEqual(Buffer.from("ok"));
    });
});
