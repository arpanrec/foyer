import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const soapReply = (action: string, values: string) =>
    "<?xml version='1.0' encoding='utf-8'?>" +
    "<s:Envelope s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/' xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'>" +
    "<s:Body>" +
    `<u:${action}Response xmlns:u='urn:schemas-upnp-org:service:WANIPConnection:1'>${values}</u:${action}Response>` +
    "</s:Body>" +
    "</s:Envelope>";

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));
vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));
vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));

import fritzboxProxyHandler from "@/widgets/fritzbox/proxy";

describe("widgets/fritzbox/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("queries the configured fields and returns derived data", async () => {
        getServiceWidget.mockResolvedValue({
            url: "http://fritz.box",
            fields: ["connectionStatus", "uptime"],
        });

        httpProxy.mockResolvedValueOnce([
            200,
            "text/xml",
            Buffer.from(
                soapReply(
                    "GetStatusInfo",
                    "<NewConnectionStatus>Connected</NewConnectionStatus><NewUptime>42</NewUptime><NewEmpty/>"
                )
            ),
        ]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes();

        await fritzboxProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                connectionStatus: "Connected",
                uptime: "42",
            })
        );
    });

    it("combines values from several replies and ignores an empty element", async () => {
        getServiceWidget.mockResolvedValue({
            url: "https://fritz.box",
            fields: ["connectionStatus", "maxDown", "externalIPv6Prefix"],
        });

        const replies: Record<string, string> = {
            GetStatusInfo: "<NewConnectionStatus>Connected</NewConnectionStatus><NewEmpty/>",
            GetCommonLinkProperties: "<NewLayer1DownstreamMaxBitRate>100000</NewLayer1DownstreamMaxBitRate>",
            X_AVM_DE_GetIPv6Prefix: "<NewIPv6Prefix>2001:db8::</NewIPv6Prefix><NewPrefixLength>64</NewPrefixLength>",
        };
        httpProxy.mockImplementation((_url: string, params: { headers: { SoapAction: string } }) => {
            const action = params.headers.SoapAction.split("#")[1] ?? "";
            return Promise.resolve([200, "text/xml", Buffer.from(soapReply(action, replies[action] ?? ""))]);
        });

        const res = createMockRes();
        await fritzboxProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                connectionStatus: "Connected",
                maxDown: "100000",
                externalIPv6Prefix: "2001:db8::/64",
            })
        );
    });

    it("returns a 500 when the reply is not well-formed XML", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://fritz.box", fields: ["connectionStatus"] });
        httpProxy.mockResolvedValueOnce([200, "text/html", Buffer.from("<html><body><br></body></html>")]);

        const res = createMockRes();
        await fritzboxProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: { message: "Failed parsing 'GetStatusInfo' response" } });
    });

    it("reads the last of repeated elements and the first of split text", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://fritz.box", fields: ["connectionStatus", "uptime"] });
        const replies: Record<string, string> = {
            GetStatusInfo:
                "<NewConnectionStatus>Old</NewConnectionStatus><NewConnectionStatus>Connected</NewConnectionStatus>" +
                "<NewUptime>12<x/>34</NewUptime>",
        };
        httpProxy.mockImplementation((_url: string, params: { headers: { SoapAction: string } }) => {
            const action = params.headers.SoapAction.split("#")[1] ?? "";
            return Promise.resolve([200, "text/xml", Buffer.from(soapReply(action, replies[action] ?? ""))]);
        });

        const res = createMockRes();
        await fritzboxProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ connectionStatus: "Connected", uptime: "12" }));
    });

    it("takes the first of repeated body elements", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://fritz.box", fields: ["connectionStatus"] });
        const reply = soapReply("GetStatusInfo", "<NewConnectionStatus>Connected</NewConnectionStatus>").replace(
            "</s:Body>",
            "</s:Body><s:Body/>"
        );
        httpProxy.mockResolvedValue([200, "text/xml", Buffer.from(reply)]);

        const res = createMockRes();
        await fritzboxProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(200);
    });

    it("returns no values for a reply without a body", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://fritz.box", fields: ["connectionStatus"] });
        httpProxy.mockResolvedValue([200, "text/xml", Buffer.from("<s:Envelope/>")]);

        const res = createMockRes();
        await fritzboxProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res as ApiResponse);

        expect(res.statusCode).toBe(200);
    });
});
