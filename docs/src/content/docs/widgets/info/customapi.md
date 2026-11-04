---
title: Custom API
description: Custom API Information Widget Configuration
---

_(Find the Custom API service widget [here](/widgets/services/customapi/))_

The Custom API information widget shows values from a custom self-hosted or third party API in your Foyer header, alongside an icon.

```jsonc
[
    {
        "customapi": {
            "url": "http://custom.api.host.or.ip:port/path/to/exact/api/endpoint",
            "icon": "mdi-api", // optional, see below
            "label": "My API", // optional, shown below the values
            "href": "https://custom.api.host", // optional, makes the widget a link
            "refreshInterval": 10000, // optional - in milliseconds, defaults to 10s
            "username": "username", // auth - optional
            "password": "password", // auth - optional // betterleaks:allow
            "method": "GET", // optional, e.g. POST
            // optional, must be object
            "headers": {
                "X-API-Token": "token",
            },
            "requestBody": null, // optional, can be string or object
            "mappings": [
                {
                    "field": "key",
                    "label": "Field 1",
                },
                {
                    "field": "path.to.key2",
                    "label": "Field 2",
                    "format": "number", // optional - defaults to text
                },
                {
                    "field": "path.to.key3",
                    "label": "Field 3",
                    "format": "percent",
                },
            ],
        },
    },
]
```

The `icon` accepts the same values as [service icons](/configs/services/#icons), e.g. `mdi-api`, `si-github`, `sh-homepage`, a dashboard icon name like `homepage.png`, or a full URL. If no icon is set, a generic API icon is shown.

Mappings support the same `field`, `format`, `remap`, `scale`, `prefix` and `suffix` options as the [Custom API service widget](/widgets/services/customapi/). The `additionalField` option and the `display` modes are not supported.
