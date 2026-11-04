import { existsSync, readFileSync } from "fs";
import { createHash, timingSafeEqual } from "node:crypto";

import type { ApiRequest } from "@/types/api";
import { CONFIG_FILE, CONFIG_MEMBERS } from "@/utils/config/core";
import { getConfigErrors } from "@/utils/config/store";
import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("mcp");

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = {
    name: "foyer",
    version: "1.0.0",
};

const MIN_TOKEN_LENGTH = 32;

const CONFIG_RESOURCE_URI = "foyer://config";

const DOC_LINKS: Record<string, string> = {
    settings: "https://foyer.arpanrec.com/configs/settings/",
    services: "https://foyer.arpanrec.com/configs/services/",
    bookmarks: "https://foyer.arpanrec.com/configs/bookmarks/",
    widgets: "https://foyer.arpanrec.com/configs/info-widgets/",
    docker: "https://foyer.arpanrec.com/configs/docker/",
    kubernetes: "https://foyer.arpanrec.com/configs/kubernetes/",
    proxmox: "https://foyer.arpanrec.com/configs/proxmox/",
    customCss: "https://foyer.arpanrec.com/configs/custom-css-js/",
    customJs: "https://foyer.arpanrec.com/configs/custom-css-js/",
};

const MEMBER_DESCRIPTIONS: Record<string, string> = {
    settings: "Application-level settings such as title, theme, providers, layout, language, and quicklaunch.",
    services: "Service groups, links, icons, descriptions, widgets, and status checks shown on the dashboard.",
    bookmarks: "Bookmark groups and links shown separately from services.",
    widgets: "Information widgets such as resources, search, weather, and date/time widgets.",
    docker: "Docker socket, TLS, and discovery settings for Docker-based automatic service discovery.",
    kubernetes: "Kubernetes cluster and ingress discovery settings.",
    proxmox: "Proxmox cluster settings used by Proxmox status features.",
    customCss: "Optional custom stylesheet loaded by the dashboard.",
    customJs: "Optional custom JavaScript loaded by the dashboard.",
};

function enabled() {
    return getEnv("MCP_ENABLED") === "true";
}

function requiredToken() {
    return getEnv("MCP_TOKEN");
}

function tokenMatches(provided: unknown, expectedDigest: Buffer) {
    if (typeof provided !== "string") return false;
    const providedDigest = createHash("sha256").update(provided, "utf8").digest();
    return timingSafeEqual(providedDigest, expectedDigest);
}

type JsonRpcId = string | number | null;

type McpResult = {
    protocolVersion?: string;
    capabilities?: { tools: Record<string, never>; resources: Record<string, never> };
    serverInfo?: typeof SERVER_INFO;
    instructions?: string;
    tools?: ReturnType<typeof toolDefinitions>;
    resources?: ReturnType<typeof configResource>[];
    contents?: { uri?: unknown; mimeType: string; text: string }[];
    content?: { type: string; text: string }[];
    isError?: boolean;
};

type JsonRpcResponse = {
    jsonrpc: "2.0";
    id: JsonRpcId | undefined;
    result?: McpResult;
    error?: { code: number; message: string; data?: unknown };
};

type ToolArguments = {
    member?: string;
    topic?: string;
    [argument: string]: unknown;
};

type JsonRpcRequest = {
    jsonrpc?: unknown;
    id?: JsonRpcId;
    method?: unknown;
    params?: { name?: unknown; arguments?: ToolArguments; uri?: unknown };
};

function jsonRpcResult(id: JsonRpcId | undefined, result: McpResult): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcId | undefined, code: number, message: string, data?: unknown): JsonRpcResponse {
    return {
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
            code,
            message,
            ...(data ? { data } : {}),
        },
    };
}

function textContent(text: string) {
    return {
        content: [
            {
                type: "text",
                text,
            },
        ],
    };
}

function assertKnownMember(member: unknown): asserts member is string {
    if (typeof member !== "string" || !(CONFIG_MEMBERS as readonly string[]).includes(member)) {
        throw new Error(`Unsupported config member '${member}'. Supported members: ${CONFIG_MEMBERS.join(", ")}`);
    }
}

// The source of the config template, not rendered; templates it includes are not read
function readConfig() {
    return existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, "utf8") : "";
}

// A Nunjucks template has no registered media type
const CONFIG_MIME_TYPE = "text/plain";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The members that failed when the config was last loaded
async function loadErrors(member?: unknown) {
    if (member !== undefined) assertKnownMember(member);
    return (await getConfigErrors()).filter((error) => member === undefined || error.config === member);
}

function describeConfig() {
    return {
        configFile: CONFIG_FILE,
        exists: existsSync(CONFIG_FILE),
        members: CONFIG_MEMBERS.map((member) => ({
            member,
            description: MEMBER_DESCRIPTIONS[member],
            docs: DOC_LINKS[member],
        })),
    };
}

function configResource() {
    return {
        uri: CONFIG_RESOURCE_URI,
        name: "config",
        description: `The Foyer config file, ${CONFIG_FILE}`,
        mimeType: CONFIG_MIME_TYPE,
    };
}

function checkConfigResourceUri(uri: unknown) {
    if (uri !== CONFIG_RESOURCE_URI) {
        throw new Error(`Unsupported resource URI. Use ${CONFIG_RESOURCE_URI}.`);
    }
}

function toolDefinitions() {
    return [
        {
            name: "describe_config",
            description:
                "Show the path of the Foyer config file (FOYER_CONFIG_FILE), whether it exists, and the members the object it renders to may have, with links to their docs.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "read_config_file",
            description:
                "Read the source of the Foyer config template (FOYER_CONFIG_FILE) without rendering it. Templates it includes are not read.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "config_load_errors",
            description:
                "List what failed when Foyer last loaded its config: the whole file, or single members. A config with errors is loaded again on the next request; once one loads cleanly, a change takes effect after the reload button in the dashboard footer, or a restart.",
            inputSchema: {
                type: "object",
                properties: {
                    member: { type: "string", enum: CONFIG_MEMBERS },
                },
            },
        },
        {
            name: "foyer_docs",
            description: "Return focused Foyer documentation links for the config file and troubleshooting.",
            inputSchema: {
                type: "object",
                properties: {
                    topic: {
                        type: "string",
                        enum: ["overview", ...CONFIG_MEMBERS, "troubleshooting", "widgets"],
                    },
                },
            },
        },
    ];
}

async function callTool(name: unknown, args: ToolArguments = {}) {
    switch (name) {
        case "describe_config":
            return textContent(JSON.stringify(describeConfig(), null, 2));
        case "read_config_file":
            return textContent(readConfig());
        case "config_load_errors":
            return textContent(JSON.stringify(await loadErrors(args.member), null, 2));
        case "foyer_docs": {
            const topic = args.topic || "overview";
            const links: Record<string, string> = {
                overview: "https://foyer.arpanrec.com/configs/",
                troubleshooting: "https://foyer.arpanrec.com/troubleshooting/",
                widgets: "https://foyer.arpanrec.com/widgets/",
                ...DOC_LINKS,
            };
            return textContent(JSON.stringify({ topic, url: links[topic] || links["overview"] }, null, 2));
        }
        default:
            throw new Error(`Unknown tool '${name}'`);
    }
}

export function mcpEnabled() {
    return enabled();
}

export function mcpTokenConfigError() {
    if (!enabled()) return null;
    const token = requiredToken();
    if (token && token.length < MIN_TOKEN_LENGTH) {
        return `FOYER_MCP_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters. Generate one with: openssl rand -base64 32`;
    }
    return null;
}

export function mcpTokenAuthorized(req: Pick<ApiRequest, "headers">) {
    const headers = req.headers ?? {};
    const token = requiredToken();
    if (!token || token.length < MIN_TOKEN_LENGTH) return false;

    const authHeader = headers.authorization;
    const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const expectedDigest = createHash("sha256").update(token, "utf8").digest();
    if (tokenMatches(bearerToken, expectedDigest)) return true;

    return tokenMatches(headers["x-foyer-mcp-token"], expectedDigest);
}

export async function handleMcpRequest(body: unknown): Promise<JsonRpcResponse | null> {
    const message: JsonRpcRequest = isPlainObject(body) ? body : {};
    const method = message.method;
    if (message.jsonrpc !== "2.0" || typeof method !== "string") {
        return jsonRpcError(message.id, -32600, "Invalid JSON-RPC request");
    }

    if (method.startsWith("notifications/")) {
        return null;
    }

    try {
        switch (method) {
            case "initialize":
                return jsonRpcResult(message.id, {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: {
                        tools: {},
                        resources: {},
                    },
                    serverInfo: SERVER_INFO,
                    instructions:
                        "Foyer MCP reads the Foyer config file, a Nunjucks template that renders to JSONC, and reports errors from loading it. It cannot change it.",
                });
            case "tools/list":
                return jsonRpcResult(message.id, { tools: toolDefinitions() });
            case "tools/call":
                return jsonRpcResult(message.id, await callTool(message.params?.name, message.params?.arguments ?? {}));
            case "resources/list":
                return jsonRpcResult(message.id, { resources: [configResource()] });
            case "resources/read": {
                checkConfigResourceUri(message.params?.uri);
                return jsonRpcResult(message.id, {
                    contents: [
                        {
                            uri: message.params?.uri,
                            mimeType: CONFIG_MIME_TYPE,
                            text: readConfig(),
                        },
                    ],
                });
            }
            default:
                return jsonRpcError(message.id, -32601, `Method not found: ${method}`);
        }
    } catch (error) {
        logger.warn("MCP %s request failed: %s", method, errorMessage(error) ?? String(error));
        return jsonRpcError(message.id, -32602, errorMessage(error) ?? "Unknown error");
    }
}
