import { beforeEach, describe, expect, it, vi } from "vitest";

const { NextResponse, getToken } = vi.hoisted(() => ({
    NextResponse: {
        json: vi.fn((body, init) => ({ type: "json", body, init, status: init?.status, headers: new Headers() })),
        next: vi.fn(() => ({ type: "next", headers: new Headers() })),
        redirect: vi.fn((url) => ({ type: "redirect", url, headers: new Headers() })),
    },
    getToken: vi.fn(),
}));

const { logger } = vi.hoisted(() => ({ logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

vi.mock("next/server", () => ({ NextResponse }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));
vi.mock("next-auth/jwt", () => ({ getToken }));

async function loadProxy() {
    vi.resetModules();
    const mod = await import("@/proxy");
    return mod.proxy;
}

function createReq(host = "localhost:3000", url = "http://localhost:3000/", headers: Record<string, string> = {}) {
    return {
        url,
        headers: {
            get: (key: string) => {
                if (key === "host") return host;
                return headers[key] ?? null;
            },
        },
    };
}

describe("proxy", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env["FOYER_ALLOWED_HOSTS"];
    });

    it("allows requests for default localhost hosts when auth is disabled", async () => {
        process.env["PORT"] = "3000";

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000"));

        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("blocks requests when host is not allowed", async () => {
        process.env["PORT"] = "3000";
        const proxy = await loadProxy();
        const res = await proxy(createReq("evil.com"));

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Host validation failed"), "evil.com");
        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: "Host validation failed. See logs for more details." },
            { status: 400 }
        );
        expect(getToken).not.toHaveBeenCalled();
        expect(res.type).toBe("json");
        expect(res.status).toBe(400);
    });

    it("allows requests when FOYER_ALLOWED_HOSTS is '*'", async () => {
        process.env["FOYER_ALLOWED_HOSTS"] = "*";

        const proxy = await loadProxy();
        const res = await proxy(createReq("anything.example"));

        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("allows requests when host is included in FOYER_ALLOWED_HOSTS", async () => {
        process.env["PORT"] = "3000";
        process.env["FOYER_ALLOWED_HOSTS"] = "example.com:3000,other:3000";

        const proxy = await loadProxy();
        const res = await proxy(createReq("example.com:3000", "http://example.com:3000/"));

        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("allows healthcheck requests without auth when host is allowed", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/api/healthcheck"));

        expect(getToken).not.toHaveBeenCalled();
        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("allows custom CSS without auth so it can style the signin page", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/api/config/custom.css"));

        expect(getToken).not.toHaveBeenCalled();
        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("continues to require auth for custom JavaScript", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce(null);

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/api/config/custom.js"));

        expect(getToken).toHaveBeenCalled();
        expect(res.type).toBe("redirect");
    });

    it.each(["false", "0", "no", "off", ""])("treats FOYER_AUTH_ENABLED=%j as disabled", async (value) => {
        process.env["FOYER_AUTH_ENABLED"] = value;

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/some"));

        expect(getToken).not.toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it.each([
        ["NEXTAUTH_URL", "https://foyer.example", true],
        ["NEXTAUTH_URL", "HTTPS://foyer.example", true],
        ["NEXTAUTH_URL", "  https://foyer.example  ", true],
        ["NEXTAUTH_URL", "HTTP://foyer.example", false],
        ["FOYER_EXTERNAL_URL", "HTTPS://foyer.example", true],
        ["FOYER_EXTERNAL_URL", "  https://foyer.example  ", true],
        ["FOYER_EXTERNAL_URL", "foyer.example", false],
    ])("reads the session cookie NextAuth sets when %s is %j", async (variable, url, secure) => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";
        delete process.env.NEXTAUTH_URL;
        process.env[variable] = url;

        getToken.mockResolvedValueOnce({ sub: "user" });

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/"));

        expect(getToken).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: secure }));
        expect(res.type).toBe("next");
    });

    it("redirects to signin when auth is enabled and no token is present", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce(null);

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/some"));

        expect(getToken).toHaveBeenCalledWith({
            req: expect.objectContaining({ url: "http://localhost:3000/some" }),
            secret: "secret",
            secureCookie: false,
        });
        expect(NextResponse.redirect).toHaveBeenCalled();
        expect(res.type).toBe("redirect");
        expect(String(res.url)).toContain("/auth/signin");
    });

    it("preserves the requested path and query as the callback url", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce(null);

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/some/page?tab=2"));

        expect(new URL(res.url).searchParams.get("callbackUrl")).toBe("/some/page?tab=2");
    });

    it("allows requests when auth is enabled and a token is present", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce({ sub: "user" });

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/"));

        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    it("marks responses private so shared caches cannot store them when auth is enabled", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce({ sub: "user" });

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/"));

        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("marks the signin redirect private as well", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        getToken.mockResolvedValueOnce(null);

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/some"));

        expect(res.type).toBe("redirect");
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("leaves the cache headers of an image route to the route when auth is enabled", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";
        getToken.mockResolvedValue({ sub: "user" });

        const proxy = await loadProxy();
        for (const path of ["/api/icon-proxy", "/api/icons/di/png/plex.png"]) {
            const res = await proxy(createReq("localhost:3000", `http://localhost:3000${path}`));
            expect(res.type).toBe("next");
            expect(res.headers.get("Cache-Control")).toBeNull();
        }
    });

    it("leaves cache headers alone when auth is disabled", async () => {
        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/"));

        expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("delegates MCP authorization to the API handler", async () => {
        process.env["FOYER_AUTH_ENABLED"] = "true";
        process.env["FOYER_AUTH_SECRET"] = "secret";

        const proxy = await loadProxy();
        const res = await proxy(createReq("localhost:3000", "http://localhost:3000/api/mcp"));

        expect(getToken).not.toHaveBeenCalled();
        expect(NextResponse.next).toHaveBeenCalled();
        expect(res.type).toBe("next");
    });

    describe("matcher", () => {
        it("skips the public icon files so the sign-in page can load them", async () => {
            vi.resetModules();
            const { config } = await import("@/proxy");
            const matches = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

            for (const path of [
                "/favicon.ico",
                "/favicon-32x32.png",
                "/favicon-16x16.png",
                "/foyer.ico",
                "/apple-touch-icon.png",
                "/safari-pinned-tab.svg",
            ]) {
                expect(matches(path)).toBe(false);
            }
            expect(matches("/api/services")).toBe(true);
            expect(matches("/site.webmanifest")).toBe(true);
        });
    });

    describe("content security policy", () => {
        it("puts the policy on a page response", async () => {
            const proxy = await loadProxy();
            const res = await proxy(createReq("localhost:3000"));

            expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
        });

        it("leaves it off the image routes so the route's sandbox policy is kept", async () => {
            const proxy = await loadProxy();

            for (const path of ["/api/icon-proxy", "/api/icons/a/b.svg", "/api/background"]) {
                const res = await proxy(createReq("localhost:3000", `http://localhost:3000${path}`));
                expect(res.type).toBe("next");
                expect(res.headers.get("Content-Security-Policy")).toBeNull();
            }
        });

        it("puts it on the sign-in page and the NextAuth endpoints, which need no session or host check", async () => {
            process.env["FOYER_AUTH_ENABLED"] = "true";
            const proxy = await loadProxy();

            for (const path of ["/auth/signin", "/api/auth/session"]) {
                const res = await proxy(createReq("evil.com", `http://evil.com${path}`));
                expect(res.type).toBe("next");
                expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
            }
            expect(getToken).not.toHaveBeenCalled();
        });

        it("puts it on the host validation error", async () => {
            process.env["PORT"] = "3000";
            const proxy = await loadProxy();
            const res = await proxy(createReq("evil.com"));

            expect(res.status).toBe(400);
            expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
        });

        it("puts it on the redirect to sign in", async () => {
            process.env["FOYER_AUTH_ENABLED"] = "true";
            getToken.mockResolvedValue(null);
            const proxy = await loadProxy();
            const res = await proxy(createReq("localhost:3000", "http://localhost:3000/"));

            expect(res.type).toBe("redirect");
            expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
        });

        it("sends a report-only header in report-only mode and none when off", async () => {
            process.env["FOYER_CSP"] = "report-only";
            let res = await (await loadProxy())(createReq("localhost:3000"));
            expect(res.headers.get("Content-Security-Policy")).toBeNull();
            expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain("default-src 'self'");

            process.env["FOYER_CSP"] = "off";
            res = await (await loadProxy())(createReq("localhost:3000"));
            expect(res.headers.get("Content-Security-Policy")).toBeNull();
            expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
        });
    });
});
