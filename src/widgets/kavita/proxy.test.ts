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
        kavita: {
            api: "{url}/{endpoint}",
        },
    },
}));

import { seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import kavitaProxyHandler from "@/widgets/kavita/proxy";

describe("widgets/kavita/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in and returns server stats", async () => {
        getServiceWidget.mockResolvedValue({ type: "kavita", url: "http://kv", username: "u", password: "p" });

        httpProxy
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ token: "tok" }))])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ seriesCount: 5, totalFiles: 100 })),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await kavitaProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ seriesCount: 5, totalFiles: 100 });
    });

    it("retries after a 401 by obtaining a new session token", async () => {
        await seedSession("kavitaProxyHandler__sessionToken.svc", "old");

        getServiceWidget.mockResolvedValue({ type: "kavita", url: "http://kv", username: "u", password: "p" });

        httpProxy
            .mockResolvedValueOnce([401, "application/json", Buffer.from("{}")])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ token: "newtok" }))])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ seriesCount: 1, totalFiles: 2 })),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await kavitaProxyHandler(req, res as ApiResponse);

        const loginCalls = httpProxy.mock.calls.filter(([url]) => url.toString().includes("Account/login"));
        expect(loginCalls).toHaveLength(1);
        expect(res.body).toEqual({ seriesCount: 1, totalFiles: 2 });
    });
});
