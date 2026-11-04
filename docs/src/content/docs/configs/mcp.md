---
title: Model Context Protocol
---

Foyer includes an optional, lightweight [Model Context Protocol](https://modelcontextprotocol.io/) endpoint that lets AI assistants read the Foyer config file and the errors from loading it. It cannot change any file.

This endpoint is **disabled by default**. Do not expose it to an untrusted network unless you put Foyer behind authentication, TLS, and a reverse proxy that validates Host headers.

Once enabled, an assistant can read your current Foyer configuration, see why a config member failed to load, and get links to relevant documentation. It can then suggest changes for you to make to the config yourself.

:::caution
`read_config_file` and the `foyer://config` resource return the config file source as written, with no redaction. Any API key, password, token, or `customJs` in that file goes to every client that can call the endpoint, and to the AI service behind that client. Anyone with a valid `FOYER_MCP_TOKEN`, or a signed-in session when `FOYER_AUTH_ENABLED` is on, can read all of them in one request. Enable the endpoint only when you accept that exposure. Keep credentials out of the config file, for example by reading them from environment variables in the file, if the assistant must not see them.
:::

## Enable the MCP endpoint

Set the following environment variable and restart Foyer:

```yaml
FOYER_MCP_ENABLED: "true"
```

The endpoint is available at:

```txt
http://your-foyer-instance/api/mcp
```

## Authentication

The MCP endpoint requires authentication. Requests from an authenticated Foyer session are allowed when Foyer auth is enabled with `FOYER_AUTH_ENABLED`.

For MCP clients that cannot use the browser session, set `FOYER_MCP_TOKEN`. An MCP token is required when Foyer auth is not enabled. The token grants read access to the config file, including any credentials written in it, so it must be at least 32 characters. Generate one with `openssl rand -base64 32`. Foyer refuses MCP requests while a shorter token is configured. Requests can include either of the following headers:

```txt
Authorization: Bearer your-token
```

or:

```txt
X-Foyer-MCP-Token: your-token
```

Example Docker Compose environment block:

```yaml
environment:
    FOYER_MCP_ENABLED: "true"
    FOYER_AUTH_ENABLED: "true"
    FOYER_MCP_TOKEN: "generate-with-openssl-rand-base64-32"
```

## Connecting Claude Desktop

Claude Desktop can use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) to communicate with the foyer MCP endpoint in `claude_desktop_config.json`:

```json
{
    "mcpServers": {
        "foyer": {
            "command": "npx",
            "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp", "--header", "X-Foyer-MCP-Token: your-token"]
        }
    }
}
```

The **Add custom connector** option will not work: remote connectors authenticate with OAuth and cannot supply `FOYER_MCP_TOKEN`.

## Supported tools

| Tool                 | Description                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `describe_config`    | Returns the path of the config file (`FOYER_CONFIG_FILE`), whether it exists, and its members with links to their docs. |
| `read_config_file`   | Returns the source of the config template without rendering it. Templates it includes are not read.                     |
| `config_load_errors` | Lists what failed when Foyer last loaded its config: the whole file, or one member or all of them.                      |
| `foyer_docs`         | Returns focused Foyer documentation links for common setup topics.                                                      |

Foyer loads the config on first use and again when the reload button in the dashboard footer is clicked, and while the config has errors it loads it again on every request, so `config_load_errors` reports the last load. A config that fails as a whole shows up as one error for `file`. A reload that fails keeps the earlier config, so its errors show in the reload popup, not here.

## Supported resources

The MCP server also exposes the config file's source as an MCP resource:

```txt
foyer://config
```

## Example request

```bash
curl -s http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-token' \ # betterleaks:allow
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
