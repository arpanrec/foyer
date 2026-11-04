import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { packageExternals, shimFiles } from "@/build/package-externals";

describe("build/package-externals", () => {
    let root: string;

    function fakePackage(name: string) {
        const dir = join(root, "node_modules", ".pnpm", name.replace("/", "+"), "node_modules", name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
        return dir;
    }

    function link(entry: string, target: string) {
        const path = join(root, ".next", "node_modules", entry);
        mkdirSync(join(path, ".."), { recursive: true });
        symlinkSync(target, path);
    }

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "foyer-externals-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("writes a package that loads the target by name for require and import", () => {
        const files = shimFiles("ws-2239893bf31f98b2", "ws");

        expect(JSON.parse(files["package.json"]!)).toEqual({
            name: "ws-2239893bf31f98b2",
            private: true,
            foyerExternal: "ws",
            exports: { import: "./index.mjs", require: "./index.cjs" },
            main: "./index.cjs",
        });
        expect(files["index.cjs"]).toBe('module.exports = require("ws");\n');
        expect(files["index.mjs"]).toContain('export * from "ws";');
        expect(files["index.mjs"]).toContain("export default target.default ?? target;");
    });

    it("replaces plain and scoped links with shim packages", () => {
        link("winston-cd8887eea177c285", fakePackage("winston"));
        link("@kubernetes/client-node-c14fa8df52c2fb62", fakePackage("@kubernetes/client-node"));

        const replaced = packageExternals(join(root, ".next"));

        expect(replaced).toEqual({
            "winston-cd8887eea177c285": "winston",
            "@kubernetes/client-node-c14fa8df52c2fb62": "@kubernetes/client-node",
        });
        const shim = join(root, ".next", "node_modules", "@kubernetes", "client-node-c14fa8df52c2fb62");
        expect(lstatSync(shim).isSymbolicLink()).toBe(false);
        expect(readFileSync(join(shim, "index.cjs"), "utf8")).toBe(
            'module.exports = require("@kubernetes/client-node");\n'
        );
    });

    it("can run again over packages it already wrote", () => {
        link("winston-cd8887eea177c285", fakePackage("winston"));
        packageExternals(join(root, ".next"));

        expect(packageExternals(join(root, ".next"))).toEqual({ "winston-cd8887eea177c285": "winston" });
    });

    it("does nothing when the build has no external packages", () => {
        mkdirSync(join(root, ".next"));

        expect(packageExternals(join(root, ".next"))).toEqual({});
        expect(existsSync(join(root, ".next", "node_modules"))).toBe(false);
    });

    it("fails on a link whose target is not a package", () => {
        link("broken-0000000000000000", join(root, "missing"));

        expect(() => packageExternals(join(root, ".next"))).toThrow(/broken-0000000000000000/);
    });
});
