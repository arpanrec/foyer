import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TransportOptions = {
    filename?: string;
    maxsize?: number;
    maxFiles?: number;
    tailable?: boolean;
    format?: { parts: unknown[] };
};

type CreateLoggerArgs = {
    level?: string;
    transports: { opts: TransportOptions }[];
};

const { state, winston, checkAndCopyConfig, getSettings } = vi.hoisted(() => {
    const state = {
        created: [] as unknown[],
        lastCreateLoggerArgs: null as CreateLoggerArgs | null,
    };

    function ConsoleTransport(this: { opts: TransportOptions }, opts: TransportOptions) {
        this.opts = opts;
    }
    function FileTransport(this: { opts: TransportOptions }, opts: TransportOptions) {
        this.opts = opts;
    }

    const createLogger = vi.fn((args: CreateLoggerArgs) => {
        state.lastCreateLoggerArgs = args;

        const base: {
            child: ReturnType<typeof vi.fn>;
            debug: ReturnType<typeof vi.fn>;
            info: ReturnType<typeof vi.fn>;
            warn: ReturnType<typeof vi.fn>;
            error: ReturnType<typeof vi.fn>;
        } = {
            child: vi.fn(() => base),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        state.created.push(base);
        return base;
    });

    const winston = {
        transports: { Console: ConsoleTransport, File: FileTransport },
        format: {
            combine: (...parts: unknown[]) => ({ parts }),
            errors: () => ({}),
            timestamp: () => ({}),
            colorize: () => ({}),
            printf: (fn: unknown) => fn,
        },
        createLogger,
    };

    return {
        state,
        winston,
        checkAndCopyConfig: vi.fn(),
        getSettings: vi.fn((): Record<string, unknown> => ({ logpath: "/tmp" })),
    };
});

vi.mock("winston", () => ({ default: winston, ...winston }));

vi.mock("@/utils/config/config", () => ({
    default: checkAndCopyConfig,
    CONF_DIR: "/conf",
    getSettings,
}));

describe("utils/logger", () => {
    const originalEnv = process.env;
    const originalConsole = { ...console };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore patched console methods if init() ran.
        Object.assign(console, originalConsole);
    });

    it("initializes winston on first createLogger() and caches per label", async () => {
        vi.resetModules();
        process.env.LOG_TARGETS = "stdout";

        const createLogger = (await import("@/utils/logger")).default;

        const a1 = createLogger("a");
        const a2 = createLogger("a");
        const b = createLogger("b");

        expect(checkAndCopyConfig).toHaveBeenCalledWith("settings.yaml");
        expect(winston.createLogger).toHaveBeenCalled();
        expect(a1).toBe(a2);
        expect(b).toBeDefined();
    });

    it("selects stdout/file/both transports based on LOG_TARGETS", async () => {
        vi.resetModules();
        process.env.LOG_TARGETS = "file";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(1);
        expect(transports[0].opts.filename).toBe("/tmp/logs/foyer.log");
        expect(transports[0].opts.maxsize).toBe(10 * 1024 * 1024);
        expect(transports[0].opts.maxFiles).toBe(5);
        expect(transports[0].opts.tailable).toBe(true);
    });

    it("defaults to both transports for unknown LOG_TARGETS and patches console methods", async () => {
        vi.resetModules();
        process.env.LOG_TARGETS = "wat";

        const createLogger = (await import("@/utils/logger")).default;
        const instance = createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(2);

        console.log("hello");
        expect(instance.info).toHaveBeenCalledWith("hello");
    });

    it("uses CONF_DIR as the default logpath when settings.logpath is not set", async () => {
        vi.resetModules();
        process.env.LOG_TARGETS = "file";
        getSettings.mockReturnValueOnce({});

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports[0].opts.filename).toBe("/conf/logs/foyer.log");
    });

    it("formats messages and stacks through the printf formatter", async () => {
        vi.resetModules();
        process.env.LOG_TARGETS = "stdout";
        process.env.LOG_LEVEL = "debug";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs?.level).toBe("debug");

        const [consoleTransport] = state.lastCreateLoggerArgs!.transports;
        const parts = consoleTransport.opts.format!.parts;
        const formatter = parts.find((p): p is (info: Record<string, unknown>) => string => typeof p === "function")!;
        const splat = parts.find(
            (
                p
            ): p is {
                transform: (
                    info: Record<string | symbol, unknown>,
                    opts: Record<string, unknown>
                ) => { message: string };
            } => Boolean(p && typeof (p as { transform?: unknown }).transform === "function")
        )!;

        const msg = formatter({
            timestamp: "t",
            level: "info",
            label: "x",
            message: "hello",
        });
        expect(msg).toBe("[t] info: <x> hello");

        const labelStackMsg = formatter({
            timestamp: "t",
            level: "error",
            label: "x",
            stack: "STACK",
            message: "ignored",
        });
        expect(labelStackMsg).toBe("[t] error: <x> STACK");

        const stackMsg = formatter({
            timestamp: "t",
            level: "error",
            stack: "STACK",
            message: "ignored",
        });
        expect(stackMsg).toBe("[t] error: STACK");

        const plainMsg = formatter({
            timestamp: "t",
            level: "info",
            message: "hello",
        });
        expect(plainMsg).toBe("[t] info: hello");

        const causeMsg = formatter({
            timestamp: "t",
            level: "error",
            label: "x",
            stack: "STACK",
            message: "fetch failed",
            cause: { stack: "CAUSE STACK" },
        });
        expect(causeMsg).toBe("[t] error: <x> STACK\ncaused by: CAUSE STACK");

        const out = splat.transform(
            {
                message: "Hello %s",
                [Symbol.for("splat")]: ["World"],
            },
            {}
        );
        expect(out.message).toBe("Hello World");
    });
});
