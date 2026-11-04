---
title: Nextcloud
description: Nextcloud Widget Configuration
---

Learn more about [Nextcloud](https://github.com/nextcloud).

Use username & password, or the `NC-Token` key. Information about the token can be found under **Settings** > **System**. If both are provided, NC-Token will be used.

Allowed fields: `["cpuload", "memoryusage", "freespace", "activeusers", "numfiles", "numshares"]`.

Note "cpuload" and "memoryusage" are deprecated and a maximum of 4 fields can be displayed.

```jsonc
"widget": {
    "type": "nextcloud",
    "url": "https://nextcloud.host.or.ip:port",
    "key": "token",
},
```

```jsonc
"widget": {
    "type": "nextcloud",
    "url": "https://nextcloud.host.or.ip:port",
    "username": "username",
    "password": "password", // betterleaks:allow
},
```
