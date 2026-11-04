#!/usr/bin/env node

// The `foyer` command of the published package. It runs the production build shipped in the package
// with Next.js's own server, in the folder the user started it from, so a relative config path and
// relative paths inside the config resolve as they do for `pnpm start`.

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listeningMessage, parseCli, USAGE } from "./args.js";
import { closeServerLogger } from "./close-logger.js";
import { CONFIG_TEMPLATE, initConfigDir } from "./init.js";

// dist/cli/foyer.js sits two folders below the package root
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Reads the version from the package's `package.json`.
 *
 * @returns The version string, or "unknown" when it is missing.
 */
function packageVersion(): string {
    const pkg: unknown = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
    const version = (pkg as { version?: unknown } | null)?.version;
    return typeof version === "string" ? version : "unknown";
}

/**
 * Prints an error to stderr and exits with status 1.
 *
 * @param message The error text, without the `foyer:` prefix.
 */
function fail(message: string): never {
    process.stderr.write(`foyer: ${message}\n`);
    process.exit(1);
}

/**
 * Starts Next.js's production server for the shipped build and closes it and the logger on SIGINT or SIGTERM.
 *
 * @param port The port to listen on.
 * @param hostname The host name or address to bind.
 * @param env Extra environment variables to apply before Next.js loads.
 */
async function startServer(port: number, hostname: string, env: Record<string, string>) {
    if (!existsSync(join(appDir, ".next", "BUILD_ID"))) {
        fail(`no production build in ${appDir}. Run \`pnpm build\` there first.`);
    }

    // Next.js reads NODE_ENV when it loads, the server looks for public/locales in FOYER_APP_DIR, and
    // FOYER_NPM_PACKAGE turns off the standalone output in next.config.ts, which this server does not use
    Object.assign(process.env, env, {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        FOYER_APP_DIR: appDir,
        FOYER_NPM_PACKAGE: "true",
    });

    const { default: next } = await import("next");
    const app = next({ dev: false, dir: appDir, hostname, port });
    const handle = app.getRequestHandler();
    await app.prepare();

    const server = createServer((req, res) => {
        void handle(req, res);
    });
    server.once("error", (e) => fail(e.message));
    server.listen(port, hostname, () => {
        process.stdout.write(listeningMessage(packageVersion(), hostname, port, process.env["FOYER_ALLOWED_HOSTS"]));
    });

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
            server.close(() => {
                void closeServerLogger().finally(() => process.exit(0));
            });
            server.closeAllConnections();
        });
    }
}

/**
 * Writes a starter config folder and prints how to start Foyer with it, or fails with the reason.
 *
 * @param dir The folder to create.
 */
function initConfig(dir: string) {
    let created;
    try {
        created = initConfigDir(dir, packageVersion());
    } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
    }
    const config = relative(process.cwd(), join(created.dir, CONFIG_TEMPLATE));
    process.stdout.write(
        `Created ${created.dir} with ${created.files.join(", ")}\n\n` +
            `Start Foyer with it:\n  foyer server --config ${config}\n`
    );
}

const cli = parseCli(process.argv.slice(2), process.env);
switch (cli.command) {
    case "help":
        process.stdout.write(USAGE);
        break;
    case "version":
        process.stdout.write(`${packageVersion()}\n`);
        break;
    case "error":
        process.stderr.write(`foyer: ${cli.message}\n\n${USAGE}`);
        process.exit(1);
    case "server":
        await startServer(cli.port, cli.hostname, cli.env);
        break;
    case "init":
        initConfig(cli.dir);
        break;
}
