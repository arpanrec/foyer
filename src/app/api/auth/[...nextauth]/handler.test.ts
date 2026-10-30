import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "@/types/api";

type TestCredentialsProvider = {
    id: string;
    name: string;
    type: string;
    authorize: unknown;
    options: { authorize: (credentials: Record<string, unknown>) => Promise<unknown> };
};

type TestOidcProvider = {
    id: string;
    name: string;
    type: string;
    authorization: { params: { scope: string } };
    profile: (profile: Record<string, unknown>) => unknown;
};

const { debugMock, errorMock, nextAuthMock, warnMock } = vi.hoisted(() => ({
    debugMock: vi.fn(),
    errorMock: vi.fn(),
    nextAuthMock: vi.fn((options) => ({ options })),
    warnMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
    default: nextAuthMock,
}));

vi.mock("@/utils/logger", () => ({
    default: vi.fn(() => ({ debug: debugMock, error: errorMock, warn: warnMock })),
}));

describe("app/api/auth/[...nextauth]/handler", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        debugMock.mockClear();
        errorMock.mockClear();
        nextAuthMock.mockClear();
        warnMock.mockClear();
        process.env = { ...originalEnv };
        delete process.env.FOYER_EXTERNAL_URL;
        delete process.env.NEXTAUTH_SECRET;
        delete process.env.NEXTAUTH_URL;
    });

    it("configures no providers when auth is disabled", async () => {
        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(nextAuthMock).toHaveBeenCalledTimes(1);
        expect(mod.authOptions.providers).toEqual([]);
        expect(mod.authOptions.pages?.signIn).toBe("/auth/signin");
    });

    it("answers the session endpoint with an empty session when auth is disabled", async () => {
        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const json = vi.fn();
        const res = { status: vi.fn(() => ({ json, end: vi.fn() })) };

        await mod.default({ query: { nextauth: ["session"] } }, res as unknown as ApiResponse);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({});
        expect(nextAuthMock).toHaveBeenCalledTimes(1); // built at import, never invoked per-request
    });

    it.each([["providers"], ["csrf"], ["signin"]])(
        "answers the %s endpoint with parseable JSON when auth is disabled",
        async (endpoint) => {
            const mod = await import("@/app/api/auth/[...nextauth]/handler");
            const json = vi.fn();
            const res = { status: vi.fn(() => ({ json, end: vi.fn() })) };

            await mod.default({ query: { nextauth: [endpoint] } }, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({});
        }
    );

    it("does not enable NextAuth's raw debug logger", async () => {
        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(mod.authOptions).not.toHaveProperty("debug");
    });

    it("routes sanitized NextAuth logs through the Foyer logger", async () => {
        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const sensitiveMetadata = {
            error: Object.assign(new Error("State cookie was missing."), { access_token: "sensitive-access-token" }),
            clientSecret: "sensitive-client-secret",
            access_token: "sensitive-access-token",
            id_token: "sensitive-id-token",
        };

        mod.authOptions.logger?.error?.("OAUTH_CALLBACK_ERROR", sensitiveMetadata);
        mod.authOptions.logger?.warn?.("NEXTAUTH_URL");
        mod.authOptions.logger?.debug?.("OAUTH_CALLBACK_RESPONSE", sensitiveMetadata);

        expect(errorMock).toHaveBeenCalledWith("%s: %s", "OAUTH_CALLBACK_ERROR", "State cookie was missing.");
        expect(warnMock).toHaveBeenCalledWith("%s", "NEXTAUTH_URL");
        expect(debugMock).toHaveBeenCalledWith("%s", "OAUTH_CALLBACK_RESPONSE");
        expect(
            JSON.stringify([...errorMock.mock.calls, ...warnMock.mock.calls, ...debugMock.mock.calls])
        ).not.toContain("sensitive");
    });

    it("logs only sanitized authentication lifecycle events", async () => {
        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        await mod.authOptions.events?.signIn?.({
            account: {
                provider: "foyer-oidc",
                type: "oauth",
                providerAccountId: "1",
                access_token: "sensitive-access-token",
                id_token: "sensitive-id-token",
            },
            user: { id: "1", email: "sensitive@example.com" },
        });
        await mod.authOptions.events?.signOut?.({ token: { sub: "sensitive-user-id" }, session: undefined as never });

        expect(debugMock).toHaveBeenNthCalledWith(1, "Sign in via provider '%s'", "foyer-oidc");
        expect(debugMock).toHaveBeenNthCalledWith(2, "Sign out");
        expect(JSON.stringify(debugMock.mock.calls)).not.toContain("sensitive");
    });

    it("maps FOYER_AUTH_SECRET and FOYER_EXTERNAL_URL to NextAuth envs", async () => {
        process.env.FOYER_AUTH_SECRET = "secret";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(process.env.NEXTAUTH_SECRET).toBe("secret");
        expect(process.env.NEXTAUTH_URL).toBe("https://foyer.example");
        expect(mod.authOptions.secret).toBe("secret");
    });

    it("throws when auth is enabled without an external URL", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";

        await expect(import("@/app/api/auth/[...nextauth]/handler")).rejects.toThrow(/FOYER_EXTERNAL_URL.*is missing/i);
    });

    it.each([
        "foyer.example",
        "ftp://foyer.example",
        "https://user:password@foyer.example",
        "https://foyer.example/?unexpected=true",
        "https://foyer.example/#unexpected",
    ])("rejects invalid external URL %s", async (externalUrl) => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = externalUrl;

        await expect(import("@/app/api/auth/[...nextauth]/handler")).rejects.toThrow(/absolute HTTP\(S\) URL/i);
    });

    it("throws when auth is enabled but no provider settings are present", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        await expect(import("@/app/api/auth/[...nextauth]/handler")).rejects.toThrow(
            /Password auth is enabled but required settings are missing/i
        );
    });

    it.each(["short", "a".repeat(31)])("throws when the auth secret is too weak (%j)", async (secret) => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = secret;
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        await expect(import("@/app/api/auth/[...nextauth]/handler")).rejects.toThrow(/at least 32 characters/i);
    });

    it("accepts an auth secret at exactly the minimum length", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "a".repeat(32);
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(mod.authOptions.providers).toHaveLength(1);
    });

    it("does not enforce the secret length when auth is disabled", async () => {
        process.env.FOYER_AUTH_SECRET = "short";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(mod.authOptions.providers).toEqual([]);
    });

    it("builds a password provider when auth is enabled without OIDC config", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const [provider] = mod.authOptions.providers as unknown as TestCredentialsProvider[];

        expect(provider.id).toBe("credentials");
        expect(provider.name).toBe("Credentials");
        expect(provider.type).toBe("credentials");
        expect(typeof provider.authorize).toBe("function");
        expect(mod.authOptions.useSecureCookies).toBe(true);
        await expect(provider.options.authorize({ password: "secret" })).resolves.toEqual({
            id: "foyer",
            name: "Foyer",
        });
        await expect(provider.options.authorize({ password: "wrong" })).resolves.toBeNull();
        await expect(provider.options.authorize({ password: 123 })).resolves.toBeNull();
    });

    it("logs failed password sign-in attempts without recording client-supplied data", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const [provider] = mod.authOptions.providers as unknown as TestCredentialsProvider[];

        await provider.options.authorize({ password: "wrong" });
        await provider.options.authorize({ password: 123 });

        expect(warnMock).toHaveBeenCalledTimes(2);
        expect(warnMock).toHaveBeenCalledWith("Failed password sign-in attempt");
        // the attempted password must never reach the logs
        expect(JSON.stringify(warnMock.mock.calls)).not.toContain("wrong");

        warnMock.mockClear();
        await provider.options.authorize({ password: "secret" });
        expect(warnMock).not.toHaveBeenCalled();
    });

    it("compares multibyte passwords without throwing on unequal byte lengths", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "é";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const [provider] = mod.authOptions.providers as unknown as TestCredentialsProvider[];

        await expect(provider.options.authorize({ password: "a" })).resolves.toBeNull();
        await expect(provider.options.authorize({ password: "é" })).resolves.toEqual({
            id: "foyer",
            name: "Foyer",
        });
    });

    it("supports trusted HTTP deployments without Secure cookies", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "http://192.168.1.20:3000";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(process.env.NEXTAUTH_URL).toBe("http://192.168.1.20:3000");
        expect(mod.authOptions.useSecureCookies).toBe(false);
    });

    it("accepts an explicitly configured NEXTAUTH_URL", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_AUTH_PASSWORD = "secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.NEXTAUTH_URL = "https://foyer.example";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");

        expect(mod.authOptions.useSecureCookies).toBe(true);
    });

    it("builds an OIDC provider when enabled and maps profile fields", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_OIDC_ISSUER = "https://issuer.example/";
        process.env.FOYER_OIDC_CLIENT_ID = "client-id";
        process.env.FOYER_OIDC_CLIENT_SECRET = "client-secret";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        process.env.FOYER_OIDC_NAME = "My OIDC";
        process.env.FOYER_OIDC_SCOPE = "openid email";

        const mod = await import("@/app/api/auth/[...nextauth]/handler");
        const [provider] = mod.authOptions.providers as unknown as TestOidcProvider[];

        expect(provider).toMatchObject({
            id: "foyer-oidc",
            name: "My OIDC",
            type: "oauth",
            idToken: true,
            checks: ["pkce", "state", "nonce"],
            issuer: "https://issuer.example",
            wellKnown: "https://issuer.example/.well-known/openid-configuration",
            clientId: "client-id",
            clientSecret: "client-secret",
        });
        expect(provider.authorization.params.scope).toBe("openid email");

        expect(
            provider.profile({
                sub: "sub",
                preferred_username: "user",
                email: "user@example.com",
                picture: "https://example.com/p.png",
            })
        ).toEqual({
            id: "sub",
            name: "user",
            email: "user@example.com",
            image: "https://example.com/p.png",
        });

        expect(
            provider.profile({
                id: "id",
                name: "name",
            })
        ).toEqual({
            id: "id",
            name: "name",
            email: null,
            image: null,
        });
    });

    it("throws when only partial OIDC settings are provided", async () => {
        process.env.FOYER_AUTH_ENABLED = "true";
        process.env.FOYER_OIDC_ISSUER = "https://issuer.example";
        process.env.FOYER_AUTH_SECRET = "rk3Xk9wQ0mVJt7cZbN2yLpA8sHdF4gRuEwTiOaSvBnM=";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";

        await expect(import("@/app/api/auth/[...nextauth]/handler")).rejects.toThrow(
            /OIDC auth is enabled but required settings are missing/i
        );
    });
});
