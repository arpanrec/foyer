import { format } from "node:util";

import type winston from "winston";

const warned = new Set<string>();

// Logs a warning the first time this exact message is seen. For problems in the config, which only changes on a
// restart, so a value read on every request does not repeat the same warning on every request.
export default function warnOnce(logger: winston.Logger, message: string, ...args: unknown[]) {
    const key = format(message, ...args);
    if (warned.has(key)) return;
    warned.add(key);
    logger.warn(message, ...args);
}

// For tests, which load the config more than once in one process
export function resetWarnOnce() {
    warned.clear();
}
