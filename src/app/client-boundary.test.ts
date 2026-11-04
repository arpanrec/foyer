import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Unit tests render every component in jsdom as a client component, so they never notice a
 * server component that reaches client-only code. Next.js only fails at request time with
 * "createContext only works in Client Components". This test walks the static imports of every
 * App Router file that is a server component and fails when it reaches a module that uses
 * client-only APIs without the "use client" directive.
 */

const srcDir = path.resolve(__dirname, "..");
const appDir = path.join(srcDir, "app");

const ROUTE_FILE = /^(page|layout|loading|template|default|not-found)\.tsx?$/;
const CLIENT_ONLY_REACT_APIS = [
    "useState",
    "useEffect",
    "useLayoutEffect",
    "useReducer",
    "useRef",
    "useContext",
    "useCallback",
    "useMemo",
    "useTransition",
    "useSyncExternalStore",
    "useImperativeHandle",
    "useInsertionEffect",
    "useDeferredValue",
    "createContext",
];
const CLIENT_ONLY_NAVIGATION_HOOKS = [
    "useRouter",
    "usePathname",
    "useSearchParams",
    "useParams",
    "useSelectedLayoutSegment",
];
const CLIENT_ONLY_MODULES = ["next-i18next/pages", "swr"];

// A linear scan rather than a regex: nested quantifiers around comments backtrack exponentially on crafted input
function hasUseClient(source: string): boolean {
    let i = 0;
    while (i < source.length) {
        if (/\s/.test(source.charAt(i))) {
            i += 1;
        } else if (source.startsWith("//", i)) {
            const end = source.indexOf("\n", i);
            if (end === -1) return false;
            i = end + 1;
        } else if (source.startsWith("/*", i)) {
            const end = source.indexOf("*/", i + 2);
            if (end === -1) return false;
            i = end + 2;
        } else {
            break;
        }
    }
    return source.startsWith('"use client"', i) || source.startsWith("'use client'", i);
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

function resolveImport(from: string, specifier: string): string | null {
    let base: string;
    if (specifier.startsWith("@/")) base = path.join(srcDir, specifier.slice(2));
    else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
    else return null;

    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
    return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function staticImports(source: string): { specifier: string; names: string[] }[] {
    const result: { specifier: string; names: string[] }[] = [];
    const re = /^\s*import\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm;
    for (const match of source.matchAll(re)) {
        const clause = match[1] ?? "";
        const names = [...clause.replace(/[{}]/g, ",").split(",")]
            .map((n) =>
                n
                    .trim()
                    .split(/\s+as\s+/)[0]
                    ?.trim()
            )
            .filter((n): n is string => Boolean(n));
        result.push({ specifier: match[2] ?? "", names });
    }
    return result;
}

function clientOnlyUsage(source: string): string[] {
    const found: string[] = [];
    for (const { specifier, names } of staticImports(source)) {
        if (specifier === "react") {
            found.push(...names.filter((n) => CLIENT_ONLY_REACT_APIS.includes(n)).map((n) => `react ${n}`));
        } else if (specifier === "next/navigation") {
            found.push(
                ...names.filter((n) => CLIENT_ONLY_NAVIGATION_HOOKS.includes(n)).map((n) => `next/navigation ${n}`)
            );
        } else if (CLIENT_ONLY_MODULES.includes(specifier)) {
            found.push(specifier);
        }
    }
    return found;
}

function findViolations(): string[] {
    const roots = walk(appDir).filter((f) => ROUTE_FILE.test(path.basename(f)));
    const violations = new Set<string>();

    for (const root of roots) {
        const visited = new Set<string>();
        const stack: { file: string; chain: string[] }[] = [{ file: root, chain: [] }];

        while (stack.length > 0) {
            const { file, chain } = stack.pop()!;
            if (visited.has(file)) continue;
            visited.add(file);

            const source = readFileSync(file, "utf8");
            // A client module is a boundary: everything it imports is client code too.
            if (hasUseClient(source)) continue;

            const rel = (f: string) => path.relative(srcDir, f);
            const usage = clientOnlyUsage(source);
            if (usage.length > 0) {
                violations.add(
                    `${rel(file)} uses ${[...new Set(usage)].join(", ")} without "use client" (reached from ${[
                        ...chain,
                        file,
                    ]
                        .map(rel)
                        .join(" -> ")})`
                );
            }

            for (const { specifier } of staticImports(source)) {
                const resolved = resolveImport(file, specifier);
                if (resolved) stack.push({ file: resolved, chain: [...chain, file] });
            }
        }
    }

    return [...violations].sort();
}

describe("app/client-boundary", () => {
    it("finds the route files it checks", () => {
        const roots = walk(appDir).filter((f) => ROUTE_FILE.test(path.basename(f)));
        expect(roots.map((f) => path.basename(f))).toEqual(
            expect.arrayContaining(["page.tsx", "layout.tsx", "loading.tsx"])
        );
    });

    it("detects client-only APIs in a module without the directive", () => {
        expect(clientOnlyUsage('import { useState } from "react";')).toEqual(["react useState"]);
        expect(clientOnlyUsage('import { useTranslation } from "next-i18next/pages";')).toEqual(["next-i18next/pages"]);
        expect(clientOnlyUsage('import { Suspense } from "react";')).toEqual([]);
        expect(hasUseClient('"use client";\n\nimport x from "y";')).toBe(true);
        expect(hasUseClient('import x from "y";')).toBe(false);
        expect(hasUseClient("// note\n/* a */\n/* b */ 'use client';\nimport x from \"y\";")).toBe(true);
        expect(hasUseClient('/* open\n"use client";')).toBe(false);
        expect(hasUseClient(`/*${"*//*".repeat(50_000)}`)).toBe(false);
    });

    it("never reaches client-only code from a server component without a use client boundary", () => {
        expect(findViolations()).toEqual([]);
    });
});
