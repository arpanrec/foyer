---
title: Yahoo Finance
description: Yahoo Finance Service Widget Configuration
---

The Yahoo Finance widget lists stocks, ETFs, indexes and crypto pairs with their current price and the change for the day. Data
comes from Yahoo Finance and needs no API key. Yahoo Finance has no official public API, so the endpoint the widget
calls can change or limit requests without notice. A symbol that cannot be fetched is left out and logged. Successful responses are cached for `cache` minutes, and failed ones are retried on the next request.

Symbols are written as they appear on Yahoo Finance. Indian markets use the `.NS` suffix for NSE and `.BO` for BSE, and
indexes start with `^`.

Allowed fields: no configurable fields for this widget.

```jsonc
"widget": {
    "type": "yahoofinance",
    "sortBy": "change", // optional, "change" or "absolute-change"
    "cache": 5, // optional, minutes to cache each symbol, defaults to 5
    "markets": [
        { "symbol": "SPY", "name": "S&P 500" },
        { "symbol": "BTC-USD", "name": "Bitcoin" },
        { "symbol": "^NSEI", "name": "Nifty 50" },
        { "symbol": "RELIANCE.NS", "name": "Reliance" },
    ],
},
```

Each market shows its name, the price in the currency Yahoo Finance reports, and the percentage change. The name is the
configured `name`, or the short name Yahoo Finance reports when none is set, and the symbol appears as a tooltip.
