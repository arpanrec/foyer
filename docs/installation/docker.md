---
title: Docker Installation
description: Install and run foyer from Docker
---

Using docker compose:

```yaml
services:
    foyer:
        image: ghcr.io/arpanrec/foyer:latest
        container_name: foyer
        ports:
            - 3000:3000
        volumes:
            - /path/to/config:/app/config # Make sure your local config directory exists
            - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations
        environment:
            FOYER_ALLOWED_HOSTS: foyer.arpanrec.com # required, may need port. See foyer.arpanrec.com/installation/#foyer_allowed_hosts
```

### Running as non-root

By default, the Foyer container runs as root. Foyer also supports running your container as non-root via the standard `PUID` and `PGID` environment variables. When using these variables, make sure that any volumes mounted in to the container have the correct ownership and permissions set.

_Using the docker socket directly is not the recommended method of integration and requires either running foyer as root or that the user be part of the docker group_

In the docker compose example below, the environment variables `$PUID` and `$PGID` are set in a `.env` file.

```yaml
services:
    foyer:
        image: ghcr.io/arpanrec/foyer:latest
        container_name: foyer
        ports:
            - 3000:3000
        volumes:
            - /path/to/config:/app/config # Make sure your local config directory exists
            - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations, see alternative methods
        environment:
            FOYER_ALLOWED_HOSTS: foyer.arpanrec.com # required, may need port. See foyer.arpanrec.com/installation/#foyer_allowed_hosts
            PUID: $PUID
            PGID: $PGID
```

### With Docker Run

```bash
docker run -p 3000:3000 -e FOYER_ALLOWED_HOSTS=foyer.arpanrec.com -v /path/to/config:/app/config -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/arpanrec/foyer:latest
```

### Using Environment Secrets

You can also include environment variables in your config files to protect sensitive information. Note:

- Environment variables must start with `FOYER_VAR_` or `FOYER_FILE_`
- The value of env var `FOYER_VAR_XXX` will replace `{{FOYER_VAR_XXX}}` in any config
- The value of env var `FOYER_FILE_XXX` must be a file path, the contents of which will be used to replace `{{FOYER_FILE_XXX}}` in any config
- A config fails to load immediately if it references a placeholder whose variable is not set, or if a `FOYER_FILE_XXX` path is missing or not a regular file — see [Environment Variables](../configs/environment-variables.md#config-placeholders)
