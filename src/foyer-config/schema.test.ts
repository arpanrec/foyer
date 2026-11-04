import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, it } from "vitest";

import schema from "@/foyer-config/foyer.schema.json";
import { CONFIG_MEMBERS, type ConfigMember } from "@/utils/config/core";

type SchemaMember = Exclude<keyof typeof schema.properties, "$schema">;

describe("foyer-config/foyer.schema.json", () => {
    it("is exported from the package and shipped in it", () => {
        const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
            exports: Record<string, unknown>;
            files: string[];
        };

        expect(pkg.exports["./schema.json"]).toBe("./src/foyer-config/foyer.schema.json");
        expect(pkg.files).toContain("src/foyer-config/foyer.schema.json");
    });

    it("has one property for each member the loader reads, plus $schema", () => {
        expect(Object.keys(schema.properties).sort()).toEqual(["$schema", ...CONFIG_MEMBERS].sort());
        expectTypeOf<SchemaMember>().toEqualTypeOf<ConfigMember>();
        expect(schema.additionalProperties).toBe(false);
    });

    // Settings is closed, so a misspelled key is flagged in the editor
    it("allows only the settings Foyer reads", () => {
        expect(schema.$defs.settings.additionalProperties).toBe(false);
        expect(Object.keys(schema.$defs.settings.properties)).toEqual(
            expect.arrayContaining(["title", "theme", "color", "layout", "instanceName"])
        );
    });

    it("resolves every $ref", () => {
        const refs = JSON.stringify(schema).match(/"\$ref":"#\/\$defs\/[^"]+"/g) ?? [];
        for (const ref of refs) {
            const name = ref.slice('"$ref":"#/$defs/'.length, -1);
            expect(schema.$defs, ref).toHaveProperty(name);
        }
        expect(refs.length).toBeGreaterThan(0);
    });
});
