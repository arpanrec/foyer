import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession, errorMock } = vi.hoisted(() => ({
    getServerSession: vi.fn(),
    errorMock: vi.fn(),
}));

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/utils/logger", () => ({ default: () => ({ error: errorMock, warn: vi.fn(), debug: vi.fn() }) }));

type McpBody = {
    result?: {
        tools?: { name: string }[];
        resources?: { uri: string }[];
        content?: { text: string }[];
        contents?: { text: string }[];
    };
    error?: { code: number; message: string };
};

function mockResponse() {
    const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as McpBody | undefined,
        setHeader: vi.fn((key: string, value: string | number | readonly string[]) => {
            res.headers[key] = String(value);
        }),
        getHeader: vi.fn((key: string) => res.headers[key]),
        writeHead: vi.fn((code: number) => {
            res.statusCode = code;
            return res;
        }),
        redirect: vi.fn(() => res),
        status: vi.fn((code: number) => {
            res.statusCode = code;
            return res;
        }),
        json: vi.fn((body: unknown) => {
            res.body = body as McpBody;
            return res;
        }),
        send: vi.fn((body?: unknown) => {
            res.body = body as McpBody;
            return res;
        }),
        write: vi.fn(() => res),
        end: vi.fn((body?: unknown) => {
            res.body = body as McpBody;
            return res;
        }),
    };
    return res;
}

async function loadHandler() {
    vi.resetModules();
    return (await import("@/app/api/mcp/handler")).default;
}

describe("app/api/mcp/handler", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        getServerSession.mockReset();
        errorMock.mockReset();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("returns 404 while disabled", async () => {
        delete process.env.FOYER_MCP_ENABLED;
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            { method: "POST", headers: {}, query: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("requires bearer token when configured", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            { method: "POST", headers: {}, query: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("fails closed with 500 when the configured MCP token is too short", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "change-me";
        const handler = await loadHandler();
        const res = mockResponse();

        // even presenting the weak token verbatim must not authorize
        await handler(
            {
                method: "POST",
                headers: { authorization: "Bearer change-me" },
                query: {},
                body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
            },
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(getServerSession).not.toHaveBeenCalled();
        expect(errorMock).toHaveBeenCalledWith(expect.stringContaining("at least 32 characters"));
    });

    it("rejects requests when neither Foyer auth nor an MCP token is configured", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        delete process.env.FOYER_AUTH_ENABLED;
        delete process.env.FOYER_MCP_TOKEN;
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            { method: "POST", headers: {}, query: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } },
            res
        );

        expect(getServerSession).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("handles JSON-RPC requests when enabled and authorized", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            {
                method: "POST",
                headers: { authorization: "Bearer mcp-tok-0123456789abcdefghijklmnopqrstuv" },
                query: {},
                body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
            },
            res
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body?.result?.tools?.length).toBeGreaterThan(0);
    });

    it("allows requests with a NextAuth session when Foyer auth is enabled", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "password";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        getServerSession.mockResolvedValueOnce({ user: { name: "Foyer" } });
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            { method: "POST", headers: {}, query: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } },
            res
        );

        expect(getServerSession).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body?.result?.tools?.length).toBeGreaterThan(0);
    });

    it("rejects requests without a token or session when Foyer auth is enabled", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "password";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        getServerSession.mockResolvedValueOnce(null);
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            { method: "POST", headers: {}, query: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } },
            res
        );

        expect(getServerSession).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("allows bearer token requests when Foyer auth is enabled", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "password";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            {
                method: "POST",
                headers: { authorization: "Bearer mcp-tok-0123456789abcdefghijklmnopqrstuv" },
                query: {},
                body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
            },
            res
        );

        expect(getServerSession).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 202 for JSON-RPC notifications", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            {
                method: "POST",
                headers: { authorization: "Bearer mcp-tok-0123456789abcdefghijklmnopqrstuv" },
                query: {},
                body: { jsonrpc: "2.0", method: "notifications/initialized" },
            },
            res
        );

        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.end).toHaveBeenCalledWith();
    });

    it("rejects non-POST requests", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        await handler(
            {
                method: "GET",
                headers: { authorization: "Bearer mcp-tok-0123456789abcdefghijklmnopqrstuv" },
                query: {},
                body: {},
            },
            res
        );

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    });

    it("answers unauthenticated CORS preflights with 405 rather than 401", async () => {
        process.env.FOYER_MCP_ENABLED = "true";
        process.env.FOYER_MCP_TOKEN = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        const handler = await loadHandler();
        const res = mockResponse();

        // a preflight never carries the Authorization header the browser strips
        await handler(
            {
                method: "OPTIONS",
                headers: {
                    origin: "https://claude.ai",
                    "access-control-request-method": "POST",
                    "access-control-request-headers": "authorization,content-type",
                },
                query: {},
            },
            res
        );

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
        expect(getServerSession).not.toHaveBeenCalled();
    });

    it("still returns 404 for non-POST requests while disabled", async () => {
        delete process.env.FOYER_MCP_ENABLED;
        const handler = await loadHandler();
        const res = mockResponse();

        await handler({ method: "OPTIONS", headers: {}, query: {} }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
