---
title: Installation
description: Docs intro
icon: simple/docker
---

You have a few options for deploying foyer, depending on your needs. We offer docker images for a majority of platforms. You can also install and run foyer from source if Docker is not your thing.

!!! info

    Please note that when using features such as widgets, Foyer can access personal information (for example from your home automation system). Foyer includes a simple authentication gate with a password or OIDC, described in Security & Authentication below. We still recommend foyer be deployed behind a reverse proxy including authentication, SSL etc, and / or behind a VPN.

<br>

<div class="grid cards" style="margin: 0 auto;" markdown>
[:simple-docker: &nbsp; Install on Docker :octicons-arrow-right-24:](docker.md)
{ .card }

[:simple-kubernetes: &nbsp; Install on Kubernetes :octicons-arrow-right-24:](kubernetes.md)
{ .card }

[:simple-nextdotjs: &nbsp; Building from source :octicons-arrow-right-24:](source.md)
{ .card }

</div>

### `FOYER_ALLOWED_HOSTS`

There is one required environment variable to access foyer via a URL other than `localhost`, <code>FOYER_ALLOWED_HOSTS</code>. The setting helps prevent certain kinds of attacks when retrieving data from the foyer API proxy.

The value is a comma-separated (no spaces) list of allowed hosts (sometimes with the port) that can host your foyer install. See the [docker](docker.md) and [source](source.md) installation pages for more information about where / how to set the variable.

`localhost:3000`, `127.0.0.1:3000` and `[::1]:3000` are always included (the port follows `PORT`), but you can add a domain or IP address to this list to allow that host such as `FOYER_ALLOWED_HOSTS=foyer.arpanrec.com,192.168.1.2:1234`, etc.

If you are seeing errors about host validation, check the foyer logs and ensure that the host exactly as output in the logs is in the `FOYER_ALLOWED_HOSTS` list.

This can be disabled by setting `FOYER_ALLOWED_HOSTS` to `*` but this is not recommended. Public deployments must rely on a reverse proxy (and/or VPN) that enforces authentication, TLS, and unexpected Host headers; the built-in host check is a best-effort guard for local setups and is not a substitute for edge protections.

!!! note

    The sign-in pages (`/auth/*`) are exempt from this check. They expose only the public theme and title settings. The NextAuth routes (`/api/auth/*`) enforce it in their handler.

### Security & Authentication

Public deployments of Foyer should be secured via a reverse proxy, VPN, or similar. Foyer supports a simple authorization gate with a password or OIDC. When enabled, Foyer will use password login by default unless OIDC variables are provided.

Required environment variables for authentication:

- `FOYER_AUTH_ENABLED=true`
- `FOYER_AUTH_SECRET` (random string for signing/encrypting cookies, at least 32 characters; generate one with `openssl rand -base64 32`)
- `FOYER_EXTERNAL_URL` (the absolute URL used to access Foyer, including scheme and port when needed)

Use an `https://` URL for public or TLS-terminated deployments so authentication cookies are marked `Secure`. Trusted HTTP-only LAN deployments may use an `http://` URL.

For password-only login:

- `FOYER_AUTH_PASSWORD` (a strong, unique password; required unless OIDC settings are provided)

!!! warning

    Foyer does not apply application-level rate limiting to password attempts. Deployments exposed outside a trusted network should configure their reverse proxy or ingress to rate limit POST requests to `/api/auth/callback/credentials`. Each failed attempt is logged at `warn` level as `<nextauth> Failed password sign-in attempt`, which can be used as a fail2ban or CrowdSec filter.

For OIDC login (overrides password login):

- `FOYER_OIDC_ISSUER` (OIDC issuer URL, e.g., `https://auth.example.com/realms/foyer`)
- `FOYER_OIDC_CLIENT_ID`
- `FOYER_OIDC_CLIENT_SECRET`
- Optional: `FOYER_OIDC_NAME` (display name), `FOYER_OIDC_SCOPE` (defaults to `openid email profile`)
- Optional: `FOYER_OIDC_AUTO_LOGIN=true` to skip the login page and send unauthenticated visitors straight to the provider

!!! tip

    With auto-login enabled, visit `/auth/signin?autologin=0` to reach the login page without being redirected, e.g. in case something goes wrong!

!!! warning

    Foyer grants access to any identity that the configured OIDC provider authorizes for this client. Configure client assignments, groups, or access policies at the identity provider. Foyer does not apply additional claim-based authorization.

All app pages and `/api` routes except `/api/healthcheck` and `/api/config/custom.css` will require a signed-in session. Static assets remain public.

Configure your OIDC provider with a callback URI like `https://foyer.example.com/api/auth/callback/foyer-oidc`.
