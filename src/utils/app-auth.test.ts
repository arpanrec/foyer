import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestHeaders, requestCookies } = vi.hoisted(() => ({
    requestHeaders: { current: new Headers() },
    requestCookies: { current: [] as { name: string; value: string }[] },
}));

vi.mock("next/headers", () => ({
    headers: async () => requestHeaders.current,
    cookies: async () => ({ getAll: () => requestCookies.current }),
}));

// Mirror Next.js, where both helpers stop rendering by throwing
vi.mock("next/navigation", () => ({
    notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
    },
    redirect: (url: string) => {
        throw new Error(`NEXT_REDIRECT ${url}`);
    },
}));

const secret = "test-session-secret-at-least-32-characters";

function enableAuth() {
    vi.stubEnv("FOYER_AUTH_ENABLED", "true");
    vi.stubEnv("FOYER_AUTH_SECRET", secret);
    vi.stubEnv("FOYER_EXTERNAL_URL", "http://localhost:3000");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_URL", "");
}

async function sessionCookie() {
    return { name: "next-auth.session-token", value: await encode({ token: { sub: "foyer" }, secret }) };
}

async function loadAppAuth() {
    vi.resetModules();
    return import("@/utils/app-auth");
}

describe("requirePageAuth", () => {
    beforeEach(() => {
        enableAuth();
        requestHeaders.current = new Headers({ host: "localhost:3000" });
        requestCookies.current = [];
    });
    afterEach(() => vi.unstubAllEnvs());

    it("lets a request with a real session through", async () => {
        requestCookies.current = [await sessionCookie()];
        const { requirePageAuth } = await loadAppAuth();

        await expect(requirePageAuth("/", {})).resolves.toBeUndefined();
    });

    it("redirects an anonymous request to sign in, keeping the query in the callback", async () => {
        const { requirePageAuth } = await loadAppAuth();

        await expect(requirePageAuth("/", { tab: "private", tag: ["a", "b"] })).rejects.toThrow(
            "NEXT_REDIRECT /auth/signin?callbackUrl=%2F%3Ftab%3Dprivate%26tag%3Da%26tag%3Db"
        );
    });

    it("skips the session check when auth is disabled", async () => {
        vi.stubEnv("FOYER_AUTH_ENABLED", "false");
        const { requirePageAuth } = await loadAppAuth();

        await expect(requirePageAuth("/", {})).resolves.toBeUndefined();
    });

    it("hides the page from disallowed hosts", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "");
        vi.spyOn(console, "error").mockImplementation(() => {});
        requestHeaders.current = new Headers({ host: "evil.example" });
        requestCookies.current = [await sessionCookie()];
        const { requirePageAuth } = await loadAppAuth();

        await expect(requirePageAuth("/", {})).rejects.toThrow("NEXT_NOT_FOUND");
        vi.restoreAllMocks();
    });
});

describe("withRouteAuth", () => {
    beforeEach(enableAuth);
    afterEach(() => vi.unstubAllEnvs());

    // Next.js hands route handlers a NextRequest, which carries the parsed cookies
    const request = (path: string, headers = {}) =>
        new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000", ...headers } });

    it("runs the handler for a real session and marks the response private", async () => {
        const { value } = await sessionCookie();
        const { withRouteAuth } = await loadAppAuth();
        const handler = vi.fn(async () => new Response("private data"));
        const req = request("/site.webmanifest", { cookie: `next-auth.session-token=${value}` });

        const res = await withRouteAuth(handler)(req, {});

        expect(handler).toHaveBeenCalledWith(req, {});
        expect(await res.text()).toBe("private data");
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("redirects an anonymous request to sign in before the handler runs", async () => {
        const { withRouteAuth } = await loadAppAuth();
        const handler = vi.fn();

        const res = await withRouteAuth(handler)(request("/site.webmanifest?v=4"), {});

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/signin?callbackUrl=%2Fsite.webmanifest%3Fv%3D4"
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it("leaves caching alone when auth is disabled", async () => {
        vi.stubEnv("FOYER_AUTH_ENABLED", "false");
        const { withRouteAuth } = await loadAppAuth();

        const res = await withRouteAuth(async () => new Response("public"))(request("/browserconfig.xml"), {});

        expect(await res.text()).toBe("public");
        expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("returns 404 to disallowed hosts before the handler runs", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "");
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { withRouteAuth } = await loadAppAuth();
        const handler = vi.fn();

        const res = await withRouteAuth(handler)(request("/site.webmanifest", { host: "evil.example" }), {});

        expect(res.status).toBe(404);
        expect(handler).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});
