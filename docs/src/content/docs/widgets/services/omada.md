---
title: Omada
description: Omada Widget Configuration
---

The widget supports controller versions 3, 4, 5 and 6.

Allowed fields: `["connectedAp", "activeUser", "alerts", "connectedGateways", "connectedSwitches"]`.

```jsonc
"widget": {
    "type": "omada",
    "url": "http://omada.host.or.ip:port",
    "username": "username",
    "password": "password", // betterleaks:allow
    "site": "sitename",
},
```
