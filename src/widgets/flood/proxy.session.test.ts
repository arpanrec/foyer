import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getServiceWidget, logger } = vi.hoisted(() => ({
    getServiceWidget: vi.fn(),
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));

import floodProxyHandler from "@/widgets/flood/proxy";

// Integration test using the real httpProxy and cookie jar against a mock
// flood server, so session cookie handling across login/retry is exercised.
describe("widgets/flood/proxy session cookies", () => {
    let server: Server;
    let validJwt: string | null = null;
    let jwtCounter = 0;

    const getJwt = (req: IncomingMessage) => /jwt=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];

    beforeAll(async () => {
        server = createServer((req, res) => {
            if (req.method === "POST" && req.url === "/api/auth/authenticate") {
                jwtCounter += 1;
                validJwt = `jwt-${jwtCounter}`;
                res.writeHead(200, {
                    "Set-Cookie": `jwt=${validJwt}; HttpOnly; path=/`,
                    "Content-Type": "application/json",
                });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            if (req.method === "GET" && req.url === "/api/torrents") {
                if (validJwt && getJwt(req) === validJwt) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ torrents: {} }));
                    return;
                }
                res.writeHead(401, { "Content-Type": "text/plain" });
                res.end("Unauthorized");
                return;
            }

            res.writeHead(404);
            res.end();
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });

        getServiceWidget.mockResolvedValue({
            type: "flood",
            url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            username: "user",
            password: "pass",
        });
    });

    afterAll(() => {
        server.close();
    });

    const callHandler = async () => {
        const req = { query: { group: "g", service: "svc", endpoint: "torrents", index: "0" } };
        const res = createMockRes();
        await floodProxyHandler(req, res as ApiResponse);
        return res;
    };

    it("logs in and returns data when no session exists yet", async () => {
        const res = await callHandler();
        expect(res.statusCode).toBe(200);
    });

    it("recovers when the cached session cookie has expired server-side", async () => {
        // session died server-side (timeout/restart) but the jar still holds the old cookie
        validJwt = null;

        const res = await callHandler();
        expect(res.statusCode).toBe(200);
    });
});
