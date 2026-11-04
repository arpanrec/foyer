// Turbopack loads each package in serverExternalPackages through a link in .next/node_modules named
// <package>-<hash>. In this repository those links point into pnpm's node_modules/.pnpm folder, which
// does not exist once the package is installed with npm, and npm drops symlinks when it packs.
// Before packing, this swaps each link for a small package that loads the dependency by its own name,
// so Node.js finds it in the node_modules the installed package was given.
//
// Run with `node src/build/package-externals.ts [.next folder]`; Node.js strips the types.

import {
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHIM_MARKER = "foyerExternal";

export type ShimFiles = Record<string, string>;

// The files of a package named `linkName` that hands out `target`, for require() and import()
export function shimFiles(linkName: string, target: string): ShimFiles {
    const packageJson = {
        name: linkName,
        private: true,
        [SHIM_MARKER]: target,
        exports: {
            import: "./index.mjs",
            require: "./index.cjs",
        },
        main: "./index.cjs",
    };
    const quoted = JSON.stringify(target);
    return {
        "package.json": `${JSON.stringify(packageJson, null, 4)}\n`,
        "index.cjs": `module.exports = require(${quoted});\n`,
        // export * leaves out default, so it is passed on separately; a package without one hands out its namespace
        "index.mjs": `import * as target from ${quoted};\nexport * from ${quoted};\nexport default target.default ?? target;\n`,
    };
}

function readPackageName(dir: string): string | undefined {
    try {
        const pkg: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        if (pkg === null || typeof pkg !== "object") return undefined;
        const record = pkg as Record<string, unknown>;
        const marker = record[SHIM_MARKER];
        if (typeof marker === "string") return marker;
        return typeof record["name"] === "string" ? record["name"] : undefined;
    } catch {
        return undefined;
    }
}

// The entries of .next/node_modules, one level into @scope folders, relative to it
function listEntries(externalsDir: string): string[] {
    const entries: string[] = [];
    for (const name of readdirSync(externalsDir)) {
        const path = join(externalsDir, name);
        if (name.startsWith("@") && lstatSync(path).isDirectory()) {
            for (const scoped of readdirSync(path)) entries.push(`${name}/${scoped}`);
        } else {
            entries.push(name);
        }
    }
    return entries;
}

// Replaces every link in <nextDir>/node_modules with a shim package and returns what each now loads
export function packageExternals(nextDir: string): Record<string, string> {
    const externalsDir = join(nextDir, "node_modules");
    const replaced: Record<string, string> = {};
    if (!existsSync(externalsDir)) return replaced;

    for (const entry of listEntries(externalsDir)) {
        const path = join(externalsDir, entry);
        const stat = lstatSync(path);
        let target: string | undefined;
        if (stat.isSymbolicLink()) {
            target = readPackageName(resolve(dirname(path), readlinkSync(path)));
        } else if (stat.isDirectory()) {
            target = readPackageName(path);
        }
        if (!target) {
            throw new Error(`Cannot tell which package ${path} stands for`);
        }

        rmSync(path, { recursive: true, force: true });
        mkdirSync(path, { recursive: true });
        for (const [file, contents] of Object.entries(shimFiles(entry, target))) {
            writeFileSync(join(path, file), contents);
        }
        replaced[entry] = target;
    }
    return replaced;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const nextDir = resolve(process.argv[2] ?? ".next");
    for (const [entry, target] of Object.entries(packageExternals(nextDir))) {
        process.stdout.write(`${entry} -> ${target}\n`);
    }
}
