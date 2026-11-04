---
title: Docker Installation
description: Install and run foyer from Docker
---

The container reads its config from `/app/config/foyer.config.jsonc.njk`. Create that file in the folder you mount at `/app/config` first; until it exists, the dashboard shows an error in place of your services. See [Configuration](/configs/). The log file goes to `/tmp/foyer/logs` inside the container unless you set `FOYER_LOG_DIR`, see [Logging](/configs/environment-variables/#logging).

Using docker compose:

```yaml
services:
    foyer:
        image: docker.io/arpanrecme/foyer:latest
        container_name: foyer
        ports:
            - 3000:3000
        volumes:
            - /path/to/config:/app/config # Must hold foyer.config.jsonc.njk, see foyer.arpanrec.com/configs/
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
        image: docker.io/arpanrecme/foyer:latest
        container_name: foyer
        ports:
            - 3000:3000
        volumes:
            - /path/to/config:/app/config # Must hold foyer.config.jsonc.njk, see foyer.arpanrec.com/configs/
            - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations, see alternative methods
        environment:
            FOYER_ALLOWED_HOSTS: foyer.arpanrec.com # required, may need port. See foyer.arpanrec.com/installation/#foyer_allowed_hosts
            PUID: $PUID
            PGID: $PGID
```

### With Docker Run

```bash
docker run -p 3000:3000 -e FOYER_ALLOWED_HOSTS=foyer.arpanrec.com -v /path/to/config:/app/config -v /var/run/docker.sock:/var/run/docker.sock docker.io/arpanrecme/foyer:latest
```

### Using Environment Secrets

The config template reads the container's environment variables that start with `FOYER_VAR_`, and can include files such as Docker secrets by absolute path:

```jsonc
{% set weatherapiKey %}{% include "/run/secrets/weatherapi_key" %}{% endset %}
{
    "settings": {
        "providers": {
            "openweathermap": "{{ FOYER_VAR_OPENWEATHERMAP_API_KEY }}",
            "weatherapi": {{ weatherapiKey | trim | dump }},
        },
    },
}
```

Any name after the `FOYER_VAR_` prefix works. See [Environment variables and secrets](/configs/#environment-variables-and-secrets).
