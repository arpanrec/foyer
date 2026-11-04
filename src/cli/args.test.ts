import { describe, expect, it } from "vitest";

import { DEFAULT_HOSTNAME, DEFAULT_PORT, listeningMessage, parseCli } from "@/cli/args";

describe("cli/args", () => {
    it.each([[[]], [["--help"]], [["-h"]], [["server", "--help"]]])("shows help for %j", (argv) => {
        expect(parseCli(argv, {})).toEqual({ command: "help" });
    });

    it.each([[["--version"]], [["-v"]]])("shows the version for %j", (argv) => {
        expect(parseCli(argv, {})).toEqual({ command: "version" });
    });

    it("starts the server on the default port and address", () => {
        expect(parseCli(["server"], {})).toEqual({
            command: "server",
            port: DEFAULT_PORT,
            hostname: DEFAULT_HOSTNAME,
            env: { PORT: String(DEFAULT_PORT) },
        });
    });

    it("maps the flags to the environment variables the server reads", () => {
        expect(
            parseCli(
                [
                    "server",
                    "-p",
                    "8080",
                    "-H",
                    "127.0.0.1",
                    "-c",
                    "conf/foyer.config.jsonc.njk",
                    "--allowed-hosts",
                    "a:1,b:2",
                ],
                {}
            )
        ).toEqual({
            command: "server",
            port: 8080,
            hostname: "127.0.0.1",
            env: { PORT: "8080", FOYER_CONFIG_FILE: "conf/foyer.config.jsonc.njk", FOYER_ALLOWED_HOSTS: "a:1,b:2" },
        });
    });

    it("takes the port from PORT when no flag is given", () => {
        expect(parseCli(["server"], { PORT: "4000" })).toMatchObject({ port: 4000, env: { PORT: "4000" } });
    });

    it("prefers the flag over PORT", () => {
        expect(parseCli(["server", "--port", "5000"], { PORT: "4000" })).toMatchObject({ port: 5000 });
    });

    it("ignores HOSTNAME, which often holds the machine name", () => {
        expect(parseCli(["server"], { HOSTNAME: "my-laptop" })).toMatchObject({ hostname: DEFAULT_HOSTNAME });
    });

    it("leaves the config and allowed hosts to the environment when no flag is given", () => {
        const cli = parseCli(["server"], { FOYER_CONFIG_FILE: "/etc/foyer.config.jsonc.njk" });
        expect(cli).toMatchObject({ env: { PORT: "3000" } });
        expect(cli).not.toHaveProperty("env.FOYER_CONFIG_FILE");
    });

    it.each(["0", "65536", "abc", "80.5", "-1"])("rejects the port %j", (port) => {
        expect(parseCli(["server", `--port=${port}`], {})).toEqual({
            command: "error",
            message: `Invalid port: ${port}`,
        });
    });

    it("rejects an invalid PORT", () => {
        expect(parseCli(["server"], { PORT: "nope" })).toEqual({ command: "error", message: "Invalid port: nope" });
    });

    it("rejects an unknown command", () => {
        expect(parseCli(["serve"], {})).toEqual({ command: "error", message: "Unknown command: serve" });
    });

    it("rejects extra arguments", () => {
        expect(parseCli(["server", "now"], {})).toEqual({ command: "error", message: "Unexpected argument: now" });
    });

    it("rejects an unknown flag", () => {
        const cli = parseCli(["server", "--bogus"], {});
        expect(cli.command).toBe("error");
        expect(cli).toHaveProperty("message", expect.stringContaining("--bogus"));
    });

    it("creates a config folder", () => {
        expect(parseCli(["init", "my-config"], {})).toEqual({ command: "init", dir: "my-config" });
    });

    it("rejects an unknown option such as --format", () => {
        expect(parseCli(["init", "my-config", "--format", "ts"], {})).toMatchObject({ command: "error" });
    });

    it.each([[["init"]], [["init", ""]]])("needs a directory for %j", (argv) => {
        expect(parseCli(argv, {})).toEqual({ command: "error", message: "foyer init needs a directory" });
    });

    it("rejects a second directory", () => {
        expect(parseCli(["init", "a", "b"], {})).toEqual({ command: "error", message: "Unexpected argument: b" });
    });

    it("rejects a server option on init", () => {
        expect(parseCli(["init", "a", "--port", "80"], {})).toEqual({
            command: "error",
            message: "--port does not apply to foyer init",
        });
    });

    describe("listeningMessage", () => {
        const hint = "To open it by another host name or address, add <host>:3000 to --allowed-hosts\n";

        it.each([["0.0.0.0"], ["::"], ["[::]"]])("prints localhost for the wildcard bind %s", (hostname) => {
            expect(listeningMessage("1.2.3", hostname, 3000)).toBe(
                `Foyer 1.2.3 listening on http://localhost:3000\n${hint}`
            );
        });

        it("leaves out the hint for a wildcard bind once allowed hosts are set", () => {
            expect(listeningMessage("1.2.3", DEFAULT_HOSTNAME, 3000, "foyer.lan:3000")).toBe(
                "Foyer 1.2.3 listening on http://localhost:3000\n"
            );
        });

        it.each([
            ["localhost", "http://localhost:8080"],
            ["127.0.0.1", "http://127.0.0.1:8080"],
            ["::1", "http://[::1]:8080"],
            ["[::1]", "http://[::1]:8080"],
        ])("prints the loopback bind %s with no hint", (hostname, url) => {
            expect(listeningMessage("1.2.3", hostname, 8080)).toBe(`Foyer 1.2.3 listening on ${url}\n`);
        });

        it.each([
            ["192.168.1.10", "192.168.1.10:3000"],
            ["fd00::10", "[fd00::10]:3000"],
        ])("says to allow the address %s when it is not allowed", (hostname, host) => {
            expect(listeningMessage("1.2.3", hostname, 3000)).toBe(
                `Foyer 1.2.3 listening on http://${host}\nTo open this address, add ${host} to --allowed-hosts\n`
            );
        });

        it.each([["192.168.1.10:3000"], ["a:1,192.168.1.10:3000"], ["*"]])(
            "leaves out the hint when %s allows the address",
            (allowedHosts) => {
                expect(listeningMessage("1.2.3", "192.168.1.10", 3000, allowedHosts)).toBe(
                    "Foyer 1.2.3 listening on http://192.168.1.10:3000\n"
                );
            }
        );
    });
});
