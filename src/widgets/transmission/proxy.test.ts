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
        transmission: {
            rpcUrl: "/transmission/",
        },
    },
}));

import cache from "@/utils/cache";
import transmissionProxyHandler from "@/widgets/transmission/proxy";

describe("widgets/transmission/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("retries after a 409 response by caching the CSRF header", async () => {
        getServiceWidget.mockResolvedValue({
            type: "transmission",
            url: "http://tr",
            username: "u",
            password: "p",
        });

        httpProxy
            .mockResolvedValueOnce([
                409,
                "application/json",
                Buffer.from("nope"),
                { "x-transmission-session-id": "csrf" },
            ])
            .mockResolvedValueOnce([200, "application/json", Buffer.from("ok"), {}]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await transmissionProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(httpProxy.mock.calls[1]![1].headers["x-transmission-session-id"]).toBe("csrf");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(Buffer.from("ok"));
    });

    it("keeps request cookies out of the cached headers and reuses the cached CSRF token", async () => {
        getServiceWidget.mockResolvedValue({
            type: "transmission",
            url: "http://tr",
            username: "u",
            password: "p",
        });

        // httpProxy adds the cookie jar's cookie and the content length to the headers it is given
        const sent: Record<string, unknown>[] = [];
        httpProxy.mockImplementation(async (_url: URL, params: { headers: Record<string, unknown> }) => {
            sent.push({ ...params.headers });
            params.headers["Cookie"] = `session=${sent.length}`;
            params.headers["content-length"] = 10;
            return sent.length === 1
                ? [409, "application/json", Buffer.from("nope"), { "x-transmission-session-id": "csrf" }]
                : [200, "application/json", Buffer.from("ok"), {}];
        });

        const req = { query: { group: "g", service: "svc", index: "0" } };
        await transmissionProxyHandler(req, createMockRes() as ApiResponse);
        await transmissionProxyHandler(req, createMockRes() as ApiResponse);

        expect(sent).toEqual([
            { "content-type": "application/json" },
            { "content-type": "application/json", "x-transmission-session-id": "csrf" },
            { "content-type": "application/json", "x-transmission-session-id": "csrf" },
        ]);
    });
});
