import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("instrumentation", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.NEXTAUTH_SECRET;
        delete process.env.NEXTAUTH_URL;
        delete process.env.FOYER_AUTH_SECRET;
        delete process.env.FOYER_EXTERNAL_URL;
        process.env.NEXT_RUNTIME = "nodejs";
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("maps FOYER_* auth envs to their NextAuth equivalents", async () => {
        process.env.FOYER_AUTH_SECRET = "secret";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        const { register } = await import("@/instrumentation");

        register();

        expect(process.env.NEXTAUTH_SECRET).toBe("secret");
        expect(process.env.NEXTAUTH_URL).toBe("https://foyer.example");
    });

    it("does not override explicitly configured NextAuth envs", async () => {
        process.env.FOYER_AUTH_SECRET = "secret";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        process.env.NEXTAUTH_SECRET = "explicit-secret";
        process.env.NEXTAUTH_URL = "https://explicit.example";
        const { register } = await import("@/instrumentation");

        register();

        expect(process.env.NEXTAUTH_SECRET).toBe("explicit-secret");
        expect(process.env.NEXTAUTH_URL).toBe("https://explicit.example");
    });

    it("is a no-op outside the node runtime", async () => {
        process.env.NEXT_RUNTIME = "edge";
        process.env.FOYER_EXTERNAL_URL = "https://foyer.example";
        const { register } = await import("@/instrumentation");

        register();

        expect(process.env.NEXTAUTH_URL).toBeUndefined();
    });
});
