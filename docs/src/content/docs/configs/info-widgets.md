---
title: Information Widgets
description: Foyer info widgets.
---

Information widgets are widgets that provide information about your system or environment and are displayed at the top of the foyer. You can find a list of all available info widgets under the [Info Widgets](/widgets/info/) section.

Info widgets are defined in the `widgets` member of the [config file](/configs/), written on this page as `widgets.jsonc.njk`. It is a list of single-key objects named after the widget type:

```jsonc
[
    {
        "resources": {
            "cpu": true,
            "memory": true,
        },
    },
    {
        "search": {
            "provider": "duckduckgo",
        },
    },
]
```

Each widget has its own configuration options, which are detailed in the widget's documentation.

## Layout

Info widgets are displayed in the order they are defined in `widgets.jsonc.njk`. You can change the order by moving the widgets around in the file. However, some widgets (weather, search and datetime) are aligned to the right side of the screen which can affect the layout of the widgets.

## Adding A Link

You can add a link to an info widget such as the logo or greeting widgets by adding an `href` option, for example:

```jsonc
"logo": {
    "href": "https://example.com",
    "target": "_blank", // Optional, can be set in settings
},
```
