---
title: TrueNas
description: TrueNas Scale Widget Configuration
---

Learn more about [TrueNas](https://www.truenas.com/).

| TrueNAS Version         | Foyer widget version |
| ----------------------- | -------------------- |
| < 26.04 (REST API)      | 1 (default)          |
| > 25.04 (Websocket API) | 2                    |

Allowed fields: `["load", "uptime", "alerts"]`.

To create an API Key, follow [the official TrueNAS documentation](https://www.truenas.com/docs/scale/scaletutorials/toptoolbar/managingapikeys/).

A detailed pool listing is disabled by default, but can be enabled with the `enablePools` option.

With version 2, Foyer checks the TLS certificate of the TrueNAS websocket. If TrueNAS uses a self-signed certificate, set `ignoreTls: true` to skip the check. Only do this for a host on a network you trust, since anyone who can intercept the connection can then read the API key or password.

```jsonc
"widget": {
    "type": "truenas",
    "url": "http://truenas.host.or.ip",
    "version": 2, // optional, defaults to 1
    "username": "user", // not required if using api key
    "password": "pass", // not required if using api key
    "key": "yourtruenasapikey", // not required if using username / password
    "enablePools": true, // optional, defaults to false
    "ignoreTls": false, // optional, defaults to false, set to true to skip the TLS certificate check with version 2
},
```
