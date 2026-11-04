import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_TEMPLATE, initConfigDir, templateFiles } from "@/cli/init";

const MEMBERS = ["settings", "services", "bookmarks", "widgets", "docker", "kubernetes", "proxmox"];

describe("cli/init", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "foyer-init-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    describe("templateFiles", () => {
        it("writes a config template that includes one file per member", () => {
            const files = templateFiles("1.2.3");

            expect(Object.keys(files).sort()).toEqual(
                [CONFIG_TEMPLATE, ...MEMBERS.map((member) => `${member}.jsonc.njk`), "custom.css", "custom.js"].sort()
            );
            for (const member of MEMBERS) {
                expect(files[CONFIG_TEMPLATE]).toContain(`"${member}": {% include "./${member}.jsonc.njk" %},`);
            }
            expect(files[CONFIG_TEMPLATE]).toContain('"customCss": {{ customCss | dump }},');
            expect(files[CONFIG_TEMPLATE]).toContain(
                '"$schema": "https://cdn.jsdelivr.net/npm/@arpanrec/foyer@1.2.3/src/foyer-config/foyer.schema.json"'
            );
        });

        // The loader test renders this starter, so it stays loadable
        it("keeps template variables out of JSONC comments", () => {
            for (const contents of Object.values(templateFiles("1.2.3"))) {
                expect(contents).not.toMatch(/\/\/.*\{\{/);
            }
        });
    });

    describe("initConfigDir", () => {
        it("creates the directory, with missing parents, and writes every file", () => {
            const dir = join(root, "a", "b", "config");

            const created = initConfigDir(dir, "1.2.3");

            expect(created.dir).toBe(dir);
            const files = templateFiles("1.2.3");
            expect(created.files).toEqual(Object.keys(files));
            for (const [name, contents] of Object.entries(files)) {
                expect(readFileSync(join(dir, name), "utf8")).toBe(contents);
            }
        });

        it("refuses an existing directory and leaves it untouched", () => {
            const dir = join(root, "config");
            mkdirSync(dir);
            writeFileSync(join(dir, CONFIG_TEMPLATE), "mine");

            expect(() => initConfigDir(dir, "1.2.3")).toThrow(/already exists/);
            expect(readFileSync(join(dir, CONFIG_TEMPLATE), "utf8")).toBe("mine");
            expect(existsSync(join(dir, "settings.jsonc.njk"))).toBe(false);
        });

        it("refuses a path taken by a file", () => {
            const path = join(root, "config");
            writeFileSync(path, "");

            expect(() => initConfigDir(path, "1.2.3")).toThrow(/already exists/);
        });
    });
});
