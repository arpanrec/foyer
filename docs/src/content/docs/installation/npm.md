---
title: npm Installation
description: Install foyer from npm and run it with the foyer command
---

Foyer is published to npm as `@arpanrec/foyer`, with the production build included and a `foyer` command to start it. It needs Node.js 22.18 or later (on the 23 line, 23.6 or later).

Install it globally:

```bash
npm install -g @arpanrec/foyer
```

Without a config file the dashboard shows an error in place of your services. Create a starter config folder with `foyer init`:

```bash
foyer init my-foyer
```

Then start the server with it:

```bash
foyer server --config my-foyer/foyer.config.jsonc.njk
```

Without `--config`, Foyer reads `foyer.config.jsonc.njk` in the folder you start it from. See [Configuration](/configs/) for what goes in the config.

Foyer listens on port 3000 of every address, and answers requests for `localhost:3000`, `127.0.0.1:3000` and `[::1]:3000`. To reach it by another name, list it in `--allowed-hosts`, as described in [FOYER_ALLOWED_HOSTS](/installation/#foyer_allowed_hosts). When it starts, it prints a URL it answers, `http://localhost:3000` for the default address, and says when the address it prints needs an entry in `--allowed-hosts`.

To try it without installing, run it with `npx`:

```bash
npx @arpanrec/foyer server
```

## Starter config

`foyer init <dir>` creates `<dir>`, which must not exist yet, and writes a working config into it: a few sample services, bookmarks and information widgets, with the Docker, Kubernetes and Proxmox members ready to fill in.

```bash
foyer init my-foyer
```

```text
my-foyer/
├── foyer.config.jsonc.njk   # includes the files below
├── settings.jsonc.njk
├── services.jsonc.njk
├── bookmarks.jsonc.njk
├── widgets.jsonc.njk
├── docker.jsonc.njk
├── kubernetes.jsonc.njk
├── proxmox.jsonc.njk
├── custom.css
└── custom.js
```

Each member sits in its own template, which `foyer.config.jsonc.njk` includes. `custom.css` and `custom.js` are included as strings, as described in [Custom CSS & JS](/configs/custom-css-js/). The config sets `$schema` to the [schema](/configs/#schema) of the installed version.

## Options

| Option                   | Environment variable  | Default                    | Description                                             |
| ------------------------ | --------------------- | -------------------------- | ------------------------------------------------------- |
| `-c, --config <file>`    | `FOYER_CONFIG_FILE`   | `./foyer.config.jsonc.njk` | The config file, relative to the current folder         |
| `-p, --port <port>`      | `PORT`                | `3000`                     | The port to listen on                                   |
| `-H, --hostname <host>`  |                       | `0.0.0.0`                  | The address to bind, such as `127.0.0.1` for local only |
| `--allowed-hosts <list>` | `FOYER_ALLOWED_HOSTS` |                            | Comma-separated hosts, with their port, to answer       |
| `-h, --help`             |                       |                            | Show the help                                           |
| `-v, --version`          |                       |                            | Show the installed version                              |

A flag wins over its environment variable. Every other setting, such as authentication, comes from the [environment variables](/configs/environment-variables/) Foyer always reads:

```bash
FOYER_AUTH_ENABLED=true FOYER_AUTH_SECRET="$(openssl rand -base64 32)" FOYER_AUTH_PASSWORD=change-me \
    FOYER_EXTERNAL_URL=https://foyer.example.com \
    foyer server --config /etc/foyer/foyer.config.jsonc.njk --port 8080 --allowed-hosts foyer.example.com
```

Foyer runs in the folder you start it from, so a relative `--config` path and relative paths inside the config, such as Docker TLS files, resolve against that folder.

`--config`, `--port`, `--hostname` and `--allowed-hosts` apply to `foyer server` only.

## Config schema

The package carries a JSON Schema of the config at `@arpanrec/foyer/schema.json`. See [Schema](/configs/#schema) for pointing an editor at it.

## Install scripts

Recent npm versions skip dependency install scripts unless you allow them, and list the ones they skipped. Foyer runs without them: they build optional native extras of the Docker and Kubernetes client libraries.

## Updating

```bash
npm install -g @arpanrec/foyer@latest
```

Restart `foyer server` afterwards.
