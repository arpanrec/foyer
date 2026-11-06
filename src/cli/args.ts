import { parseArgs } from "node:util";

export const USAGE = `Usage: foyer <command> [options]

Commands:
  server                     Start the Foyer server
  init <dir>                 Create <dir> with a sample config template, custom.css and custom.js

Options for server:
  -c, --config <file>        Config file (FOYER_CONFIG_FILE, default ./foyer.config.jsonc.njk)
  -p, --port <port>          Port to listen on (PORT, default 3000)
  -H, --hostname <host>      Address to bind to (default 0.0.0.0)
      --allowed-hosts <list> Comma-separated host:port values to accept (FOYER_ALLOWED_HOSTS)

Other options:
  -h, --help                 Show this help
  -v, --version              Show the Foyer version
`;

export const DEFAULT_PORT = 3000;
export const DEFAULT_HOSTNAME = "0.0.0.0";

// Addresses that bind every interface, and the loopback names the server always answers to
const WILDCARD_HOSTS = ["0.0.0.0", "::"];
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];

// What `foyer server` prints once it listens: a URL the server answers, which for a wildcard bind is localhost, since
// the host check rejects 0.0.0.0. An IPv6 address goes in brackets, as it does in the Host header. When the URL needs
// an entry in --allowed-hosts, the message says so.
export function listeningMessage(version: string, hostname: string, port: number, allowedHosts = ""): string {
    const bare = hostname.replace(/^\[(.*)\]$/, "$1");
    const wildcard = WILDCARD_HOSTS.includes(bare);
    const host = wildcard ? "localhost" : bare.includes(":") ? `[${bare}]` : bare;
    let message = `Foyer ${version} listening on http://${host}:${port}\n`;

    const allowed = allowedHosts ? allowedHosts.split(",") : [];
    if (allowed.includes("*")) return message;
    if (wildcard) {
        if (allowed.length === 0) {
            message += `To open it by another host name or address, add <host>:${port} to --allowed-hosts\n`;
        }
    } else if (!LOOPBACK_HOSTS.includes(bare) && !allowed.includes(`${host}:${port}`)) {
        message += `To open this address, add ${host}:${port} to --allowed-hosts\n`;
    }
    return message;
}

const SERVER_OPTIONS = ["config", "port", "hostname", "allowed-hosts"] as const;

export type CliCommand =
    | { command: "help" }
    | { command: "version" }
    | { command: "server"; port: number; hostname: string; env: Record<string, string> }
    | { command: "init"; dir: string }
    | { command: "error"; message: string };

type Env = Record<string, string | undefined>;

function parsePort(value: string): number | undefined {
    if (!/^\d+$/.test(value)) return undefined;
    const port = Number(value);
    return port >= 1 && port <= 65535 ? port : undefined;
}

// Turns the command line into a command; a flag wins over the environment variable it stands for
export function parseCli(argv: string[], env: Env): CliCommand {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            strict: true,
            options: {
                config: { type: "string", short: "c" },
                port: { type: "string", short: "p" },
                hostname: { type: "string", short: "H" },
                "allowed-hosts": { type: "string" },
                help: { type: "boolean", short: "h" },
                version: { type: "boolean", short: "v" },
            },
        });
    } catch (e) {
        return { command: "error", message: e instanceof Error ? e.message : String(e) };
    }

    const { values, positionals } = parsed;
    if (values.help) return { command: "help" };
    if (values.version) return { command: "version" };

    const [command, ...rest] = positionals;
    if (command === undefined) return { command: "help" };
    if (command !== "server" && command !== "init") {
        return { command: "error", message: `Unknown command: ${command}` };
    }

    if (command === "init") {
        // A server option is a mistake, not something to ignore
        const misplaced = SERVER_OPTIONS.find((option) => values[option] !== undefined);
        if (misplaced) return { command: "error", message: `--${misplaced} does not apply to foyer init` };
        const [dir, ...extra] = rest;
        if (dir === undefined || dir === "") return { command: "error", message: "foyer init needs a directory" };
        if (extra.length > 0) return { command: "error", message: `Unexpected argument: ${extra[0]}` };
        return { command: "init", dir };
    }

    if (rest.length > 0) return { command: "error", message: `Unexpected argument: ${rest[0]}` };

    const portValue = values.port ?? env["PORT"];
    let port = DEFAULT_PORT;
    if (portValue !== undefined && portValue !== "") {
        const parsedPort = parsePort(portValue);
        if (parsedPort === undefined) {
            return { command: "error", message: `Invalid port: ${portValue}` };
        }
        port = parsedPort;
    }

    // HOSTNAME is left alone: shells and containers often export it as the machine name, not an address to bind
    const hostname = values.hostname || DEFAULT_HOSTNAME;

    const serverEnv: Record<string, string> = { PORT: String(port) };
    if (values.config) serverEnv["FOYER_CONFIG_FILE"] = values.config;
    if (values["allowed-hosts"]) serverEnv["FOYER_ALLOWED_HOSTS"] = values["allowed-hosts"];

    return { command: "server", port, hostname, env: serverEnv };
}
