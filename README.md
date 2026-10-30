# Foyer

![Foyer](images/banner_dark@2x.png)

A modern, fast, secure, fully proxied, highly customizable application dashboard with integrations for over 100 services and translations into multiple languages. Easily configured via YAML files or through Docker label discovery.

Foyer is a TypeScript fork of [Homepage](https://gethomepage.dev)

![Foyer dashboard](images/1.png?v=2)

# Features

With features like quick search, bookmarks, weather support, a wide range of integrations and widgets, an elegant and modern design, and a focus on performance, Foyer is your ideal start to the day and a handy companion throughout it.

- **Fast** - Cached dashboard data and optimized assets keep page loads quick.
- **Secure** - All API requests to backend services are proxied, keeping your API keys hidden. Constantly reviewed for security by the community.
- **For Everyone** - Images built for AMD64, ARM64.
- **Full i18n** - Support for over 40 languages.
- **Service & Web Bookmarks** - Add custom links to the foyer.
- **Docker Integration** - Container status and stats. Automatic service discovery via labels.
- **Service Integration** - Over 100 service integrations, including popular starr and self-hosted apps.
- **Information & Utility Widgets** - Weather, time, date, search, and more.
- **And much more...**

## Docker Integration

Foyer has built-in support for Docker, and can automatically discover and add services to the foyer based on labels. See the [Docker Service Discovery](https://foyer.arpanrec.com/configs/docker/#automatic-service-discovery) page for more information.

## Service Widgets

Foyer also has support for hundreds of 3rd-party services, including all popular \*arr apps, and most popular self-hosted apps. Some examples include: Radarr, Sonarr, Lidarr, Bazarr, Ombi, Tautulli, Plex, Jellyfin, Emby, Transmission, qBittorrent, Deluge, Jackett, NZBGet, SABnzbd, etc. As well as service integrations, Foyer also has a number of information providers, sourcing information from a variety of external 3rd-party APIs. See the [Service](https://foyer.arpanrec.com/widgets/) page for more information.

## Information Widgets

Foyer has built-in support for a number of information providers, including weather, time, date, search, glances and more. System and status information presented at the top of the page. See the [Information Providers](https://foyer.arpanrec.com/widgets/) page for more information.

## Customization

Foyer is highly customizable, with support for custom themes, custom CSS & JS, custom layouts, formatting, localization and more. See the [Settings](https://foyer.arpanrec.com/configs/settings/) page for more information.

# Getting Started

For configuration options, examples and more, [please check out the foyer documentation](http://foyer.arpanrec.com).

## Security Notice

Please note that when using features such as widgets, Foyer can access personal information (for example from your home automation system). To keep your information private, if Foyer is reachable from any untrusted network, it:

1. **must** sit behind a reverse proxy (and/or VPN) that enforces authentication, TLS, and strictly validates Host headers.
2. An optional built-in OIDC login flow or simple password login is available (opt-in) offering a simple “authenticated or not” guard.

## With Docker

Using docker compose:

```yaml
services:
    foyer:
        image: ghcr.io/arpanrec/foyer:latest
        container_name: foyer
        environment:
            FOYER_ALLOWED_HOSTS: foyer.arpanrec.com # required, may need port. See foyer.arpanrec.com/installation/#foyer_allowed_hosts
            PUID: 1000 # optional, your user id
            PGID: 1000 # optional, your group id
        ports:
            - 3000:3000
        volumes:
            - /path/to/config:/app/config # Make sure your local config directory exists
            - /var/run/docker.sock:/var/run/docker.sock:ro # optional, for docker integrations
        restart: unless-stopped
```

or docker run:

```bash
docker run --name foyer \
  -e FOYER_ALLOWED_HOSTS=foyer.arpanrec.com \
  -e PUID=1000 \
  -e PGID=1000 \
  -p 3000:3000 \
  -v /path/to/config:/app/config \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  ghcr.io/arpanrec/foyer:latest
```

## From Source

First, clone the repository:

```bash
git clone https://github.com/arpanrec/foyer.git
```

Then install dependencies and build the production bundle:

```bash
pnpm install
pnpm build
```

On first start, Foyer copies any missing config file from `src/skeleton` into `config/`, so the dashboard starts with example files.

Finally, run the server in production mode:

```bash
FOYER_ALLOWED_HOSTS=foyer.arpanrec.com:1234 pnpm start
```

# Configuration

Please refer to the [foyer documentation website](https://foyer.arpanrec.com/) for more information. Everything you need to know about configuring Foyer is there. Please read everything carefully before asking for help, as most questions are answered there or are simple YAML configuration issues.

# Development

Install NPM packages, this project uses [pnpm](https://pnpm.io/) (and so should you!):

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

This is a [Next.js](https://nextjs.org/) application, see their documentation for more information.

# Documentation

The foyer documentation is available at [https://foyer.arpanrec.com/](https://foyer.arpanrec.com/).

Foyer uses Zensical for documentation. To run the documentation locally, first install the dependencies:

```bash
uv sync
```

Then run the development server:

```bash
uv run zensical serve # or build, to build the static site
```

# Support & Suggestions

If you have any questions, suggestions, or general issues, please start a discussion on the [Discussions](https://github.com/arpanrec/foyer/discussions) page.

## Troubleshooting

In addition to the docs, the [troubleshooting guide](https://foyer.arpanrec.com/troubleshooting/) can help reveal many basic config or network issues. If you're having a problem, it's a good place to start.

## Contributing & Contributors

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.
