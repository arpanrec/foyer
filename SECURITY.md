# Security Policy

## Supported versions

| Version                                           | Supported          |
| ------------------------------------------------- | ------------------ |
| Latest 0.0.x release                              | :white_check_mark: |
| `ghcr.io/arpanrec/foyer:latest` and `main` builds | :white_check_mark: |
| Older 0.0.x releases                              | :x:                |

Security fixes go into the `main` branch and ship in the next release. If you run an older version, upgrade before reporting.

## Reporting a vulnerability

Do not open a public issue, discussion, or pull request for a security problem.

Report it privately through GitHub: go to the [Security tab](https://github.com/arpanrec/foyer/security) and click **Report a vulnerability**, or open the [advisory form](https://github.com/arpanrec/foyer/security/advisories/new) directly.

Include as much of the following as you can:

- The affected version, image tag, or commit
- How you deploy Foyer (Docker, Kubernetes, source) and whether it sits behind a reverse proxy
- Steps to reproduce, with a minimal configuration (remove real API keys, tokens, and hostnames)
- What an attacker can do with the issue

The report stays private between you and the maintainers until a fix is released. Once it ships, the advisory is published and you are credited unless you ask not to be.

## Scope

Foyer proxies requests to the services configured in its widgets and can expose data from them. It expects to sit behind a reverse proxy or VPN that enforces authentication, TLS, and strict Host header validation whenever it is reachable from an untrusted network. Reports that rely on running Foyer directly on the internet without that protection are out of scope, unless the issue bypasses Foyer's own optional login.

Vulnerabilities in the third-party services that widgets connect to belong with those projects.
