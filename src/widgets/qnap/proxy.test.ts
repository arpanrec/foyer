import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, fakeXml, logger } = vi.hoisted(() => {
    return {
        httpProxy: vi.fn(),
        getServiceWidget: vi.fn(),
        fakeXml: vi.fn((xml) => {
            if (xml === "login") {
                return JSON.stringify({ QDocRoot: { authSid: { _cdata: "sid1" } } });
            }
            if (xml === "system") {
                return JSON.stringify({
                    QDocRoot: {
                        authPassed: { _cdata: "1" },
                        func: { ownContent: { root: { cpu: 1 } } },
                    },
                });
            }
            if (xml === "volume") {
                return JSON.stringify({ QDocRoot: { authPassed: { _cdata: "1" }, volume: { ok: true } } });
            }
            if (xml === "expired") {
                return JSON.stringify({ QDocRoot: { authPassed: { _cdata: "0" } } });
            }
            return JSON.stringify({ QDocRoot: { authPassed: { _cdata: "1" } } });
        }),
        logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    };
});

vi.mock("@/utils/xml", () => ({
    xmlToCompact: (xml: string) => JSON.parse(fakeXml(xml)),
}));
vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));
vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));
vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));

import { seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import qnapProxyHandler from "@/widgets/qnap/proxy";

describe("widgets/qnap/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it("logs in and returns system + volume data", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://qnap", username: "u", password: "p" });

        httpProxy
            // login
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("login")])
            // system
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("system")])
            // volume
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("volume")]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await qnapProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            system: { cpu: 1 },
            volume: expect.objectContaining({ authPassed: { _cdata: "1" } }),
        });
    });

    it("logs in again when the cached session is no longer authorised", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://qnap", username: "u", password: "p" });
        await seedSession("qnapProxyHandler__sessionToken.svc", "old");

        httpProxy
            // system with the cached token -> authPassed 0
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("expired")])
            // login
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("login")])
            // system again
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("system")])
            // volume
            .mockResolvedValueOnce([200, "application/xml", Buffer.from("volume")]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await qnapProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(httpProxy).toHaveBeenCalledTimes(4);
        expect(res.body).toMatchObject({ system: { cpu: 1 } });
    });
});
