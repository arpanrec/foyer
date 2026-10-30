---
title: Environment Variables
description: Every environment variable Foyer reads
---

This page lists every environment variable Foyer reads. Set runtime variables on the container (`environment:` in Docker Compose, `-e` in `docker run`) or in the shell that starts `pnpm start`. Variables that start with `FOYER_` are read at runtime unless the table says otherwise.

## Server

| Variable                   | Default                | Description                                                                                                                                                                                                                             |
| -------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_ALLOWED_HOSTS`      | none                   | Comma-separated list of hosts (with the port when it is not 80 or 443) allowed to reach Foyer, such as `foyer.arpanrec.com,192.168.1.2:1234`. `*` disables the check. See [Installation](../installation/index.md#foyer_allowed_hosts). |
| `FOYER_CONFIG_DIR`         | `<working dir>/config` | Directory that holds the config files, `logs/` and the custom CSS and JS. The Docker image uses `/app/config`.                                                                                                                          |
| `FOYER_EXTERNAL_URL`       | none                   | Absolute URL users open Foyer at, including scheme and port when needed. Required when [authentication](../installation/index.md#security-authentication) is enabled.                                                                   |
| `FOYER_PROXY_DISABLE_IPV6` | `false`                | Set to `true` to make requests from widget proxies use IPv4 only.                                                                                                                                                                       |
| `PORT`                     | `3000`                 | Port the server listens on. Also used to build the default allowed hosts (`localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`).                                                                                                      |
| `HOSTNAME`                 | `::`                   | Address the server binds to. The Docker image falls back to `0.0.0.0` when it cannot bind to IPv6.                                                                                                                                      |
| `PUID`, `PGID`             | `0`                    | Docker image only. User and group ID the server runs as. The entrypoint changes ownership of the config directory to match.                                                                                                             |

## Authentication

Setting up sign-in is described in [Security & Authentication](../installation/index.md#security-authentication).

| Variable                   | Default                   | Description                                                                                                                          |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `FOYER_AUTH_ENABLED`       | `false`                   | Set to `true` to require sign-in for the dashboard and API routes.                                                                   |
| `FOYER_AUTH_SECRET`        | none                      | Random string, at least 32 characters, that signs and encrypts session cookies. Generate one with `openssl rand -base64 32`.         |
| `FOYER_AUTH_PASSWORD`      | none                      | Password for password login. Required unless the OIDC variables are set.                                                             |
| `FOYER_OIDC_ISSUER`        | none                      | OIDC issuer URL. Setting the issuer, client ID and client secret switches sign-in from password to OIDC.                             |
| `FOYER_OIDC_CLIENT_ID`     | none                      | OIDC client ID.                                                                                                                      |
| `FOYER_OIDC_CLIENT_SECRET` | none                      | OIDC client secret.                                                                                                                  |
| `FOYER_OIDC_NAME`          | none                      | Name shown on the OIDC sign-in button.                                                                                               |
| `FOYER_OIDC_SCOPE`         | `openid email profile`    | Scopes requested from the OIDC provider.                                                                                             |
| `FOYER_OIDC_AUTO_LOGIN`    | `false`                   | Set to `true` to send unauthenticated visitors straight to the OIDC provider. `/auth/signin?autologin=0` still shows the login page. |
| `NEXTAUTH_SECRET`          | `FOYER_AUTH_SECRET`       | Takes precedence over `FOYER_AUTH_SECRET` when set.                                                                                  |
| `NEXTAUTH_URL`             | from `FOYER_EXTERNAL_URL` | Full auth URL, such as `https://example.com/api/auth`. Takes precedence over `FOYER_EXTERNAL_URL` when set.                          |

## MCP

See [Model Context Protocol](mcp.md) for the endpoint itself.

| Variable                | Default | Description                                                                                                                      |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_MCP_ENABLED`     | `false` | Set to `true` to enable the `/api/mcp` endpoint.                                                                                 |
| `FOYER_MCP_TOKEN`       | none    | Bearer token for MCP clients that cannot use a browser session. At least 32 characters. Required when Foyer auth is not enabled. |
| `FOYER_MCP_ALLOW_WRITE` | `false` | Set to `true` to let MCP tools write config files.                                                                               |

## Logging

| Variable      | Default | Description                                                                                                                       |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`   | `info`  | Log level, such as `error`, `warn`, `info` or `debug`. See [Troubleshooting](../troubleshooting/index.md).                        |
| `LOG_TARGETS` | `both`  | Where logs go: `stdout`, `file` (`logs/foyer.log` under the config directory, or under `logpath` from `settings.yaml`) or `both`. |

## Build time

These are set while building the image or the source, not on a running container.

| Variable              | Description                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION`, `REVISION` | Docker build arguments shown in the dashboard footer and sent in the `User-Agent` of outbound feed, calendar and release requests.             |
| `BUILDTIME`           | Docker build argument shown in the footer. The container entrypoint also sets `FOYER_BUILDTIME` at start, which the config hash endpoint uses. |

## Config placeholders

Any variable whose name starts with `FOYER_VAR_` or `FOYER_FILE_` can be used inside config files.

| Variable            | Use                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_VAR_<NAME>`  | Replaces `{{FOYER_VAR_<NAME>}}` in any config file with the variable's value.                                              |
| `FOYER_FILE_<NAME>` | Holds a file path. Replaces `{{FOYER_FILE_<NAME>}}` in any config file with the contents of that file, for Docker secrets. |

See [Using Environment Secrets](../installation/docker.md#using-environment-secrets).

Loading a config file fails immediately if it references a `{{FOYER_VAR_<NAME>}}` or `{{FOYER_FILE_<NAME>}}`
placeholder whose variable is not set, if a `FOYER_FILE_<NAME>` path does not exist, or if it points to something
other than a regular file.
