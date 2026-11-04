---
title: Komga
description: Komga Widget Configuration
---

Learn more about [Komga](https://github.com/gotson/komga).

Uses the same username and password used to login from the web.

Allowed fields: `["libraries", "series", "books"]`.

| Komga API Version | Foyer Widget Version |
| ----------------- | -------------------- |
| < v2              | 1 (default)          |
| >= v2             | 2                    |

```jsonc
"widget": {
    "type": "komga",
    "url": "http://komga.host.or.ip:port",
    "username": "username",
    "password": "password", // betterleaks:allow
    "key": "komgaapikey", // optional
    "version": 2, // optional, default is 1
},
```
