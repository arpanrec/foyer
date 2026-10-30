---
title: Source Installation
description: Install and run foyer from source
---

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

On first start, Foyer copies any missing config file from `src/skeleton` into `config/`, so the dashboard starts with example files.

Finally, run the server:

```bash
FOYER_ALLOWED_HOSTS=foyer.arpanrec.com:1234 pnpm start
```

When updating Foyer versions, rebuild the production bundle by repeating the steps above.

See [FOYER_ALLOWED_HOSTS](index.md#foyer_allowed_hosts) for more information on this environment variable.
