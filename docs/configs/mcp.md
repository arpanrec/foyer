---
title: Model Context Protocol
---

Foyer includes an optional, lightweight [Model Context Protocol](https://modelcontextprotocol.io/) endpoint that can help AI assistants inspect, validate, and, if you explicitly allow it, update Foyer configuration files.

This endpoint is **disabled by default**. Do not expose it to an untrusted network unless you put Foyer behind authentication, TLS, and a reverse proxy that validates Host headers.

Once enabled you can use the endpoint to help an assistant understand your current Foyer configuration, add new services or widgets, and get links to relevant documentation. For example, an assistant could add a new media service to your dashboard by appending it to `services.yaml` via the MCP endpoint instead of you having to manually edit the file. For example, you can ask an assistant to add a new service entry for Paperless-ngx:

![Example of Claude Request](../../assets/claude_mcp.png)

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

For MCP clients that cannot use the browser session, set `FOYER_MCP_TOKEN`. An MCP token is required when Foyer auth is not enabled. The token grants read access to every configured service credential and, with writes enabled, control of `custom.js` (which runs in every browser), so it must be at least 32 characters — generate one with `openssl rand -base64 32`. Foyer refuses MCP requests while a shorter token is configured. Requests can include either of the following headers:

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

## Read-only by default

The MCP endpoint exposes tools for reading and validating supported Foyer config files. File writes are disabled unless you opt in with:

```yaml
FOYER_MCP_ALLOW_WRITE: "true"
```

When writes are enabled, YAML files are parsed before they are saved so a syntactically invalid YAML document is rejected instead of replacing the current file.

## Supported tools

| Tool                   | Description                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `list_config_files`    | Lists supported config files, whether they exist, and links to the related docs.                      |
| `read_config_file`     | Reads one supported config file from `FOYER_CONFIG_DIR`.                                              |
| `validate_config_file` | Validates YAML from a file or supplied content and returns line and column details for syntax errors. |
| `write_config_file`    | Replaces a supported config file when `FOYER_MCP_ALLOW_WRITE=true`.                                   |
| `add_service`          | Appends a service to a group in `services.yaml` when `FOYER_MCP_ALLOW_WRITE=true`.                    |
| `add_info_widget`      | Appends an information widget to `widgets.yaml` when `FOYER_MCP_ALLOW_WRITE=true`.                    |
| `foyer_docs`           | Returns focused Foyer documentation links for common setup topics.                                    |

For example, an assistant can add a service with:

```json
{
    "group": "Media",
    "name": "Plex",
    "service": {
        "href": "https://plex.example.com",
        "icon": "plex.png",
        "description": "Movies and TV",
        "widget": {
            "type": "plex",
            "url": "https://plex.example.com",
            "key": "your-api-key"
        }
    }
}
```

Or add an info widget with:

```json
{
    "type": "openmeteo",
    "options": {
        "label": "Current",
        "latitude": 36.66,
        "longitude": -117.51,
        "cache": 5
    }
}
```

## Supported resources

The MCP server also exposes config files as MCP resources using this URI format:

```txt
foyer://config/services.yaml
```

Supported files are:

- `settings.yaml`
- `services.yaml`
- `bookmarks.yaml`
- `widgets.yaml`
- `docker.yaml`
- `kubernetes.yaml`
- `proxmox.yaml`
- `custom.css`
- `custom.js`

## Example request

```bash
curl -s http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-token' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
