import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

type ErrorBody = { error: { message: string; url?: string; data?: unknown } };

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

import { peekSession, seedSession } from "@/test-utils/cache";
import cache from "@/utils/cache";
import omadaProxyHandler from "@/widgets/omada/proxy";

describe("widgets/omada/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        httpProxy.mockReset();
        getServiceWidget.mockReset();
        await cache.clear();
    });

    it("fetches controller info, logs in, selects site, and returns overview stats (v4)", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            // controller info
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            // login
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            // sites list
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            // overview diagram
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            // alert count
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(5);
        expect(res.statusCode).toBe(null); // uses res.send directly without setting status
        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 2,
                activeUser: 10,
                alerts: 4,
                connectedGateways: 1,
                connectedSwitches: 3,
            })
        );
        expect(httpProxy.mock.calls[2]![1]).toMatchObject({
            headers: {
                "Csrf-Token": "t",
                Cookie: "TPOMADA_SESSIONID=sid",
            },
        });
    });

    it("returns an error when controller info cannot be retrieved", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy.mockResolvedValueOnce([503, "application/json", "down"]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(logger.error).toHaveBeenCalledWith(
            "HTTP %d retrieving Omada controller info for service '%s'",
            expect.any(Number),
            expect.anything()
        );
        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({
            error: { message: "HTTP Error 503", url: "http://omada/api/info", data: "down" },
        });
    });

    it("returns an error when controller version cannot be determined", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "7.0.0" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<ErrorBody>();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body.error.message).toBe("Error determining controller version");
    });

    it("returns an error when login fails (errorCode > 0)", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 1, msg: "nope" })),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<ErrorBody>();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body.error.message).toBe("Error logging in to Omada controller");
        expect(res.body.error.url).toBe("http://omada/api/v2/login");
        expect(res.body.error.data).toEqual({ errorCode: 1, msg: "nope" });
    });

    it("returns an error when sites list retrieval fails", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([200, "application/json", JSON.stringify({ errorCode: 2, msg: "bad" })]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<ErrorBody>();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(logger.debug).toHaveBeenCalledWith("HTTP 200 getting sites list: bad");
        expect(res.statusCode).toBe(200);
        expect(res.body.error.message).toBe("Error getting sites list");
    });

    it("returns an error when the site is not found", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Missing" });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<ErrorBody>();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body.error.message).toContain("Site Missing is not found");
    });

    it("handles the v3 controller flow: login, getUserSites, switchSite, and getGlobalStat", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            // controller info parse fails -> defaults to 3.2.x
            .mockResolvedValueOnce([200, "application/json", "not-json"])
            // login v3
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            // getUserSites
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { siteList: [{ name: "Default", siteName: "site1" }] } }),
            ])
            // switchSite
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ errorCode: 0 }))])
            // getGlobalStat
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { connectedAp: 3, activeUser: 11, alerts: 2 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        // login body includes v3 RPC shape
        expect(JSON.parse(httpProxy.mock.calls[1]![1].body)).toMatchObject({
            username: "u",
            password: "p",
            method: "login",
            params: { name: "u", password: "p" },
        });

        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 3,
                activeUser: 11,
                alerts: 2,
                connectedGateways: undefined,
                connectedSwitches: undefined,
            })
        );
    });

    it("returns an error when v3 site switching fails", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            .mockResolvedValueOnce([200, "application/json", "not-json"])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { siteList: [{ name: "Default", siteName: "site1" }] } }),
            ])
            .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ errorCode: 1 }))]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<ErrorBody>();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body.error.message).toBe("Error switching site");
    });

    it("returns a structured error when overview stats retrieval fails (v5)", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "5.0.0" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", id: "siteid" }] } }),
            ])
            // overview fails
            .mockResolvedValueOnce([200, "application/json", JSON.stringify({ errorCode: 1, msg: "bad" })]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
            error: {
                message: "Error getting stats",
                url: "http://omada/cid/api/v2/sites/siteid/dashboard/overviewDiagram?token=t&currentPage=1&currentPageSize=1000",
                data: { errorCode: 1, msg: "bad" },
            },
        });
    });

    it("reuses a cached Omada session across polls", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([200, "application/json", JSON.stringify({ errorCode: 0, result: { alertNum: 4 } })])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };

        await omadaProxyHandler(req, createMockRes() as ApiResponse);
        await omadaProxyHandler(req, createMockRes() as ApiResponse);

        const loginCalls = httpProxy.mock.calls.filter(([url]) => url.toString().includes("/api/v2/login"));
        expect(loginCalls).toHaveLength(1);
        expect(httpProxy.mock.calls[6]![1].headers.Cookie).toBe("TPOMADA_SESSIONID=sid");
    });

    it("does not reuse a cached session across different widget identities", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t1" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid1; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([200, "application/json", JSON.stringify({ errorCode: 0, result: { alertNum: 4 } })])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t2" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid2; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        await omadaProxyHandler({ query: { group: "g1", service: "svc", index: "0" } }, createMockRes() as ApiResponse);
        await omadaProxyHandler({ query: { group: "g2", service: "svc", index: "0" } }, createMockRes() as ApiResponse);

        const loginCalls = httpProxy.mock.calls.filter(([url]) => url.toString().includes("/api/v2/login"));
        expect(loginCalls).toHaveLength(2);
        expect(httpProxy.mock.calls[2]![1].headers.Cookie).toBe("TPOMADA_SESSIONID=sid1");
        expect(httpProxy.mock.calls[7]![1].headers.Cookie).toBe("TPOMADA_SESSIONID=sid2");
    });

    it("keeps the latest value when Omada sets the same cookie more than once during login", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                {
                    "set-cookie": [
                        "TPOMADA_SESSIONID=deleteMe; Path=/; Max-Age=0",
                        "TPOMADA_SESSIONID=sid; Path=/; HttpOnly",
                        "rememberMe=deleteMe; Path=/; Max-Age=0",
                    ],
                },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(httpProxy.mock.calls[2]![1].headers.Cookie).toBe("TPOMADA_SESSIONID=sid; rememberMe=deleteMe");
        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 2,
                activeUser: 10,
                alerts: 4,
                connectedGateways: 1,
                connectedSwitches: 3,
            })
        );
    });

    it("does not reuse a mutated content-length header on later GET requests", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        const responses = [
            [200, "application/json", JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } })],
            [
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=sid; Path=/; HttpOnly"] },
            ],
            [
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ],
            [
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ],
            [200, "application/json", JSON.stringify({ errorCode: 0, result: { alertNum: 4 } })],
        ];

        httpProxy.mockImplementation(async (_url, params = {}) => {
            if (params.body) {
                params.headers["content-length"] = Buffer.byteLength(params.body);
            }

            return responses.shift();
        });

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(httpProxy.mock.calls[2]![1].headers["content-length"]).toBe(2);
        expect(httpProxy.mock.calls[3]![1].headers["content-length"]).toBeUndefined();
        expect(httpProxy.mock.calls[4]![1].headers["content-length"]).toBeUndefined();
        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 2,
                activeUser: 10,
                alerts: 4,
                connectedGateways: 1,
                connectedSwitches: 3,
            })
        );
    });

    it("clears the cached session and re-authenticates when an authenticated response is not JSON", async () => {
        await seedSession("omadaProxyHandler__session.g.svc.0", {
            token: "stale-token",
            cookieHeader: "TPOMADA_SESSIONID=stale",
        });

        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([200, "text/html", Buffer.from("<!DOCTYPE html>login")])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "fresh-token" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=fresh; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(await peekSession<{ token: string }>("omadaProxyHandler__session.g.svc.0")).not.toMatchObject({
            token: "stale-token",
        });
        const loginCalls = httpProxy.mock.calls.filter(([url]) => url.toString().includes("/api/v2/login"));
        expect(loginCalls).toHaveLength(1);
        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 2,
                activeUser: 10,
                alerts: 4,
                connectedGateways: 1,
                connectedSwitches: 3,
            })
        );
    });

    it("clears the cached session and re-authenticates when a cached session returns a JSON auth error", async () => {
        await seedSession("omadaProxyHandler__session.g.svc.0", {
            token: "stale-token",
            cookieHeader: "TPOMADA_SESSIONID=stale",
        });

        getServiceWidget.mockResolvedValue({
            url: "http://omada",
            username: "u",
            password: "p",
            site: "Default",
        });

        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([200, "application/json", JSON.stringify({ errorCode: 1, msg: "Login required" })])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "fresh-token" } })),
                { "set-cookie": ["TPOMADA_SESSIONID=fresh; Path=/; HttpOnly"] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Default", key: "sitekey" }] } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({
                    errorCode: 0,
                    result: {
                        totalClientNum: 10,
                        connectedApNum: 2,
                        connectedGatewayNum: 1,
                        connectedSwitchNum: 3,
                    },
                }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { alertNum: 4 } }),
            ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await omadaProxyHandler(req, res as ApiResponse);

        expect(await peekSession<{ token: string }>("omadaProxyHandler__session.g.svc.0")).not.toMatchObject({
            token: "stale-token",
        });
        const loginCalls = httpProxy.mock.calls.filter(([url]) => url.toString().includes("/api/v2/login"));
        expect(loginCalls).toHaveLength(1);
        expect(res.body).toBe(
            JSON.stringify({
                connectedAp: 2,
                activeUser: 10,
                alerts: 4,
                connectedGateways: 1,
                connectedSwitches: 3,
            })
        );
    });

    describe("failures after the session is accepted", () => {
        const query = { group: "g", service: "svc", index: "0" };
        const sessionKey = "omadaProxyHandler__session.g.svc.0";
        const widget = { url: "http://omada", username: "u", password: "p", site: "Default" };
        const reply = (body: unknown, status = 200, headers?: Record<string, string[]>) =>
            [status, "application/json", JSON.stringify(body), ...(headers ? [headers] : [])] as const;
        const info = (version: string) => reply({ result: { omadacId: "cid", controllerVer: version } });
        const login = () =>
            reply({ errorCode: 0, result: { token: "fresh" } }, 200, { "set-cookie": ["TPOMADA_SESSIONID=f; Path=/"] });
        const sites = () => reply({ errorCode: 0, result: { data: [{ name: "Default", key: "k", id: "i" }] } });
        const v3Sites = () => reply({ errorCode: 0, result: { siteList: [{ name: "Default", siteName: "s1" }] } });
        const overview = () => reply({ errorCode: 0, result: { totalClientNum: 1 } });
        const failure = () => reply({ errorCode: 1, msg: "Login required" });

        beforeEach(async () => {
            getServiceWidget.mockResolvedValue(widget);
            await seedSession(sessionKey, { token: "stale", cookieHeader: null });
        });

        it("logs in again and then reports the error when the overview keeps failing (v4)", async () => {
            httpProxy
                .mockResolvedValueOnce(info("4.5.6"))
                .mockResolvedValueOnce(sites())
                .mockResolvedValueOnce(failure())
                .mockResolvedValueOnce(login())
                .mockResolvedValueOnce(sites())
                .mockResolvedValueOnce(failure());
            const res = createMockRes<ErrorBody>();
            await omadaProxyHandler({ query }, res as ApiResponse);

            expect(res.statusCode).toBe(500);
            expect(res.body.error.message).toBe("Error getting stats");
            expect(httpProxy).toHaveBeenCalledTimes(6);
        });

        it("logs in again and then reports the error when the alert count keeps failing (v5)", async () => {
            httpProxy
                .mockResolvedValueOnce(info("5.0.0"))
                .mockResolvedValueOnce(sites())
                .mockResolvedValueOnce(overview())
                .mockResolvedValueOnce(failure())
                .mockResolvedValueOnce(login())
                .mockResolvedValueOnce(sites())
                .mockResolvedValueOnce(overview())
                .mockResolvedValueOnce(failure());
            const res = createMockRes<ErrorBody>();
            await omadaProxyHandler({ query }, res as ApiResponse);

            expect(res.statusCode).toBe(500);
            expect(res.body.error.message).toBe("Error getting alerts");
            expect(httpProxy).toHaveBeenCalledTimes(8);
        });

        it("logs in again and then reports the error when switching the site keeps failing (v3)", async () => {
            httpProxy
                .mockResolvedValueOnce(reply("not json"))
                .mockResolvedValueOnce(v3Sites())
                .mockResolvedValueOnce(failure())
                .mockResolvedValueOnce(login())
                .mockResolvedValueOnce(v3Sites())
                .mockResolvedValueOnce(failure());
            const res = createMockRes<ErrorBody>();
            await omadaProxyHandler({ query }, res as ApiResponse);

            expect(res.body.error.message).toBe("Error switching site");
        });

        it("logs in again and then reports the error when the global stats keep failing (v3)", async () => {
            const ok = () => reply({ errorCode: 0 });
            httpProxy
                .mockResolvedValueOnce(reply("not json"))
                .mockResolvedValueOnce(v3Sites())
                .mockResolvedValueOnce(ok())
                .mockResolvedValueOnce(failure())
                .mockResolvedValueOnce(login())
                .mockResolvedValueOnce(v3Sites())
                .mockResolvedValueOnce(ok())
                .mockResolvedValueOnce(failure());
            const res = createMockRes<ErrorBody>();
            await omadaProxyHandler({ query }, res as ApiResponse);

            expect(res.body.error.message).toBe("Error getting stats");
            expect(httpProxy).toHaveBeenCalledTimes(8);
        });

        it("lets an error from the upstream call out of the handler", async () => {
            httpProxy.mockResolvedValueOnce(info("4.5.6")).mockRejectedValueOnce(new Error("socket closed"));

            await expect(omadaProxyHandler({ query }, createMockRes() as ApiResponse)).rejects.toThrow("socket closed");
        });
    });

    it("answers 400 when the request names no group or service", async () => {
        const res = createMockRes();
        await omadaProxyHandler({ query: { group: "g" } }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(logger.warn).toHaveBeenCalled();
    });

    it("sends no cookie when the login sets an empty one", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://omada", username: "u", password: "p", site: "Default" });
        httpProxy
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ result: { omadacId: "cid", controllerVer: "4.5.6" } }),
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                Buffer.from(JSON.stringify({ errorCode: 0, result: { token: "t" } })),
                { "set-cookie": [""] },
            ])
            .mockResolvedValueOnce([
                200,
                "application/json",
                JSON.stringify({ errorCode: 0, result: { data: [{ name: "Other", key: "k" }] } }),
            ]);
        const res = createMockRes();
        await omadaProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(httpProxy.mock.calls[2]![1].headers).not.toHaveProperty("Cookie");
    });
});
