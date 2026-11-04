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
        homebridge: {
            api: "{url}/{endpoint}",
        },
    },
}));

import cache from "@/utils/cache";
import homebridgeProxyHandler from "@/widgets/homebridge/proxy";

describe("widgets/homebridge/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in and aggregates status, versions, plugin updates, and child bridge counts", async () => {
        getServiceWidget.mockResolvedValue({ type: "homebridge", url: "http://hb", username: "u", password: "p" });

        httpProxy
            // login
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ access_token: "tok", expires_in: 3600 })),
                {},
            ])
            // status
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ status: "ok" })), {}])
            // version
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ updateAvailable: true })),
                {},
            ])
            // child bridges
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify([{ status: "ok" }, { status: "down" }])),
                {},
            ])
            // plugins
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify([{ updateAvailable: true }, { updateAvailable: false }])),
                {},
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await homebridgeProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            status: "ok",
            updateAvailable: true,
            plugins: { updatesAvailable: 1 },
            childBridges: { running: 1, total: 2 },
        });
    });
});
