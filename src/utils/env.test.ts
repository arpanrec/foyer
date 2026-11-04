import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv, isAuthEnabled } from "@/utils/env";

describe("utils/env", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("reads FOYER_* variables", () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "foyer.example");

        expect(getEnv("ALLOWED_HOSTS")).toBe("foyer.example");
    });

    it("returns undefined when unset", () => {
        vi.stubEnv("FOYER_UNSET_FOR_TEST", undefined);

        expect(getEnv("UNSET_FOR_TEST")).toBeUndefined();
    });

    it("enables auth from FOYER_AUTH_ENABLED", () => {
        vi.stubEnv("FOYER_AUTH_ENABLED", "true");
        expect(isAuthEnabled()).toBe(true);

        vi.stubEnv("FOYER_AUTH_ENABLED", "false");
        expect(isAuthEnabled()).toBe(false);
    });
});
