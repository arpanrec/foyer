import { beforeEach, describe, expect, it, vi } from "vitest";
import type winston from "winston";

import warnOnce, { resetWarnOnce } from "@/utils/warn-once";

describe("utils/warn-once", () => {
    const logger = { warn: vi.fn() };

    beforeEach(() => {
        resetWarnOnce();
        vi.clearAllMocks();
    });

    it("logs a message once, however often it is seen", () => {
        warnOnce(logger as unknown as winston.Logger, "Skipping %s", "A");
        warnOnce(logger as unknown as winston.Logger, "Skipping %s", "A");

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith("Skipping %s", "A");
    });

    it("logs the same template with different values separately", () => {
        warnOnce(logger as unknown as winston.Logger, "Skipping %s", "A");
        warnOnce(logger as unknown as winston.Logger, "Skipping %s", "B");

        expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it("logs again after a reset", () => {
        warnOnce(logger as unknown as winston.Logger, "Skipping");
        resetWarnOnce();
        warnOnce(logger as unknown as winston.Logger, "Skipping");

        expect(logger.warn).toHaveBeenCalledTimes(2);
    });
});
