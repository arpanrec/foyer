---
title: Environment Variables
description: Every environment variable Foyer reads
---

This page lists every environment variable Foyer reads. Set runtime variables on the container (`environment:` in Docker Compose, `-e` in `docker run`) or in the shell that starts `pnpm start`. Variables that start with `FOYER_` are read at runtime unless the table says otherwise.

## Server

| Variable                   | Default                  | Description                                                                                                                                                                                                                   |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_ALLOWED_HOSTS`      | none                     | Comma-separated list of hosts (with the port when it is not 80 or 443) allowed to reach Foyer, such as `foyer.arpanrec.com,192.168.1.2:1234`. `*` disables the check. See [Installation](/installation/#foyer_allowed_hosts). |
| `FOYER_CONFIG_FILE`        | `foyer.config.jsonc.njk` | Path to the [config file](/configs/), read from the working directory when relative. Without it the dashboard shows an error in place of your services. The Docker image uses `/app/config/foyer.config.jsonc.njk`.           |
| `FOYER_EXTERNAL_URL`       | none                     | Absolute URL users open Foyer at, including scheme and port when needed. Required when [authentication](/installation/#security--authentication) is enabled.                                                                  |
| `FOYER_PROXY_DISABLE_IPV6` | `false`                  | Set to `true` to make requests from widget proxies use IPv4 only.                                                                                                                                                             |
| `PORT`                     | `3000`                   | Port the server listens on. Also used to build the default allowed hosts (`localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`).                                                                                            |
| `HOSTNAME`                 | `::`                     | Address the server binds to. The Docker image falls back to `0.0.0.0` when it cannot bind to IPv6.                                                                                                                            |
| `FOYER_BUILDTIME`          | none                     | Docker image only. The entrypoint sets it to the container start time. It is part of the config hash, so open dashboards reload after the container restarts.                                                                 |
| `FOYER_APP_DIR`            | working directory        | Folder that holds `public/locales`. The `foyer` command sets it to the installed package; leave it unset otherwise.                                                                                                           |
| `PUID`, `PGID`             | `0`                      | Docker image only. User and group ID the server runs as. The entrypoint changes ownership of `/app/config` to match.                                                                                                          |

## Browser access

Foyer tells the browser to load from Foyer's own origin and nothing else, with a `Content-Security-Policy` header on every page, the sign-in page and the API. Icons, backgrounds, favicons, feed and livestream images and camera streams all reach the browser through the Foyer server, so a browser that cannot reach the internet still shows the full dashboard. The policy makes a page that tries to load something from another host fail in the browser instead of waiting for a connection.

| Variable              | Default   | Description                                                                                                                                                                                                                                                                  |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_CSP`           | `enforce` | `enforce` blocks anything from another host. `report-only` sends the policy as a report-only header, which logs violations in the browser console but blocks nothing. `off` sends no policy. Any other value is treated as `enforce`, with a warning.                        |
| `FOYER_CSP_FRAME_SRC` | none      | Space or comma separated sources the [iFrame widget](/widgets/services/iframe/) may load, such as `https://grafana.lan https://*.example.com:8443`. Without it a page can frame only Foyer itself. An entry with a quote, a comma or a semicolon is ignored, with a warning. |

The policy also stops JavaScript from `customJs` and styles from `customCss` that load a script, font or image from another host. Put such files on Foyer's own origin, for example in `public/`. Links that a user clicks, such as a service's `href` or a search, are navigation and are not affected.

## Authentication

Setting up sign-in is described in [Security & Authentication](/installation/#security--authentication).

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

See [Model Context Protocol](/configs/mcp/) for the endpoint itself.

| Variable            | Default | Description                                                                                                                      |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_MCP_ENABLED` | `false` | Set to `true` to enable the `/api/mcp` endpoint.                                                                                 |
| `FOYER_MCP_TOKEN`   | none    | Bearer token for MCP clients that cannot use a browser session. At least 32 characters. Required when Foyer auth is not enabled. |

## Logging

| Variable        | Default                    | Description                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOYER_LOG_DIR` | `<system temp>/foyer/logs` | Folder for `foyer.log`, created when missing. The default is `/tmp/foyer/logs` on Linux and in the Docker image, and the `foyer/logs` folder in the system temp folder elsewhere. Foyer uses the path as written, so a relative path is read from the working directory; use an absolute path. |
| `LOG_LEVEL`     | `info`                     | Log level: `error`, `warn`, `info`, `http`, `verbose`, `debug` or `silly`, in any case. Any other value logs at `info` with a warning. See [Troubleshooting](/troubleshooting/).                                                                                                               |
| `LOG_TARGETS`   | `both`                     | Where logs go: `stdout`, `file` (`foyer.log` in `FOYER_LOG_DIR`) or `both`, in any case. Any other value logs to both with a warning.                                                                                                                                                          |

Every server message goes through the same logger, config load errors included, so `LOG_TARGETS` and `LOG_LEVEL` apply to all of them. If Foyer cannot create or write to `FOYER_LOG_DIR`, cannot write to an existing `foyer.log` (for example one left by a container that ran with a different `PUID`), or `foyer.log` fails while the server runs, it logs a warning and writes to the console only.

The system temp folder is emptied on reboot, and in a container it goes away with the container. Set `FOYER_LOG_DIR` to a mounted folder of its own, such as `/app/logs`, to keep the log file; the config folder can then stay read-only. The user Foyer runs as (`PUID` in the Docker image) must be able to write there.

Log files rotate automatically when they reach 10 MiB. Foyer keeps the current `foyer.log` and numbered rotated files (`foyer1.log`, `foyer2.log` and so on) up to a fixed limit, and removes the oldest rotated file when a new one is created.

## Build time

Variables read while Foyer is built, such as the version shown in the dashboard footer, are listed in [Build variables](/widgets/authoring/build/#build-variables). They are fixed in the build and have no effect on a running server.

## Config file

The config template can print an environment variable whose name starts with `FOYER_VAR_`, such as `FOYER_VAR_PLEX_TOKEN`, as `{{ FOYER_VAR_PLEX_TOKEN }}`. No other environment variable reaches the template. See [Environment variables and secrets](/configs/#environment-variables-and-secrets).
