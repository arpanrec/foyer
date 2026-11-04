---
title: What's Up Docker
description: What's Up Docker Widget Configuration
---

Learn more about [What's Up Docker](https://github.com/fmartinou/whats-up-docker).

Allowed fields: `["monitoring", "updates"]`.

```jsonc
"widget": {
    "type": "whatsupdocker",
    "url": "http://whatsupdocker:port",
    "username": "username", // optional
    "password": "password", // optional // betterleaks:allow
    "key": "bearer-token", // optional, takes precedence over username/password
},
```
