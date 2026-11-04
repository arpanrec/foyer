import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIG_TEMPLATE, templateFiles } from "@/cli/init";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

describe("utils/config/core", () => {
    const originalEnv = process.env;
    let dir: string;

    // CONFIG_FILE is read from the environment when the module loads
    async function loadModule() {
        vi.resetModules();
        return import("@/utils/config/core");
    }

    function write(file: string, source: string) {
        const full = path.isAbsolute(file) ? file : path.join(dir, file);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, source);
        return full;
    }

    async function load(source: string) {
        write("foyer.config.jsonc.njk", source);
        return (await loadModule()).loadConfig();
    }

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), "foyer-config-test-"));
        process.env = { ...originalEnv, FOYER_CONFIG_FILE: path.join(dir, "foyer.config.jsonc.njk") };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        rmSync(dir, { recursive: true, force: true });
        vi.doUnmock("@/utils/config/core/render");
    });

    it("reads foyer.config.jsonc.njk from the working directory unless FOYER_CONFIG_FILE is set", async () => {
        delete process.env["FOYER_CONFIG_FILE"];
        let config = await loadModule();
        expect(config.DEFAULT_CONFIG_FILE).toBe("foyer.config.jsonc.njk");
        expect(config.CONFIG_FILE).toBe(path.join(process.cwd(), "foyer.config.jsonc.njk"));

        process.env["FOYER_CONFIG_FILE"] = "conf/home.jsonc.njk";
        config = await loadModule();
        expect(config.CONFIG_FILE).toBe(path.join(process.cwd(), "conf", "home.jsonc.njk"));
    });

    it("parses JSONC with comments and trailing commas, and logs what it loaded", async () => {
        const loaded = await load(
            '{\n  // the title\n  "settings": { "title": "Home", },\n  "services": [],\n  "customCss": "body{}",\n}\n'
        );

        expect(loaded.values).toEqual({ settings: { title: "Home" }, services: [], customCss: "body{}" });
        expect(loaded.errors).toEqual([]);
        expect(loaded.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(logger.info).toHaveBeenCalledWith(
            "Loaded the config file %s: %s%s",
            path.join(dir, "foyer.config.jsonc.njk"),
            "settings, services, customCss",
            ""
        );
    });

    it("logs an empty config as having no members", async () => {
        await load("{}");

        expect(logger.info).toHaveBeenCalledWith(expect.any(String), expect.any(String), "no members", "");
    });

    it("gives the template the FOYER_VAR_ environment variables under their full name", async () => {
        process.env["FOYER_VAR_CONFIG_TEST_TITLE"] = "From env";
        process.env["FOYER_VAR_CONFIG_TEST_QUOTED"] = 'say "hi"';

        const loaded = await load(
            '{ "settings": { "title": "{{ FOYER_VAR_CONFIG_TEST_TITLE }}", "quoted": {{ FOYER_VAR_CONFIG_TEST_QUOTED | dump }} } }'
        );

        expect(loaded.values.settings).toEqual({ title: "From env", quoted: 'say "hi"' });
    });

    it.each(["CONFIG_TEST_PLAIN", "FOYER_CONFIG_TEST_SETTING", "foyer_var_CONFIG_TEST_LOWER"])(
        "keeps the environment variable %s out of the template",
        async (name) => {
            process.env[name] = "secret";

            const loaded = await load(
                `{ "settings": { "defined": {% if ${name} is defined %}true{% else %}false{% endif %} } }`
            );

            expect(loaded.errors).toEqual([]);
            expect(loaded.values.settings).toEqual({ defined: false });
        }
    );

    it("treats a FOYER_VAR_ entry with no value as unset", async () => {
        process.env = { ...process.env, FOYER_VAR_CONFIG_TEST_UNSET: undefined };

        const loaded = await load(
            '{ "settings": { "defined": {% if FOYER_VAR_CONFIG_TEST_UNSET is defined %}true{% else %}false{% endif %} } }'
        );

        expect(loaded.values.settings).toEqual({ defined: false });
    });

    it("does not escape output as HTML", async () => {
        process.env["FOYER_VAR_CONFIG_TEST_HTML"] = "<b>&</b>";

        const loaded = await load('{ "settings": { "title": "{{ FOYER_VAR_CONFIG_TEST_HTML }}" } }');

        expect(loaded.values.settings).toEqual({ title: "<b>&</b>" });
    });

    it("fails on a variable that is not set, naming the file and line", async () => {
        const loaded = await load('{\n "settings": { "title": "{{ FOYER_VAR_CONFIG_TEST_MISSING }}" } }');

        expect(loaded.values).toEqual({});
        expect(loaded.errors).toEqual([
            {
                config: "file",
                name: "Template render error",
                reason: expect.stringMatching(/foyer\.config\.jsonc\.njk\) \[Line 2, Column \d+\][\s\S]*undefined/),
            },
        ]);
        expect(logger.error).toHaveBeenCalledWith(
            "Could not load the config file %s: %s",
            path.join(dir, "foyer.config.jsonc.njk"),
            expect.stringContaining("undefined")
        );
    });

    it("includes templates by path relative to the including file, by bare name and by absolute path", async () => {
        const elsewhere = mkdtempSync(path.join(tmpdir(), "foyer-config-elsewhere-"));
        try {
            write(path.join(elsewhere, "bookmarks.jsonc.njk"), '[{ "B": [{ "b": [{ "href": "x" }] }] }]');
            write("parts/services.jsonc.njk", '[{ "G": [{% include "./service.jsonc.njk" %}] }]');
            write("parts/service.jsonc.njk", '{ "S": { "href": "s" } }');
            write("settings.jsonc.njk", '{ "title": "T" }');

            const loaded = await load(
                "{\n" +
                    '  "settings": {% include "settings.jsonc.njk" %},\n' +
                    '  "services": {% include "./parts/services.jsonc.njk" %},\n' +
                    `  "bookmarks": {% include "${path.join(elsewhere, "bookmarks.jsonc.njk")}" %}\n` +
                    "}"
            );

            expect(loaded.errors).toEqual([]);
            expect(loaded.values).toEqual({
                settings: { title: "T" },
                services: [{ G: [{ S: { href: "s" } }] }],
                bookmarks: [{ B: [{ b: [{ href: "x" }] }] }],
            });
        } finally {
            rmSync(elsewhere, { recursive: true, force: true });
        }
    });

    it("extends a base template and reads every file again on each load", async () => {
        write("base.njk", '{ "settings": { "title": "{% block title %}Base{% endblock %}" } }');
        write("foyer.config.jsonc.njk", '{% extends "./base.njk" %}{% block title %}Child{% endblock %}');
        const config = await loadModule();
        expect(config.loadConfig().values.settings).toEqual({ title: "Child" });

        write("base.njk", '{ "settings": { "name": "{% block title %}{% endblock %}" } }');
        expect(config.loadConfig().values.settings).toEqual({ name: "Child" });
    });

    it("fails when an included template does not exist", async () => {
        const loaded = await load('{ "settings": {% include "./missing.njk" %} }');

        expect(loaded.errors[0]?.reason).toMatch(/template not found: .*missing\.njk/);
    });

    it("fails when the config file does not exist", async () => {
        const loaded = (await loadModule()).loadConfig();

        expect(loaded.values).toEqual({});
        expect(loaded.errors).toEqual([
            {
                config: "file",
                name: "Error",
                reason: expect.stringMatching(/foyer\.config\.jsonc\.njk does not exist/),
            },
        ]);
    });

    it("names the line and column of a JSONC syntax error", async () => {
        const loaded = await load('{\n  "settings": { "title": "x" }\n  "services": []\n}');

        expect(loaded.errors).toEqual([
            {
                config: "file",
                name: "SyntaxError",
                reason: "CommaExpected at line 3, column 3 of the rendered config",
            },
        ]);
    });

    it.each([
        ["[]", "an array"],
        ["null", "null"],
        ["5", "a number"],
    ])("refuses a config that renders to %s", async (source, described) => {
        const loaded = await load(source);

        expect(loaded.errors[0]?.reason).toBe(`The config must be a JSON object, not ${described}`);
    });

    it("refuses unknown members and ignores $schema", async () => {
        expect((await load('{ "$schema": "./foyer.schema.json", "settings": {} }')).values).toEqual({ settings: {} });

        const loaded = await load('{ "settings": {}, "service": [], "extra": 1 }');
        expect(loaded.values).toEqual({});
        expect(loaded.errors[0]?.reason).toMatch(/^The config has unknown members: service, extra\. The members are /);
    });

    it.each([
        ["5", "a number"],
        ["[]", "an array"],
        ["null", "null"],
    ])("leaves out customCss when it is %s and loads the rest", async (value, described) => {
        const loaded = await load(`{ "settings": { "title": "x" }, "customCss": ${value}, "customJs": "x()" }`);

        expect(loaded.values).toEqual({ settings: { title: "x" }, customJs: "x()" });
        expect(loaded.errors).toEqual([
            { config: "customCss", name: "Error", reason: `customCss must be a string, not ${described}` },
        ]);
        expect(logger.error).toHaveBeenCalledWith("Failed to load the %s config: %s", "customCss", expect.any(String));
        expect(logger.info).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            "settings, customJs",
            "; 1 member(s) failed to load"
        );
    });

    it("records whatever a failing load threw", async () => {
        vi.doMock("@/utils/config/core/render", () => ({
            renderConfigTemplate: () => {
                // oxlint-disable-next-line no-throw-literal -- any value can be thrown
                throw "broken";
            },
        }));

        const loaded = await load("{}");

        expect(loaded.errors).toEqual([{ config: "file", name: "Error", reason: "broken" }]);
    });

    describe("settings", () => {
        it("turns a layout list into an object and skips entries that are not objects", async () => {
            const loaded = await load(
                '{ "settings": { "layout": [{ "A": { "style": "row" } }, 5, {}, { "B": {} }] } }'
            );

            expect(loaded.values.settings).toEqual({ layout: { A: { style: "row" }, B: {} } });
            expect(logger.warn).toHaveBeenCalledWith("Skipping a settings.layout entry that is not an object: %j", 5);
        });

        it("keeps a layout object and settings that are not an object as written", async () => {
            expect((await load('{ "settings": { "layout": { "A": {} } } }')).values.settings).toEqual({
                layout: { A: {} },
            });
            expect((await load('{ "settings": "x" }')).values.settings).toBe("x");
        });

        it("warns about an unknown color only", async () => {
            await load('{ "settings": { "color": "slate" } }');
            await load('{ "settings": { "color": "" } }');
            expect(logger.warn).not.toHaveBeenCalled();

            await load('{ "settings": { "color": "plaid" } }');
            expect(logger.warn).toHaveBeenCalledWith(
                'Unknown settings.color "%s", using slate. Known colors: %s',
                "plaid",
                expect.stringContaining("slate")
            );
        });
    });

    it("hashes the same values the same way", async () => {
        const config = await loadModule();

        expect(config.toLoadedConfig({ services: [] }).hash).toBe(config.toLoadedConfig({ services: [] }).hash);
        expect(config.toLoadedConfig({ services: [] }).hash).not.toBe(config.toLoadedConfig({}).hash);
        expect(config.toLoadedConfig({}).errors).toEqual([]);
    });

    it("loads the foyer init starter with no variables set", async () => {
        for (const [name, contents] of Object.entries(templateFiles("1.2.3"))) write(name, contents);
        process.env["FOYER_CONFIG_FILE"] = path.join(dir, CONFIG_TEMPLATE);
        delete process.env["FOYER_VAR_OPENWEATHERMAP_API_KEY"];
        delete process.env["FOYER_VAR_PROXMOX_SECRET"];

        const loaded = (await loadModule()).loadConfig();

        expect(loaded.errors).toEqual([]);
        expect(Object.keys(loaded.values)).toEqual([
            "settings",
            "services",
            "bookmarks",
            "widgets",
            "docker",
            "kubernetes",
            "proxmox",
            "customCss",
            "customJs",
        ]);
        expect(loaded.values.customCss).toMatch(/^\/\* {2}\*\/\n\/\* Custom CSS for Foyer/);
        expect(loaded.values.kubernetes).toEqual({ mode: "disabled" });
    });
});
