import { existsSync as realExistsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { server, createServer, closeServerLogger, existsSync, next, app } = vi.hoisted(() => {
    const server = {
        once: vi.fn(),
        listen: vi.fn((_port: number, _host: string, listening: () => void) => listening()),
        close: vi.fn((closed: () => void) => closed()),
        closeAllConnections: vi.fn(),
    };
    const app = { getRequestHandler: vi.fn(() => vi.fn()), prepare: vi.fn(async () => {}) };
    return {
        server,
        app,
        createServer: vi.fn(() => server),
        closeServerLogger: vi.fn(async () => {}),
        existsSync: vi.fn(() => true),
        next: vi.fn(() => app),
    };
});

vi.mock("node:http", () => ({ createServer }));
vi.mock("node:fs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:fs")>()),
    existsSync,
    readFileSync: vi.fn(() => JSON.stringify({ version: "1.2.3" })),
}));
vi.mock("next", () => ({ default: next }));
vi.mock("@/cli/close-logger", () => ({ closeServerLogger }));

const originalArgv = process.argv;
const originalEnv = { ...process.env };

// The CLI runs when it is imported, so each test sets the arguments and imports a fresh copy
async function run(...args: string[]) {
    process.argv = ["node", "foyer", ...args];
    vi.resetModules();
    await import("@/cli/foyer");
}

describe("cli/foyer", () => {
    let stdout: string;
    let stderr: string;
    let signals: Record<string, () => void>;
    let exit: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        existsSync.mockReturnValue(true);
        stdout = "";
        stderr = "";
        signals = {};
        vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            stdout += String(chunk);
            return true;
        });
        vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
            stderr += String(chunk);
            return true;
        });
        vi.spyOn(process, "once").mockImplementation(((signal: string, handler: () => void) => {
            signals[signal] = handler;
            return process;
        }) as never);
        // A real exit would stop the test run; throwing stops the CLI the same way
        exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`exit ${code}`);
        }) as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.argv = originalArgv;
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) delete process.env[key];
        }
        Object.assign(process.env, originalEnv);
    });

    it("prints the usage for help and the version for version", async () => {
        await run("--help");
        expect(stdout).toContain("Usage: foyer");

        stdout = "";
        await run("--version");
        expect(stdout).toBe("1.2.3\n");
    });

    it("prints the problem and exits with 1 for a bad command", async () => {
        await expect(run("nope")).rejects.toThrow("exit 1");
        expect(stderr).toContain("foyer:");
        expect(exit).toHaveBeenCalledWith(1);
    });

    it("writes a starter config folder for init and says how to start Foyer with it", async () => {
        const parent = mkdtempSync(join(tmpdir(), "foyer-cli-init-"));
        try {
            const dir = join(parent, "my-foyer");

            await run("init", dir);

            expect(realExistsSync(join(dir, "foyer.config.jsonc.njk"))).toBe(true);
            expect(stdout).toContain(`Created ${dir} with foyer.config.jsonc.njk`);
            expect(stdout).toContain(
                `foyer server --config ${relative(process.cwd(), join(dir, "foyer.config.jsonc.njk"))}`
            );
        } finally {
            rmSync(parent, { recursive: true, force: true });
        }
    });

    it("prints the reason and exits with 1 when init cannot create the folder", async () => {
        const parent = mkdtempSync(join(tmpdir(), "foyer-cli-init-"));
        try {
            await expect(run("init", parent)).rejects.toThrow("exit 1");

            expect(stderr).toContain("already exists");
            expect(exit).toHaveBeenCalledWith(1);
        } finally {
            rmSync(parent, { recursive: true, force: true });
        }
    });

    it("fails when the package has no production build", async () => {
        existsSync.mockReturnValue(false);

        await expect(run("server")).rejects.toThrow("exit 1");

        expect(stderr).toContain("no production build");
        expect(next).not.toHaveBeenCalled();
    });

    it("starts Next.js on the given port and says where it listens", async () => {
        await run("server", "--port", "4100", "--hostname", "127.0.0.1");

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ dev: false, hostname: "127.0.0.1", port: 4100 }));
        expect(app.prepare).toHaveBeenCalledOnce();
        expect(server.listen).toHaveBeenCalledWith(4100, "127.0.0.1", expect.any(Function));
        expect(stdout).toContain("Foyer 1.2.3 listening on http://127.0.0.1:4100");
        expect(process.env["NODE_ENV"]).toBe("production");
    });

    it.each(["SIGINT", "SIGTERM"])("closes the server, flushes the logger and exits 0 on %s", async (signal) => {
        await run("server");
        exit.mockImplementation((() => undefined) as never);

        signals[signal]!();

        expect(server.closeAllConnections).toHaveBeenCalledOnce();
        expect(server.close).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
        expect(closeServerLogger).toHaveBeenCalledOnce();
    });

    it("exits only after the logger has flushed", async () => {
        let flushed: () => void = () => {};
        closeServerLogger.mockReturnValueOnce(new Promise<void>((resolve) => (flushed = resolve)));
        await run("server");
        exit.mockImplementation((() => undefined) as never);

        signals["SIGTERM"]!();
        await Promise.resolve();
        expect(exit).not.toHaveBeenCalled();

        flushed();
        await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    });
});
