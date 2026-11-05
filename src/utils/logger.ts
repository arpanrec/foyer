import { accessSync, constants, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { format as utilFormat } from "node:util";

import winston from "winston";

import { dataDir } from "@/utils/env";
import { errorMessage } from "@/utils/error";

export const LOG_FILE = "foyer.log";

type LoggerState = { logger: winston.Logger; children: Record<string, winston.Logger> };

// Kept on globalThis: instrumentation and each route bundle get their own copy of this module, and one process must
// hold a single File transport, or several would rotate foyer.log on their own
const LOGGER_KEY = Symbol.for("foyer.logger");
type GlobalWithLogger = typeof globalThis & { [LOGGER_KEY]?: LoggerState };

// logs in FOYER_DATA_DIR
export function logDir() {
    return join(dataDir(), "logs");
}

function combineMessageAndSplat() {
    return {
        transform: (info: winston.Logform.TransformableInfo, _opts: unknown) => {
            // combine message and args if any

            const splat = info[Symbol.for("splat")];
            info.message = utilFormat(info.message, ...(Array.isArray(splat) ? splat : []));
            return info;
        },
    };
}

type LogInfo = winston.Logform.TransformableInfo & {
    label?: string;
    timestamp?: string;
    stack?: string;
    cause?: { stack?: string };
};

function messageFormatter(logInfo: LogInfo) {
    const label = logInfo.label ? `<${logInfo.label}> ` : "";
    // e.g. fetch errors say nothing useful without the cause
    const cause = logInfo.cause ? `\ncaused by: ${logInfo.cause.stack ?? logInfo.cause}` : "";
    return `[${logInfo.timestamp}] ${logInfo.level}: ${label}${logInfo.stack || logInfo.message}${cause}`;
}

function getConsoleLogger() {
    return new winston.transports.Console({
        format: winston.format.combine(
            winston.format.errors({ stack: true, cause: true }),
            combineMessageAndSplat(),
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(messageFormatter)
        ),
        handleExceptions: true,
        handleRejections: true,
    });
}

function getFileLogger(dir: string) {
    return new winston.transports.File({
        format: winston.format.combine(
            winston.format.errors({ stack: true, cause: true }),
            combineMessageAndSplat(),
            winston.format.timestamp(),
            winston.format.printf(messageFormatter)
        ),
        filename: join(dir, LOG_FILE),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        handleExceptions: true,
        handleRejections: true,
    });
}

const DEFAULT_LEVEL = "info";
const LOG_TARGETS = ["both", "stdout", "file"] as const;
type LogTarget = (typeof LOG_TARGETS)[number];

function isLogTarget(value: string): value is LogTarget {
    return (LOG_TARGETS as readonly string[]).includes(value);
}

// Throws when foyer.log cannot be written. winston only reports a failed open of the file to its debug output, so a
// foyer.log that is not writable (left by another user, or a folder of that name) would drop every message. Any
// writable target that is not a folder passes, such as a named pipe read by a log shipper or a link to /dev/stderr.
function checkLogFile(dir: string) {
    mkdirSync(dir, { recursive: true });
    // mkdirSync succeeds on a folder that exists, whether or not this user can write to it
    accessSync(dir, constants.W_OK);
    const file = join(dir, LOG_FILE);
    let stats;
    try {
        stats = statSync(file);
    } catch (e) {
        if ((e as NodeJS.ErrnoException | null)?.code === "ENOENT") return;
        throw e;
    }
    if (stats.isDirectory()) throw new Error(`${file} is a folder`);
    accessSync(file, constants.W_OK);
}

function init() {
    // The logger has to start whatever these hold: a bad value is replaced by its default with a warning, since an
    // unknown level would silence every message, the error that stops the server at startup included
    const warnings: [string, ...unknown[]][] = [];

    const rawTargets = process.env["LOG_TARGETS"]?.trim().toLowerCase() || "both";
    let targets: LogTarget = "both";
    if (isLogTarget(rawTargets)) {
        targets = rawTargets;
    } else {
        warnings.push([
            "Unknown LOG_TARGETS %s, logging to both: use %s",
            process.env["LOG_TARGETS"],
            LOG_TARGETS.join(", "),
        ]);
    }
    const toConsole = targets !== "file";
    const toFile = targets !== "stdout";

    const rawLevel = process.env["LOG_LEVEL"]?.trim().toLowerCase() || DEFAULT_LEVEL;
    let level = DEFAULT_LEVEL;
    if (Object.hasOwn(winston.config.npm.levels, rawLevel)) {
        level = rawLevel;
    } else {
        warnings.push([
            "Unknown LOG_LEVEL %s, using %s: use %s",
            process.env["LOG_LEVEL"],
            DEFAULT_LEVEL,
            Object.keys(winston.config.npm.levels).join(", "),
        ]);
    }

    // a log file that cannot be written leaves the console as the only target, so the server still starts
    const dir = logDir();
    let fileError: string | undefined;
    if (toFile) {
        try {
            checkLogFile(dir);
        } catch (e) {
            fileError = errorMessage(e) ?? String(e);
        }
    }

    const fileTransport = toFile && !fileError ? getFileLogger(dir) : undefined;
    const loggingTransports: winston.transport[] = [];
    if (toConsole || fileError) loggingTransports.push(getConsoleLogger());
    if (fileTransport) loggingTransports.push(fileTransport);

    const logger = winston.createLogger({ level, transports: loggingTransports });
    for (const [message, ...args] of warnings) logger.warn(message, ...args);
    if (fileError) {
        logger.warn("Cannot write %s to %s, logging to the console only: %s", LOG_FILE, dir, fileError);
    }

    // winston re-emits transport errors on the logger, such as a failed stat of foyer.log, and an error event nobody
    // listens to would crash the server. A log file that fails this way falls back to the console.
    let fileFailed = false;
    logger.on("error", (e: unknown, transport: unknown) => {
        if (fileFailed || !fileTransport || transport !== fileTransport) return;
        fileFailed = true;
        logger.remove(fileTransport);
        if (!toConsole) logger.add(getConsoleLogger());
        logger.warn(
            "Cannot write %s to %s, logging to the console only: %s",
            LOG_FILE,
            dir,
            errorMessage(e) ?? String(e)
        );
    });

    // patch the console log mechanism to use our logger
    const consoleMethods = ["log", "debug", "info", "warn", "error"] as const;
    consoleMethods.forEach((method) => {
        // workaround for https://github.com/winstonjs/winston/issues/1591
        const level = method === "log" ? "info" : method;
        const log = logger[level].bind(logger) as (...args: unknown[]) => unknown;
        console[method] = (...args: unknown[]) => {
            // Next.js prints blank separator lines, such as the one after its startup banner, which would log as
            // empty timestamped lines
            if (args.every((arg) => arg === "")) return;
            log(...args);
        };
    });

    return logger;
}

const CLOSE_TIMEOUT_MS = 2000;

// Ends the logger and waits until its transports have written everything, for a process that is about to exit
export async function closeLogger() {
    const logger = (globalThis as GlobalWithLogger)[LOGGER_KEY]?.logger;
    if (!logger) return;

    const finished = Promise.all(
        logger.transports.map((transport) => new Promise<void>((resolve) => transport.once("finish", () => resolve())))
    );
    logger.end();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
        timer.unref();
    });
    await Promise.race([finished, timeout]);
    clearTimeout(timer);
}

export default function createLogger(label: string): winston.Logger {
    const state = ((globalThis as GlobalWithLogger)[LOGGER_KEY] ??= { logger: init(), children: {} });

    state.children[label] ??= state.logger.child({ label });

    return state.children[label];
}
