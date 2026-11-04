import { afterEach, describe, expect, it, vi } from "vitest";

import { closeServerLogger } from "@/cli/close-logger";

const LOGGER_KEY = Symbol.for("foyer.logger");
const globals = globalThis as { [LOGGER_KEY]?: unknown };

describe("cli/close-logger", () => {
    afterEach(() => {
        delete globals[LOGGER_KEY];
    });

    it("returns at once when the server never created a logger", async () => {
        await expect(closeServerLogger()).resolves.toBeUndefined();
    });

    it("ends the logger and waits for every transport to finish", async () => {
        const listeners: (() => void)[] = [];
        const end = vi.fn(() => listeners.forEach((listener) => listener()));
        const transport = { once: vi.fn((_event: string, listener: () => void) => listeners.push(listener)) };
        globals[LOGGER_KEY] = { logger: { end, transports: [transport, transport] } };

        await closeServerLogger();

        expect(end).toHaveBeenCalledOnce();
        expect(transport.once).toHaveBeenCalledTimes(2);
    });
});
