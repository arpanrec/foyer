---
title: Pyload
description: Pyload Widget Configuration
---

Learn more about [Pyload](https://github.com/pyload/pyload).

Allowed fields: `["speed", "active", "queue", "total"]`.

```jsonc
"widget": {
    "type": "pyload",
    "url": "http://pyload.host.or.ip:port",
    "username": "username",
    "password": "password", // only needed if set // betterleaks:allow
    "key": "pyloadapikey", // only needed if set, takes precedence over username/password
},
```
