---
title: Source Installation
description: Install and run foyer from source
---

Foyer needs Node.js 22.18 or later (on the 23 line, 23.6 or later), which runs the repository's own TypeScript scripts directly.

First, clone the repository:

```bash
git clone https://github.com/arpanrec/foyer.git
```

If `pnpm` is not installed, install it:

```bash
npm install -g pnpm
```

Then install dependencies and build the production bundle:

```bash
pnpm install
pnpm build
```

Create the config file, `foyer.config.jsonc.njk` in the repository folder, before starting the server. Without it the dashboard shows an error in place of your services. See [Configuration](/configs/) for what goes in it, or set `FOYER_CONFIG_FILE` to keep it elsewhere.

Finally, run the server:

```bash
FOYER_ALLOWED_HOSTS=foyer.arpanrec.com:1234 pnpm start
```

When updating Foyer versions, rebuild the production bundle by repeating the steps above.

See [FOYER_ALLOWED_HOSTS](/installation/#foyer_allowed_hosts) for more information on this environment variable.
