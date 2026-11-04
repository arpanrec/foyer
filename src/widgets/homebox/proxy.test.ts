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

import cache from "@/utils/cache";
import homeboxProxyHandler from "@/widgets/homebox/proxy";
import type { HomeboxData } from "@/widgets/homebox/types";

describe("widgets/homebox/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in and returns group statistics + currency", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://homebox",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ token: "tok", expiresAt: new Date(Date.now() + 60_000).toISOString() })),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ totalItems: 1, totalUsers: 2 })),
            ])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ currency: "USD" }))]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<HomeboxData>();

        await homeboxProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(3);
        expect(httpProxy.mock.calls[0]![0]).toBe("http://homebox/api/v1/users/login");
        expect(res.statusCode).toBe(200);
        expect(res.body.currencyCode).toBe("USD");
        expect(res.body.users).toBe(2);
    });
});
