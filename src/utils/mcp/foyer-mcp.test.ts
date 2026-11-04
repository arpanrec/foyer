import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadMcpWithConfigDir(configDir: string, configFile = "foyer.config.jsonc.njk") {
    vi.resetModules();
    process.env["FOYER_CONFIG_FILE"] = path.join(configDir, configFile);
    return import("@/utils/mcp/foyer-mcp");
}

describe("utils/mcp/foyer-mcp", () => {
    const originalEnv = process.env;

    beforeEach(async () => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(async () => {
        process.env = originalEnv;
    });

    it("is disabled by default", async () => {
        delete process.env["FOYER_MCP_ENABLED"];

        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        expect(mod.mcpEnabled()).toBe(false);
    });

    it("returns initialize capabilities", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const response = await mod.handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

        expect(response?.result?.protocolVersion).toBe("2025-11-25");
        expect(response?.result?.capabilities).toEqual({ tools: {}, resources: {} });
    });

    it("lists read-only configuration tools", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const response = await mod.handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });

        expect(response?.result?.tools?.map((tool) => tool.name)).toEqual([
            "describe_config",
            "read_config_file",
            "config_load_errors",
            "foyer_docs",
        ]);
    });

    it("describes the config file and its members", async () => {
        const configDir = mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-"));
        writeFileSync(path.join(configDir, "home.jsonc.njk"), '{ "settings": { "title": "Test" } }\n');
        const mod = await loadMcpWithConfigDir(configDir, "home.jsonc.njk");

        const describeResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "describe_config" },
        });
        const resourcesResponse = await mod.handleMcpRequest({ jsonrpc: "2.0", id: 4, method: "resources/list" });

        const description = JSON.parse(describeResponse?.result?.content?.[0]!.text ?? "") as {
            configFile: string;
            exists: boolean;
            members: { member: string; docs: string }[];
        };
        expect(description).toMatchObject({ configFile: path.join(configDir, "home.jsonc.njk"), exists: true });
        expect(description.members.find((member) => member.member === "settings")).toMatchObject({
            docs: "https://foyer.arpanrec.com/configs/settings/",
        });
        expect(description.members.map((member) => member.member)).toContain("customCss");
        expect(resourcesResponse?.result?.resources).toEqual([
            expect.objectContaining({ uri: "foyer://config", mimeType: "text/plain" }),
        ]);
    });

    it("reads the config source as text, without rendering it", async () => {
        const configDir = mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-"));
        const source = '{ "settings": { "title": "{{ TITLE }}" } }\n';
        writeFileSync(path.join(configDir, "foyer.config.jsonc.njk"), source);
        const mod = await loadMcpWithConfigDir(configDir);

        const readResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: { name: "read_config_file" },
        });
        const resourceResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 6,
            method: "resources/read",
            params: { uri: "foyer://config" },
        });

        expect(readResponse?.result?.content?.[0]!.text).toBe(source);
        expect(resourceResponse?.result?.contents?.[0]).toMatchObject({ mimeType: "text/plain", text: source });
    });

    it("reads a missing config file as empty text", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const readResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 7,
            method: "tools/call",
            params: { name: "read_config_file" },
        });
        const describeResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 8,
            method: "tools/call",
            params: { name: "describe_config" },
        });

        expect(readResponse?.result?.content?.[0]!.text ?? "").toBe("");
        expect(JSON.parse(describeResponse?.result?.content?.[0]!.text ?? "")).toMatchObject({ exists: false });
    });

    it("reports the errors from the last config load", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));
        const { setConfigStore, clearConfigStore } = await import("@/utils/config/store");
        setConfigStore({}, [
            { config: "settings", name: "SyntaxError", reason: "Unexpected token" },
            { config: "services", name: "Error", reason: "boom" },
        ]);

        try {
            const allResponse = await mod.handleMcpRequest({
                jsonrpc: "2.0",
                id: 9,
                method: "tools/call",
                params: { name: "config_load_errors" },
            });
            const oneResponse = await mod.handleMcpRequest({
                jsonrpc: "2.0",
                id: 10,
                method: "tools/call",
                params: { name: "config_load_errors", arguments: { member: "services" } },
            });

            expect(JSON.parse(allResponse?.result?.content?.[0]!.text ?? "")).toHaveLength(2);
            expect(JSON.parse(oneResponse?.result?.content?.[0]!.text ?? "")).toEqual([
                { config: "services", name: "Error", reason: "boom" },
            ]);
        } finally {
            clearConfigStore();
        }
    });

    it("has no tools that change the config file", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        for (const name of ["write_config_file", "add_service", "add_info_widget"]) {
            const response = await mod.handleMcpRequest({
                jsonrpc: "2.0",
                id: 11,
                method: "tools/call",
                params: { name, arguments: { member: "settings", content: "export default {};" } },
            });
            expect(response?.error).toMatchObject({ code: -32602, message: `Unknown tool '${name}'` });
        }
    });

    it("returns JSON-RPC errors for invalid requests and unknown methods", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const invalidResponse = await mod.handleMcpRequest({ id: 20, method: "tools/list" });
        const unknownMethodResponse = await mod.handleMcpRequest({ jsonrpc: "2.0", id: 21, method: "unknown/method" });
        const notificationResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            method: "notifications/initialized",
        });

        expect(invalidResponse?.error).toMatchObject({ code: -32600, message: "Invalid JSON-RPC request" });
        expect(unknownMethodResponse?.error).toMatchObject({
            code: -32601,
            message: "Method not found: unknown/method",
        });
        expect(notificationResponse).toBeNull();
    });

    it("returns JSON-RPC errors for unsupported members, resources, and tools", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const unsupportedMemberResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 22,
            method: "tools/call",
            params: {
                name: "config_load_errors",
                arguments: { member: "secrets" },
            },
        });
        const badResourceResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 23,
            method: "resources/read",
            params: { uri: "foyer://unknown/settings" },
        });
        const unknownToolResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 24,
            method: "tools/call",
            params: { name: "missing_tool" },
        });

        expect(unsupportedMemberResponse?.error).toMatchObject({ code: -32602 });
        expect(unsupportedMemberResponse?.error?.message).toContain("Unsupported config member");
        expect(badResourceResponse?.error).toMatchObject({
            code: -32602,
            message: "Unsupported resource URI. Use foyer://config.",
        });
        expect(unknownToolResponse?.error).toMatchObject({ code: -32602, message: "Unknown tool 'missing_tool'" });
    });

    it("returns documentation links with default and fallback topics", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        const defaultResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 39,
            method: "tools/call",
            params: { name: "foyer_docs" },
        });
        const fallbackResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 40,
            method: "tools/call",
            params: { name: "foyer_docs", arguments: { topic: "not-real" } },
        });
        const fileResponse = await mod.handleMcpRequest({
            jsonrpc: "2.0",
            id: 41,
            method: "tools/call",
            params: { name: "foyer_docs", arguments: { topic: "services" } },
        });

        expect(JSON.parse(defaultResponse?.result?.content?.[0]!.text ?? "")).toEqual({
            topic: "overview",
            url: "https://foyer.arpanrec.com/configs/",
        });
        expect(JSON.parse(fallbackResponse?.result?.content?.[0]!.text ?? "")).toEqual({
            topic: "not-real",
            url: "https://foyer.arpanrec.com/configs/",
        });
        expect(JSON.parse(fileResponse?.result?.content?.[0]!.text ?? "")).toEqual({
            topic: "services",
            url: "https://foyer.arpanrec.com/configs/services/",
        });
    });

    it("requires a matching MCP token for token authorization", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        expect(mod.mcpTokenAuthorized({ headers: {} })).toBe(false);

        const token = "mcp-tok-0123456789abcdefghijklmnopqrstuv"; // 40 chars
        process.env["FOYER_MCP_TOKEN"] = token;
        expect(mod.mcpTokenAuthorized({ headers: { authorization: `Bearer ${token}` } })).toBe(true);
        expect(mod.mcpTokenAuthorized({ headers: { "x-foyer-mcp-token": token } })).toBe(true);
        expect(mod.mcpTokenAuthorized({ headers: { "x-foyer-mcp-token": "wrong" } })).toBe(false);
        expect(mod.mcpTokenAuthorized({ headers: { authorization: "Bearer wrong" } })).toBe(false);

        // multibyte token at the minimum length still authorizes and doesn't throw on byte-length mismatch
        const multibyteToken = "é".repeat(32);
        process.env["FOYER_MCP_TOKEN"] = multibyteToken;
        expect(mod.mcpTokenAuthorized({ headers: { authorization: "Bearer a" } })).toBe(false);
        expect(mod.mcpTokenAuthorized({ headers: { authorization: `Bearer ${multibyteToken}` } })).toBe(true);
    });

    it("never authorizes a token below the minimum length, even when presented verbatim", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        process.env["FOYER_MCP_TOKEN"] = "change-me";
        expect(mod.mcpTokenAuthorized({ headers: { authorization: "Bearer change-me" } })).toBe(false);
        expect(mod.mcpTokenAuthorized({ headers: { "x-foyer-mcp-token": "change-me" } })).toBe(false);
    });

    it("reports a config error only when MCP is enabled with a too-short token", async () => {
        const mod = await loadMcpWithConfigDir(mkdtempSync(path.join(tmpdir(), "foyer-mcp-test-")));

        process.env["FOYER_MCP_ENABLED"] = "true";
        process.env["FOYER_MCP_TOKEN"] = "change-me";
        expect(mod.mcpTokenConfigError()).toMatch(/at least 32 characters/i);

        process.env["FOYER_MCP_TOKEN"] = "mcp-tok-0123456789abcdefghijklmnopqrstuv";
        expect(mod.mcpTokenConfigError()).toBeNull();

        // no token configured is valid (session-only mode), so it is not an error
        delete process.env["FOYER_MCP_TOKEN"];
        expect(mod.mcpTokenConfigError()).toBeNull();

        // a weak token is ignored entirely when MCP is disabled
        process.env["FOYER_MCP_ENABLED"] = "false";
        process.env["FOYER_MCP_TOKEN"] = "change-me";
        expect(mod.mcpTokenConfigError()).toBeNull();
    });
});
