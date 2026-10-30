import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import cache from "memory-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("utils/config/config", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        cache.del("foyerEnvironmentVariables");
    });

    afterEach(() => {
        process.env = originalEnv;
        cache.del("foyerEnvironmentVariables");
    });

    it("substituteEnvironmentVars replaces FOYER_VAR_* placeholders", async () => {
        process.env.FOYER_VAR_FOO = "bar";

        const mod = await import("@/utils/config/config");
        expect(mod.substituteEnvironmentVars("x {{FOYER_VAR_FOO}} y")).toBe("x bar y");
    });

    it("substituteEnvironmentVars reads FILE values only when their placeholder is used", async () => {
        process.env.FOYER_FILE_EMPTY = "";
        process.env.FOYER_FILE_MISSING = path.join(tmpdir(), "foyer-config-test-missing", "secret.txt");
        process.env.FOYER_VAR_FOO = "bar";

        const mod = await import("@/utils/config/config");
        expect(mod.substituteEnvironmentVars("x {{FOYER_VAR_FOO}} y")).toBe("x bar y");
        expect(() => mod.substituteEnvironmentVars("{{FOYER_FILE_EMPTY}}")).toThrow();
    });

    it("substituteEnvironmentVars replaces FOYER_FILE_* placeholders with file contents", async () => {
        const dir = mkdtempSync(path.join(tmpdir(), "foyer-config-test-"));
        const secretPath = path.join(dir, "secret.txt");
        writeFileSync(secretPath, "secret", "utf8");

        process.env.FOYER_FILE_SECRET = secretPath;

        const mod = await import("@/utils/config/config");
        expect(mod.substituteEnvironmentVars("token={{FOYER_FILE_SECRET}}")).toBe("token=secret");
    });

    it.each(["pa$$word", "pa$&word", "pa$`word", "pa$'word", "pa$1word"])(
        "substituteEnvironmentVars preserves literal environment value %j in every occurrence",
        async (secret) => {
            process.env.FOYER_VAR_SECRET = secret;

            const mod = await import("@/utils/config/config");
            expect(
                mod.substituteEnvironmentVars("before {{FOYER_VAR_SECRET}} between {{FOYER_VAR_SECRET}} after")
            ).toBe(`before ${secret} between ${secret} after`);
        }
    );

    it.each(["pa$$word", "pa$&word", "pa$`word", "pa$'word", "pa$1word"])(
        "substituteEnvironmentVars preserves literal secret file contents %j in every occurrence",
        async (secret) => {
            const dir = mkdtempSync(path.join(tmpdir(), "foyer-config-test-"));
            const secretPath = path.join(dir, "secret.txt");
            writeFileSync(secretPath, secret, "utf8");

            try {
                process.env.FOYER_FILE_SECRET = secretPath;

                const mod = await import("@/utils/config/config");
                expect(
                    mod.substituteEnvironmentVars("before {{FOYER_FILE_SECRET}} between {{FOYER_FILE_SECRET}} after")
                ).toBe(`before ${secret} between ${secret} after`);
            } finally {
                unlinkSync(secretPath);
                rmdirSync(dir);
            }
        }
    );

    it("getSettings reads from FOYER_CONFIG_DIR and converts layout list to an object", async () => {
        const dir = mkdtempSync(path.join(tmpdir(), "foyer-settings-test-"));
        process.env.FOYER_CONFIG_DIR = dir;
        process.env.FOYER_VAR_TITLE = "MyTitle";

        // Create a minimal settings.yaml; checkAndCopyConfig will see it exists and won't copy skeleton.
        writeFileSync(
            path.join(dir, "settings.yaml"),
            ['title: "{{FOYER_VAR_TITLE}}"', "layout:", "  - GroupA:", "      style: row"].join("\n"),
            "utf8"
        );

        vi.resetModules(); // ensure CONF_DIR is computed from updated env
        const mod = await import("@/utils/config/config");

        const settings = mod.getSettings();
        expect(settings.title).toBe("MyTitle");
        expect(settings.layout).toEqual({ GroupA: { style: "row" } });
    });
});
