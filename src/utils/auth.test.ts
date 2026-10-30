import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest } from "@/types/api";
import { isAllowedHost, isAuthorized, secureCookie, withAllowedHost, withAuth } from "@/utils/auth";

describe("handler authentication", () => {
    const secret = "test-session-secret-at-least-32-characters";

    beforeEach(() => {
        vi.stubEnv("FOYER_AUTH_ENABLED", "true");
        vi.stubEnv("FOYER_AUTH_SECRET", secret);
        vi.stubEnv("FOYER_EXTERNAL_URL", "http://localhost:3000");
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("NEXTAUTH_URL", "");
    });
    afterEach(() => vi.unstubAllEnvs());

    const request = (cookies: Record<string, string> = {}): ApiRequest => ({
        headers: { "x-prerender-revalidate": "public-image-key" },
        cookies,
        query: {},
    });

    it("rejects anonymous requests before the API handler runs, independently of middleware", async () => {
        const handler = vi.fn();
        const res = createMockRes();
        await withAuth(handler)(request(), res);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "Unauthorized" });
        expect(res.headers["Cache-Control"]).toBe("private, no-store");
        expect(handler).not.toHaveBeenCalled();
    });

    describe.each(["FOYER_EXTERNAL_URL", "NEXTAUTH_URL"])("session cookies with %s", (variable) => {
        it.each([
            ["http://foyer.example", false],
            ["https://foyer.example", true],
            ["HTTP://foyer.example", false],
            ["HTTPS://foyer.example", true],
            ["  https://foyer.example  ", true],
            ["  http://foyer.example  ", false],
        ])("accepts a real session for %s", async (url, secure) => {
            vi.stubEnv(variable, url);
            const cookie = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
            const token = await encode({ token: { sub: "foyer" }, secret });
            const req = request({ [cookie]: token });
            const res = createMockRes();
            const handler = vi.fn(() => res.send("private data"));
            await withAuth(handler)(req, res);
            expect(handler).toHaveBeenCalledWith(req, res);
            expect(res.body).toBe("private data");
            expect(res.headers["Cache-Control"]).toBe("private, no-store");

            expect(await isAuthorized(req)).toBe(true);
        });
    });

    it.each(["expired", "wrong secret", "missing secret", "malformed"])("rejects %s sessions", async (kind) => {
        const token =
            kind === "malformed"
                ? "broken-token"
                : await encode({
                      token: { sub: "foyer" },
                      secret: kind === "wrong secret" ? "different-secret" : secret,
                      maxAge: kind === "expired" ? -60 : 3600,
                  });
        if (kind === "missing secret") vi.stubEnv("FOYER_AUTH_SECRET", "");
        const handler = vi.fn();
        const res = createMockRes();
        await withAuth(handler)(request({ "next-auth.session-token": token }), res);
        expect(res.statusCode).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("allows auth-disabled installations and explicit public resources", async () => {
        const handler = vi.fn();
        await withAuth(handler, { public: () => true })(request(), createMockRes());
        vi.stubEnv("FOYER_AUTH_ENABLED", "false");
        await withAuth(handler)(request(), createMockRes());
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("reads sessions from Web headers and a cookie store, as App Router requests have them", async () => {
        const token = await encode({ token: { sub: "foyer" }, secret });
        const cookies = { getAll: () => [{ name: "next-auth.session-token", value: token }] };
        expect(await isAuthorized({ headers: new Headers(), cookies })).toBe(true);
        expect(await isAuthorized({ headers: new Headers(), cookies: { getAll: () => [] } })).toBe(false);
    });
});

describe("handler host validation", () => {
    beforeEach(() => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "");
        vi.stubEnv("PORT", "3000");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it.each([
        ["localhost:3000", true],
        ["127.0.0.1:3000", true],
        ["[::1]:3000", true],
        ["evil.example", false],
        [undefined, false],
    ])("checks %s against the default hosts", (host, allowed) => {
        expect(isAllowedHost(host)).toBe(allowed);
    });

    it("accepts configured hosts and the wildcard", () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "foyer.example,other:3000");
        expect(isAllowedHost("foyer.example")).toBe(true);
        expect(isAllowedHost("evil.example")).toBe(false);
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "*");
        expect(isAllowedHost("evil.example")).toBe(true);
    });

    it("rejects disallowed hosts before public or authenticated handlers run", async () => {
        const handler = vi.fn();
        const req: ApiRequest = {
            headers: { host: "evil.example", "x-prerender-revalidate": "public-image-key" },
            cookies: {},
            query: {},
        };
        for (const wrapped of [withAllowedHost(handler), withAuth(handler, { public: () => true })]) {
            const res = createMockRes();
            await wrapped(req, res);
            expect(res.statusCode).toBe(400);
        }
        expect(handler).not.toHaveBeenCalled();
    });
});

describe("secureCookie", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_URL", "");
        vi.stubEnv("FOYER_EXTERNAL_URL", "");
    });
    afterEach(() => vi.unstubAllEnvs());

    it.each([
        ["https://foyer.example", true],
        ["HTTPS://foyer.example", true],
        ["  https://foyer.example  ", true],
        ["http://foyer.example", false],
        ["foyer.example", false],
        ["not a url", false],
        ["", false],
    ])("treats %j as secure: %s", (url, secure) => {
        vi.stubEnv("FOYER_EXTERNAL_URL", url);
        expect(secureCookie()).toBe(secure);
    });

    it("prefers NEXTAUTH_URL, as NextAuth does", () => {
        vi.stubEnv("NEXTAUTH_URL", "https://foyer.example");
        vi.stubEnv("FOYER_EXTERNAL_URL", "http://foyer.example");
        expect(secureCookie()).toBe(true);
    });

    it("rejects instead of erroring when the URL is invalid", async () => {
        vi.stubEnv("FOYER_AUTH_ENABLED", "true");
        vi.stubEnv("FOYER_AUTH_SECRET", "test-session-secret-at-least-32-characters");
        vi.stubEnv("FOYER_EXTERNAL_URL", "foyer.example");
        const handler = vi.fn();
        const res = createMockRes();
        await withAuth(handler)({ headers: {}, cookies: {}, query: {} }, res);
        expect(res.statusCode).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });
});
