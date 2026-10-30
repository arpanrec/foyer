import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { join } from "path";

import * as yaml from "js-yaml";

import type { ApiRequest } from "@/types/api";
import { CONF_DIR } from "@/utils/config/config";
import { loadYaml } from "@/utils/config/yaml";
import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = {
    name: "foyer",
    version: "1.0.0",
};

const MIN_TOKEN_LENGTH = 32;

const CONFIG_FILES = [
    "settings.yaml",
    "services.yaml",
    "bookmarks.yaml",
    "widgets.yaml",
    "docker.yaml",
    "kubernetes.yaml",
    "proxmox.yaml",
    "custom.css",
    "custom.js",
];

const YAML_CONFIG_FILES = CONFIG_FILES.filter((file) => file.endsWith(".yaml"));

const DOC_LINKS: Record<string, string> = {
    "settings.yaml": "https://foyer.arpanrec.com/configs/settings/",
    "services.yaml": "https://foyer.arpanrec.com/configs/services/",
    "bookmarks.yaml": "https://foyer.arpanrec.com/configs/bookmarks/",
    "widgets.yaml": "https://foyer.arpanrec.com/configs/info-widgets/",
    "docker.yaml": "https://foyer.arpanrec.com/configs/docker/",
    "kubernetes.yaml": "https://foyer.arpanrec.com/configs/kubernetes/",
    "proxmox.yaml": "https://foyer.arpanrec.com/configs/proxmox/",
    "custom.css": "https://foyer.arpanrec.com/configs/custom-css-js/",
    "custom.js": "https://foyer.arpanrec.com/configs/custom-css-js/",
};

const FILE_DESCRIPTIONS: Record<string, string> = {
    "settings.yaml": "Application-level settings such as title, theme, providers, layout, language, and quicklaunch.",
    "services.yaml": "Service groups, links, icons, descriptions, widgets, and status checks shown on the dashboard.",
    "bookmarks.yaml": "Bookmark groups and links shown separately from services.",
    "widgets.yaml": "Information widgets such as resources, search, weather, calendar, and date/time widgets.",
    "docker.yaml": "Docker socket, TLS, and discovery settings for Docker-based automatic service discovery.",
    "kubernetes.yaml": "Kubernetes cluster and ingress discovery settings.",
    "proxmox.yaml": "Proxmox cluster settings used by Proxmox status features.",
    "custom.css": "Optional custom stylesheet loaded by Foyer.",
    "custom.js": "Optional custom JavaScript loaded by Foyer.",
};

function enabled() {
    return getEnv("MCP_ENABLED") === "true";
}

function writeEnabled() {
    return getEnv("MCP_ALLOW_WRITE") === "true";
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
    file?: string;
    content?: unknown;
    topic?: string;
    group?: unknown;
    name?: unknown;
    service?: unknown;
    type?: unknown;
    options?: unknown;
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

function assertKnownConfigFile(file: unknown): asserts file is string {
    if (typeof file !== "string" || !CONFIG_FILES.includes(file)) {
        throw new Error(`Unsupported config file '${file}'. Supported files: ${CONFIG_FILES.join(", ")}`);
    }
}

function configPath(file: string) {
    assertKnownConfigFile(file);
    return join(CONF_DIR, file);
}

function fileExists(file: string) {
    return existsSync(configPath(file));
}

function readConfig(file: string) {
    const path = configPath(file);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const PLACEHOLDER_PATTERN = /(["']?)\{\{([^{}]*)\}\}\1/g;
const ENV_KEY_PATTERN = /FOYER_(?:VAR|FILE)_/;
const PLACEHOLDER_TOKEN_PATTERN = /__FOYER_MCP_PLACEHOLDER_(\d+)__/g;

// mask {{FOYER_*}} placeholders so they survive a parse/dump round-trip
function parseYamlConfig(file: string) {
    const placeholders: string[] = [];
    const masked = readConfig(file).replace(PLACEHOLDER_PATTERN, (match: string, _quote: string, key: string) => {
        if (!ENV_KEY_PATTERN.test(key)) return match;
        placeholders.push(match);
        return `__FOYER_MCP_PLACEHOLDER_${placeholders.length - 1}__`;
    });
    return { data: loadYaml(masked) ?? [], placeholders };
}

function validateYaml(file: string, content: unknown) {
    if (!YAML_CONFIG_FILES.includes(file)) {
        return { valid: true };
    }

    try {
        loadYaml(String(content || ""));
        return { valid: true };
    } catch (error) {
        const { mark } = error as { mark?: { line: number; column: number; snippet?: string } };
        return {
            valid: false,
            error: errorMessage(error),
            mark: mark
                ? {
                      line: mark.line + 1,
                      column: mark.column + 1,
                      snippet: mark.snippet,
                  }
                : undefined,
        };
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
    if (!isPlainObject(value)) {
        throw new Error(`${name} must be an object`);
    }
}

function ensureWriteEnabled() {
    if (!writeEnabled()) {
        return {
            isError: true,
            ...textContent("Writing is disabled. Set FOYER_MCP_ALLOW_WRITE=true to enable MCP config edits."),
        };
    }
    return null;
}

function dumpYamlConfig(file: string, content: unknown, placeholders: string[]) {
    const dumped = yaml
        .dump(content, { lineWidth: -1, noRefs: true })
        .replace(PLACEHOLDER_TOKEN_PATTERN, (match, index: string) => placeholders[Number(index)] ?? match);
    mkdirSync(CONF_DIR, { recursive: true });
    writeFileSync(configPath(file), dumped, "utf8");
    return dumped;
}

function addService(args: ToolArguments) {
    const disabled = ensureWriteEnabled();
    if (disabled) return disabled;

    if (typeof args.group !== "string" || !args.group.trim()) {
        throw new Error("group must be a non-empty string");
    }
    if (typeof args.name !== "string" || !args.name.trim()) {
        throw new Error("name must be a non-empty string");
    }

    const validation = validateYaml("services.yaml", readConfig("services.yaml"));
    if (!validation.valid) {
        return {
            isError: true,
            ...textContent(JSON.stringify(validation, null, 2)),
        };
    }

    const { data: services, placeholders } = parseYamlConfig("services.yaml");
    if (!Array.isArray(services)) {
        throw new Error("services.yaml must contain a top-level array");
    }

    const groupName = args.group.trim();
    const serviceName = args.name.trim();
    const serviceConfig = args.service ?? {};
    assertPlainObject(serviceConfig, "service");

    let group = services.find(
        (entry): entry is Record<string, unknown> => isPlainObject(entry) && Object.keys(entry)[0] === groupName
    );
    if (!group) {
        group = { [groupName]: [] };
        services.push(group);
    }

    const groupServices = group[groupName];
    if (!Array.isArray(groupServices)) {
        throw new Error(`Group '${groupName}' must contain an array`);
    }

    if (groupServices.some((entry) => isPlainObject(entry) && Object.keys(entry)[0] === serviceName)) {
        return {
            isError: true,
            ...textContent(`Service '${serviceName}' already exists in group '${groupName}'.`),
        };
    }

    groupServices.push({ [serviceName]: serviceConfig });
    const content = dumpYamlConfig("services.yaml", services, placeholders);
    return textContent(
        JSON.stringify(
            { written: "services.yaml", added: { group: groupName, service: serviceName }, content },
            null,
            2
        )
    );
}

function addInfoWidget(args: ToolArguments) {
    const disabled = ensureWriteEnabled();
    if (disabled) return disabled;

    if (typeof args.type !== "string" || !args.type.trim()) {
        throw new Error("type must be a non-empty string");
    }

    const validation = validateYaml("widgets.yaml", readConfig("widgets.yaml"));
    if (!validation.valid) {
        return {
            isError: true,
            ...textContent(JSON.stringify(validation, null, 2)),
        };
    }

    const { data: widgets, placeholders } = parseYamlConfig("widgets.yaml");
    if (!Array.isArray(widgets)) {
        throw new Error("widgets.yaml must contain a top-level array");
    }

    const type = args.type.trim();
    const options = args.options ?? {};
    assertPlainObject(options, "options");

    widgets.push({ [type]: options });
    const content = dumpYamlConfig("widgets.yaml", widgets, placeholders);
    return textContent(JSON.stringify({ written: "widgets.yaml", added: { type }, content }, null, 2));
}

function listConfigFiles() {
    return CONFIG_FILES.map((file) => ({
        file,
        exists: fileExists(file),
        writable: writeEnabled(),
        description: FILE_DESCRIPTIONS[file],
        docs: DOC_LINKS[file],
    }));
}

function configResource(file: string) {
    return {
        uri: `foyer://config/${file}`,
        name: file,
        description: FILE_DESCRIPTIONS[file],
        mimeType: file.endsWith(".yaml") ? "application/yaml" : "text/plain",
    };
}

function parseConfigResourceUri(uri: unknown) {
    const prefix = "foyer://config/";
    if (typeof uri !== "string" || !uri.startsWith(prefix)) {
        throw new Error("Unsupported resource URI. Use foyer://config/<filename>.");
    }
    const file = uri.slice(prefix.length);
    assertKnownConfigFile(file);
    return file;
}

function toolDefinitions() {
    return [
        {
            name: "list_config_files",
            description:
                "List Foyer config files this server understands, whether they currently exist, and where their docs live.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "read_config_file",
            description:
                "Read one supported Foyer config file from FOYER_CONFIG_DIR. Missing files return empty content.",
            inputSchema: {
                type: "object",
                properties: {
                    file: { type: "string", enum: CONFIG_FILES },
                },
                required: ["file"],
            },
        },
        {
            name: "validate_config_file",
            description:
                "Validate YAML syntax for a supported Foyer config file or supplied content and return line/column details for YAML errors.",
            inputSchema: {
                type: "object",
                properties: {
                    file: { type: "string", enum: YAML_CONFIG_FILES },
                    content: {
                        type: "string",
                        description: "Optional YAML content to validate instead of reading the file.",
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "write_config_file",
            description:
                "Replace a supported Foyer config file. Disabled unless FOYER_MCP_ALLOW_WRITE=true. YAML files are validated before writing.",
            inputSchema: {
                type: "object",
                properties: {
                    file: { type: "string", enum: CONFIG_FILES },
                    content: { type: "string" },
                },
                required: ["file", "content"],
            },
        },
        {
            name: "add_service",
            description:
                "Append a service to a group in services.yaml, creating the group if needed. Disabled unless FOYER_MCP_ALLOW_WRITE=true.",
            inputSchema: {
                type: "object",
                properties: {
                    group: { type: "string", description: "Existing or new Foyer service group name." },
                    name: { type: "string", description: "Service display name." },
                    service: {
                        type: "object",
                        description:
                            "Foyer service properties such as href, icon, description, server, container, widget, or widgets.",
                        additionalProperties: true,
                    },
                },
                required: ["group", "name"],
            },
        },
        {
            name: "add_info_widget",
            description: "Append an information widget to widgets.yaml. Disabled unless FOYER_MCP_ALLOW_WRITE=true.",
            inputSchema: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        description: "Foyer info widget type, for example resources, search, datetime, or openmeteo.",
                    },
                    options: {
                        type: "object",
                        description: "Widget options for the selected info widget type.",
                        additionalProperties: true,
                    },
                },
                required: ["type"],
            },
        },
        {
            name: "foyer_docs",
            description: "Return focused Foyer documentation links for config files and troubleshooting.",
            inputSchema: {
                type: "object",
                properties: {
                    topic: {
                        type: "string",
                        enum: ["overview", ...CONFIG_FILES, "troubleshooting", "widgets"],
                    },
                },
            },
        },
    ];
}

function callTool(name: unknown, args: ToolArguments = {}) {
    switch (name) {
        case "list_config_files":
            return textContent(JSON.stringify({ configDir: CONF_DIR, files: listConfigFiles() }, null, 2));
        case "read_config_file": {
            assertKnownConfigFile(args.file);
            return textContent(readConfig(args.file));
        }
        case "validate_config_file": {
            assertKnownConfigFile(args.file);
            const content = Object.prototype.hasOwnProperty.call(args, "content")
                ? args.content
                : readConfig(args.file);
            return textContent(JSON.stringify(validateYaml(args.file, content), null, 2));
        }
        case "write_config_file": {
            const disabled = ensureWriteEnabled();
            if (disabled) return disabled;

            assertKnownConfigFile(args.file);
            if (typeof args.content !== "string") {
                throw new Error("content must be a string");
            }
            const validation = validateYaml(args.file, args.content);
            if (!validation.valid) {
                return {
                    isError: true,
                    ...textContent(JSON.stringify(validation, null, 2)),
                };
            }
            mkdirSync(CONF_DIR, { recursive: true });
            writeFileSync(configPath(args.file), args.content, "utf8");
            return textContent(
                JSON.stringify({ written: args.file, bytes: Buffer.byteLength(args.content, "utf8") }, null, 2)
            );
        }
        case "add_service":
            return addService(args);
        case "add_info_widget":
            return addInfoWidget(args);
        case "foyer_docs": {
            const topic = args.topic || "overview";
            const links: Record<string, string> = {
                overview: "https://foyer.arpanrec.com/configs/",
                troubleshooting: "https://foyer.arpanrec.com/troubleshooting/",
                widgets: "https://foyer.arpanrec.com/widgets/",
                ...DOC_LINKS,
            };
            return textContent(JSON.stringify({ topic, url: links[topic] || links.overview }, null, 2));
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

export function handleMcpRequest(body: unknown): JsonRpcResponse | null {
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
                        "Foyer MCP helps inspect and validate Foyer YAML configuration. File writes are disabled unless FOYER_MCP_ALLOW_WRITE=true.",
                });
            case "tools/list":
                return jsonRpcResult(message.id, { tools: toolDefinitions() });
            case "tools/call":
                return jsonRpcResult(message.id, callTool(message.params?.name, message.params?.arguments ?? {}));
            case "resources/list":
                return jsonRpcResult(message.id, { resources: CONFIG_FILES.map(configResource) });
            case "resources/read": {
                const file = parseConfigResourceUri(message.params?.uri);
                return jsonRpcResult(message.id, {
                    contents: [
                        {
                            uri: message.params?.uri,
                            mimeType: file.endsWith(".yaml") ? "application/yaml" : "text/plain",
                            text: readConfig(file),
                        },
                    ],
                });
            }
            default:
                return jsonRpcError(message.id, -32601, `Method not found: ${method}`);
        }
    } catch (error) {
        return jsonRpcError(message.id, -32602, errorMessage(error) ?? "Unknown error");
    }
}
