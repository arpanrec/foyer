import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn(async () => null) }));
vi.mock("@/utils/logger", () => ({
    default: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() }),
}));

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const handlerFiles = Object.keys(import.meta.glob("/src/app/api/**/handler.ts"));
const allRoutes = Object.entries(import.meta.glob("/src/app/api/**/route.ts"));
const routes = allRoutes.filter(([file]) => !/\/api\/(auth|mcp|healthcheck)\//.test(file));

function request(path: string, headers: Record<string, string> = {}, method = "GET") {
    return new NextRequest(`http://localhost:3000${path}`, { method, headers });
}

describe("API routes", () => {
    it("gives every handler a route that answers every method", async () => {
        expect(handlerFiles).toHaveLength(allRoutes.length);
        for (const [file, load] of allRoutes) {
            expect(handlerFiles).toContain(file.replace(/route\.ts$/, "handler.ts"));
            const route = (await load()) as Record<string, unknown>;
            expect(METHODS.filter((method) => typeof route[method] !== "function")).toEqual([]);
        }
        // Loads every route module, which is slow while the rest of the suite runs in parallel
    }, 30_000);
});

type RouteHandler = (req: NextRequest, context: { params: Promise<Record<string, unknown>> }) => Promise<Response>;

describe("API authentication without middleware", () => {
    beforeEach(() => vi.stubEnv("FOYER_AUTH_ENABLED", "true"));
    afterEach(() => vi.unstubAllEnvs());

    it.each(routes)("rejects anonymous access to %s", async (_file, load) => {
        const { GET } = (await load()) as { GET: RouteHandler };
        const res = await GET(request("/api/private", { "x-prerender-revalidate": "public-image-key" }), {
            params: Promise.resolve({}),
        });
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("keeps sign-in CSS public while protecting custom JavaScript", async () => {
        const { GET } = await import("@/app/api/config/[path]/route");
        const css = await GET(request("/api/config/custom.css"), { params: Promise.resolve({ path: "custom.css" }) });
        expect(css.status).toBe(200);
        const js = await GET(request("/api/config/custom.js"), { params: Promise.resolve({ path: "custom.js" }) });
        expect(js.status).toBe(401);
    });
});

describe("API host validation without middleware", () => {
    beforeEach(() => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "");
        vi.stubEnv("PORT", "3000");
    });
    afterEach(() => vi.unstubAllEnvs());

    it.each(allRoutes)("rejects disallowed hosts at %s, including public routes", async (_file, load) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { POST } = (await load()) as { POST: RouteHandler };
        const res = await POST(
            request("/api/anything", { host: "evil.example", "x-prerender-revalidate": "public-image-key" }, "POST"),
            { params: Promise.resolve({ path: "custom.css", nextauth: ["session"] }) }
        );
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Host validation failed. See logs for more details." });
    });
});
