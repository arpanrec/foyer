---
title: WeatherAPI
description: WeatherAPI Information Widget Configuration
---

Sign up at [weatherapi.com](https://www.weatherapi.com/) to get an API key.

```jsonc
[
    {
        "weatherapi": {
            "label": "Kyiv", //optional
            "latitude": 50.449684,
            "longitude": 30.525026,
            "units": "metric", // or imperial
            "provider": "weatherapi",
            "apiKey": "yourweatherapikey", // required only if not using provider, this reveals api key in requests
            "cache": 5, // Time in minutes to cache API responses, to stay within limits
            // optional, Intl.NumberFormat options
            "format": {
                "maximumFractionDigits": 1,
            },
        },
    },
]
```

You can optionally not pass a `latitude` and `longitude` and the widget will use your current location (requires a secure context, eg. HTTPS).
