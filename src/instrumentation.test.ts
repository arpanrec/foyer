import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger, closeLogger } = vi.hoisted(() => ({
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
    closeLogger: vi.fn(async () => {}),
}));

vi.mock("@/utils/logger", () => ({ default: () => logger, closeLogger }));

describe("instrumentation", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.NEXTAUTH_SECRET;
        delete process.env.NEXTAUTH_URL;
        delete process.env["FOYER_AUTH_SECRET"];
        delete process.env["FOYER_EXTERNAL_URL"];
        process.env.NEXT_RUNTIME = "nodejs";
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("maps FOYER_* auth envs to their NextAuth equivalents", async () => {
        process.env["FOYER_AUTH_SECRET"] = "secret";
        process.env["FOYER_EXTERNAL_URL"] = "https://foyer.example";
        const { register } = await import("@/instrumentation");

        await register();

        expect(process.env.NEXTAUTH_SECRET).toBe("secret");
        expect(process.env.NEXTAUTH_URL).toBe("https://foyer.example");
    });

    it("does not override explicitly configured NextAuth envs", async () => {
        process.env["FOYER_AUTH_SECRET"] = "secret";
        process.env["FOYER_EXTERNAL_URL"] = "https://foyer.example";
        process.env.NEXTAUTH_SECRET = "explicit-secret";
        process.env.NEXTAUTH_URL = "https://explicit.example";
        const { register } = await import("@/instrumentation");

        await register();

        expect(process.env.NEXTAUTH_SECRET).toBe("explicit-secret");
        expect(process.env.NEXTAUTH_URL).toBe("https://explicit.example");
    });

    it("is a no-op outside the node runtime", async () => {
        process.env.NEXT_RUNTIME = "edge";
        process.env["FOYER_EXTERNAL_URL"] = "https://foyer.example";
        const { register } = await import("@/instrumentation");

        await register();

        expect(process.env.NEXTAUTH_URL).toBeUndefined();
    });

    describe("startup failures", () => {
        let exit: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
            process.env["FOYER_AUTH_ENABLED"] = "true";
            process.env["FOYER_EXTERNAL_URL"] = "https://foyer.example";
            process.env["FOYER_AUTH_SECRET"] = "a".repeat(32);
            process.env["FOYER_AUTH_PASSWORD"] = "pw";
        });

        afterEach(() => {
            exit.mockRestore();
        });

        it("keeps running when the auth environment is valid", async () => {
            const { register } = await import("@/instrumentation");

            await register();

            expect(logger.error).not.toHaveBeenCalled();
            expect(exit).not.toHaveBeenCalled();
        });

        it("keeps running when auth is disabled", async () => {
            process.env["FOYER_AUTH_ENABLED"] = "false";
            process.env["FOYER_AUTH_SECRET"] = "short";
            const { register } = await import("@/instrumentation");

            await register();

            expect(exit).not.toHaveBeenCalled();
        });

        it("exits when the auth secret is too short", async () => {
            process.env["FOYER_AUTH_SECRET"] = "short";
            const { register } = await import("@/instrumentation");

            await register();

            expect(logger.error).toHaveBeenCalledWith("Foyer cannot start: %s", expect.stringMatching(/at least 32/));
            expect(closeLogger.mock.invocationCallOrder[0]).toBeLessThan(exit.mock.invocationCallOrder[0]!);
            expect(exit).toHaveBeenCalledWith(1);
        });

        it("logs a thrown value that is not an Error as text", async () => {
            vi.doMock("@/utils/auth-config", () => ({
                validateAuthEnv: () => {
                    throw "auth env broken";
                },
            }));
            const { register } = await import("@/instrumentation");

            await register();
            vi.doUnmock("@/utils/auth-config");

            expect(logger.error).toHaveBeenCalledWith("Foyer cannot start: %s", "auth env broken");
            expect(exit).toHaveBeenCalledWith(1);
        });

        it("exits when the external URL is missing", async () => {
            delete process.env["FOYER_EXTERNAL_URL"];
            const { register } = await import("@/instrumentation");

            await register();

            expect(logger.error).toHaveBeenCalledWith("Foyer cannot start: %s", expect.stringMatching(/is missing/));
            expect(exit).toHaveBeenCalledWith(1);
        });
    });
});
