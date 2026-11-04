// Foyer's logger keeps its winston instance on globalThis under this key (see src/utils/logger.ts), so the CLI,
// which is compiled on its own and cannot import the server code, can end it from the same process.
const LOGGER_KEY = Symbol.for("foyer.logger");
const CLOSE_TIMEOUT_MS = 2000;

type Transport = { once(event: "finish", listener: () => void): unknown };
type EndableLogger = { end(): unknown; transports: Transport[] };

/**
 * Ends the server's logger and waits until its transports have written everything, or until the close timeout passes, for a process that is about to exit.
 */
export async function closeServerLogger(): Promise<void> {
    const state = (globalThis as { [LOGGER_KEY]?: { logger?: EndableLogger } })[LOGGER_KEY];
    const logger = state?.logger;
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
