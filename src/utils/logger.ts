import { format as utilFormat } from "node:util";

import winston from "winston";

import checkAndCopyConfig, { CONF_DIR, getSettings } from "@/utils/config/config";

let winstonLogger: winston.Logger | undefined;

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

function getFileLogger() {
    const settings = getSettings();
    const logpath = settings.logpath || CONF_DIR;

    return new winston.transports.File({
        format: winston.format.combine(
            winston.format.errors({ stack: true, cause: true }),
            combineMessageAndSplat(),
            winston.format.timestamp(),
            winston.format.printf(messageFormatter)
        ),
        filename: `${logpath}/logs/foyer.log`,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        handleExceptions: true,
        handleRejections: true,
    });
}

function init() {
    checkAndCopyConfig("settings.yaml");
    const configuredTargets = process.env.LOG_TARGETS || "both";
    const loggingTransports: winston.transport[] = [];

    switch (configuredTargets) {
        case "both":
            loggingTransports.push(getConsoleLogger(), getFileLogger());
            break;
        case "stdout":
            loggingTransports.push(getConsoleLogger());
            break;
        case "file":
            loggingTransports.push(getFileLogger());
            break;
        default:
            loggingTransports.push(getConsoleLogger(), getFileLogger());
    }

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        transports: loggingTransports,
    });

    // patch the console log mechanism to use our logger
    const consoleMethods = ["log", "debug", "info", "warn", "error"] as const;
    consoleMethods.forEach((method) => {
        // workaround for https://github.com/winstonjs/winston/issues/1591
        const level = method === "log" ? "info" : method;
        console[method] = logger[level].bind(logger) as typeof console.log;
    });

    return logger;
}

const loggers: Record<string, winston.Logger> = {};

export default function createLogger(label: string): winston.Logger {
    winstonLogger ??= init();

    loggers[label] ??= winstonLogger.child({ label });

    return loggers[label];
}
