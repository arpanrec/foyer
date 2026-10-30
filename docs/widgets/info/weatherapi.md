---
title: WeatherAPI
description: WeatherAPI Information Widget Configuration
---

Sign up at [weatherapi.com](https://www.weatherapi.com/) to get an API key.

```yaml
- weatherapi:
      label: Kyiv #optional
      latitude: 50.449684
      longitude: 30.525026
      units: metric # or imperial
      provider: weatherapi
      apiKey: yourweatherapikey # required only if not using provider, this reveals api key in requests
      cache: 5 # Time in minutes to cache API responses, to stay within limits
      format: # optional, Intl.NumberFormat options
          maximumFractionDigits: 1
```

You can optionally not pass a `latitude` and `longitude` and the widget will use your current location (requires a secure context, eg. HTTPS).
