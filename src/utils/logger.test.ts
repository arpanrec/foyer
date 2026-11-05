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

type Listener = (...args: unknown[]) => void;

const { state, winston, mkdirSync, accessSync, statSync, enoent } = vi.hoisted(() => {
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
            end: ReturnType<typeof vi.fn>;
            on: ReturnType<typeof vi.fn>;
            add: ReturnType<typeof vi.fn>;
            remove: ReturnType<typeof vi.fn>;
            listeners: Record<string, Listener>;
            transports: { once: (event: string, listener: () => void) => void }[];
        } = {
            child: vi.fn(() => base),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            end: vi.fn(),
            on: vi.fn((event: string, listener: Listener) => {
                base.listeners[event] = listener;
                return base;
            }),
            add: vi.fn(),
            remove: vi.fn(),
            listeners: {},
            transports: [],
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
        config: { npm: { levels: { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 } } },
        createLogger,
    };

    // foyer.log does not exist yet unless a test says otherwise
    const enoent = () => {
        throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
    };

    return {
        state,
        winston,
        mkdirSync: vi.fn(),
        accessSync: vi.fn(),
        statSync: vi.fn<(path: string) => { isDirectory: () => boolean }>(enoent),
        enoent,
    };
});

vi.mock("winston", () => ({ default: winston, ...winston }));

vi.mock("node:fs", () => ({ mkdirSync, accessSync, statSync, constants: { W_OK: 2 } }));

type MockLogger = {
    warn: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    listeners: Record<string, Listener>;
};

describe("utils/logger", () => {
    const originalEnv = process.env;
    const originalConsole = { ...console };

    beforeEach(() => {
        vi.clearAllMocks();
        statSync.mockImplementation(enoent);
        process.env = { ...originalEnv };
        delete (globalThis as Record<symbol, unknown>)[Symbol.for("foyer.logger")];
    });

    afterEach(() => {
        // Restore patched console methods if init() ran.
        Object.assign(console, originalConsole);
    });

    it("initializes winston on first createLogger() and caches per label", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";

        const createLogger = (await import("@/utils/logger")).default;

        const a1 = createLogger("a");
        const a2 = createLogger("a");
        const b = createLogger("b");

        expect(winston.createLogger).toHaveBeenCalled();
        expect(a1).toBe(a2);
        expect(b).toBeDefined();
    });

    it("selects stdout/file/both transports based on LOG_TARGETS", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/var/log/foyer";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(mkdirSync).toHaveBeenCalledWith("/var/log/foyer/logs", { recursive: true });
        expect(transports).toHaveLength(1);
        expect(transports[0]!.opts.filename).toBe("/var/log/foyer/logs/foyer.log");
        expect(transports[0]!.opts.maxsize).toBe(10 * 1024 * 1024);
        expect(transports[0]!.opts.maxFiles).toBe(5);
        expect(transports[0]!.opts.tailable).toBe(true);
    });

    it("defaults to both transports, with a warning, for unknown LOG_TARGETS and patches console methods", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "wat";

        const createLogger = (await import("@/utils/logger")).default;
        const instance = createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(2);
        const base = state.created.at(-1) as MockLogger;
        expect(base.warn).toHaveBeenCalledWith(
            "Unknown LOG_TARGETS %s, logging to both: use %s",
            "wat",
            "both, stdout, file"
        );

        console.log("hello");
        expect(instance.info).toHaveBeenCalledWith("hello");
    });

    it("reads LOG_TARGETS and LOG_LEVEL regardless of case and surrounding spaces", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = " STDOUT ";
        process.env["LOG_LEVEL"] = "Debug";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs!.transports).toHaveLength(1);
        expect(state.lastCreateLoggerArgs!.level).toBe("debug");
        expect((state.created.at(-1) as MockLogger).warn).not.toHaveBeenCalled();
    });

    it("logs at info, with a warning, for an unknown LOG_LEVEL", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";
        process.env["LOG_LEVEL"] = "warning";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs!.level).toBe("info");
        expect((state.created.at(-1) as MockLogger).warn).toHaveBeenCalledWith(
            "Unknown LOG_LEVEL %s, using %s: use %s",
            "warning",
            "info",
            "error, warn, info, http, verbose, debug, silly"
        );
    });

    it("drops the blank lines Next.js prints through the console", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";

        const createLogger = (await import("@/utils/logger")).default;
        const instance = createLogger("x");

        console.log("");
        console.info();
        console.warn("", "");
        expect(instance.info).not.toHaveBeenCalled();
        expect(instance.warn).not.toHaveBeenCalled();

        console.error("", "boom");
        expect(instance.error).toHaveBeenCalledWith("", "boom");
    });

    it("writes to /tmp/foyer/logs unless FOYER_DATA_DIR is set", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        delete process.env["FOYER_DATA_DIR"];

        const { default: createLogger, logDir } = await import("@/utils/logger");
        createLogger("x");

        expect(logDir()).toBe("/tmp/foyer/logs");
        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports[0]!.opts.filename).toBe("/tmp/foyer/logs/foyer.log");
    });

    it("logs to the console only, with a warning, when the log folder cannot be created", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/read-only";
        mkdirSync.mockImplementationOnce(() => {
            throw new Error("EACCES: permission denied");
        });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(1);
        expect(transports[0]!.opts.filename).toBeUndefined();
        const base = state.created.at(-1) as { warn: ReturnType<typeof vi.fn> };
        expect(base.warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/read-only/logs",
            "EACCES: permission denied"
        );
    });

    it("logs to the console only when the log folder exists but cannot be written", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/tmp/foyer";
        accessSync.mockImplementationOnce(() => {
            throw new Error("EACCES: permission denied");
        });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(accessSync).toHaveBeenCalledWith("/tmp/foyer/logs", 2);
        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(1);
        expect(transports[0]!.opts.filename).toBeUndefined();
        const base = state.created.at(-1) as MockLogger;
        expect(base.warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/tmp/foyer/logs",
            "EACCES: permission denied"
        );
    });

    it("logs to the console only when foyer.log exists but cannot be written", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/app";
        statSync.mockReturnValueOnce({ isDirectory: () => false });
        accessSync.mockImplementation((file: string) => {
            if (file === "/app/logs/foyer.log") throw new Error("EACCES: permission denied");
        });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");
        accessSync.mockReset();

        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(1);
        expect(transports[0]!.opts.filename).toBeUndefined();
        expect((state.created.at(-1) as MockLogger).warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/app/logs",
            "EACCES: permission denied"
        );
    });

    it("writes to an existing foyer.log that is not a folder, such as a named pipe", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/app";
        // a FIFO or a link to /dev/stderr is neither a regular file nor a folder
        statSync.mockReturnValueOnce({ isDirectory: () => false });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(accessSync).toHaveBeenCalledWith("/app/logs/foyer.log", 2);
        const transports = state.lastCreateLoggerArgs!.transports;
        expect(transports).toHaveLength(1);
        expect(transports[0]!.opts.filename).toBe("/app/logs/foyer.log");
        expect((state.created.at(-1) as MockLogger).warn).not.toHaveBeenCalled();
    });

    it("logs to the console only when foyer.log is a folder", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/app";
        statSync.mockReturnValueOnce({ isDirectory: () => true });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs!.transports[0]!.opts.filename).toBeUndefined();
        expect((state.created.at(-1) as MockLogger).warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/app/logs",
            "/app/logs/foyer.log is a folder"
        );
    });

    it("logs to the console only when foyer.log cannot be checked", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/app";
        statSync.mockImplementationOnce(() => {
            throw new Error("EIO: i/o error");
        });

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs!.transports[0]!.opts.filename).toBeUndefined();
        expect((state.created.at(-1) as MockLogger).warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/app/logs",
            "EIO: i/o error"
        );
    });

    it("falls back to the console when the log file fails after start", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/var/log/foyer";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        const [fileTransport] = state.lastCreateLoggerArgs!.transports;
        const base = state.created.at(-1) as MockLogger;
        const onError = base.listeners["error"];
        expect(onError).toBeDefined();

        onError!(new Error("other"), { opts: {} });
        expect(base.remove).not.toHaveBeenCalled();

        onError!(new Error("EACCES: permission denied"), fileTransport);
        onError!(new Error("EACCES: permission denied"), fileTransport);
        expect(base.remove).toHaveBeenCalledTimes(1);
        expect(base.remove).toHaveBeenCalledWith(fileTransport);
        expect(base.add).toHaveBeenCalledTimes(1);
        expect(base.warn).toHaveBeenCalledWith(
            "Cannot write %s to %s, logging to the console only: %s",
            "foyer.log",
            "/var/log/foyer/logs",
            "EACCES: permission denied"
        );
    });

    it("shares one winston logger between copies of the module", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "file";
        process.env["FOYER_DATA_DIR"] = "/var/log/foyer";

        const first = (await import("@/utils/logger")).default("x");
        vi.resetModules();
        const second = (await import("@/utils/logger")).default("x");

        expect(winston.createLogger).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it("does not create the log folder when logging to stdout only", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(mkdirSync).not.toHaveBeenCalled();
    });

    it("closeLogger ends the logger and waits for its transports to finish", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";

        const { default: createLogger, closeLogger } = await import("@/utils/logger");
        await closeLogger();
        createLogger("x");
        const base = state.created.at(-1) as {
            end: ReturnType<typeof vi.fn>;
            transports: { once: (event: string, listener: () => void) => void }[];
        };
        let finish: () => void = () => {};
        base.transports.push({ once: (_event, listener) => (finish = listener) });

        let closed = false;
        const closing = closeLogger().then(() => (closed = true));
        expect(base.end).toHaveBeenCalled();
        await Promise.resolve();
        expect(closed).toBe(false);
        finish();
        await closing;
        expect(closed).toBe(true);
    });

    it("formats messages and stacks through the printf formatter", async () => {
        vi.resetModules();
        process.env["LOG_TARGETS"] = "stdout";
        process.env["LOG_LEVEL"] = "debug";

        const createLogger = (await import("@/utils/logger")).default;
        createLogger("x");

        expect(state.lastCreateLoggerArgs?.level).toBe("debug");

        const [consoleTransport] = state.lastCreateLoggerArgs!.transports;
        const parts = consoleTransport!.opts.format!.parts;
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
