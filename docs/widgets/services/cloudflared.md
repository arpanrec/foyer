---
title: Cloudflare Tunnels
description: Cloudflare Tunnels Widget Configuration
---

Learn more about [Cloudflare Tunnels](https://www.cloudflare.com/products/tunnel/).

_This widget does not accept a Cloudflare global API key (or account email) due to security concerns. You should setup an API token which only requires the permissions `Account.Cloudflare Tunnel:Read`._

Allowed fields: `["status", "origin_ip"]`.

```yaml
widget:
    type: cloudflared
    accountid: accountid # from zero trust dashboard url e.g. https://one.dash.cloudflare.com/<accountid>/home/quick-start
    tunnelid: tunnelid # found in tunnels dashboard under the tunnel name
    key: cloudflareapitoken # api token with `Account.Cloudflare Tunnel:Read` https://dash.cloudflare.com/profile/api-tokens
```
