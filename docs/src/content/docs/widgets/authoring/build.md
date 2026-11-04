---
title: Building Foyer
description: Build Foyer for production, as a Docker image, and as the npm package with the foyer command.
---

Foyer builds as the production build that `pnpm start` runs, the Docker image, and the `@arpanrec/foyer` npm package with its `foyer` command. Every build needs Node.js 22.18 or later (on the 23 line, 23.6 or later) and the dependencies from `pnpm install`. See [Getting Started](/widgets/authoring/getting-started/) for the development server, linting and tests.

## Production build

```bash
pnpm build
```

`pnpm build` runs `next build` into `.next/` with the standalone output, which the Docker image runs. It also type checks the project, so a type error fails the build. [Source Installation](/installation/source/) shows how to run it with `pnpm start`.

The dashboard footer shows a version, a git revision and a build time, which Next.js fixes in the build. Set them with the variables in [Build variables](#build-variables):

```bash
NEXT_PUBLIC_VERSION=1.2.3 NEXT_PUBLIC_REVISION="$(git rev-parse HEAD)" \
    NEXT_PUBLIC_BUILDTIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" pnpm build
```

## Docker image

The `Dockerfile` builds the app in a builder stage and copies the standalone output into a small runtime image. The same values go in as build arguments, listed with the variables in [Build variables](#build-variables):

```bash
docker buildx build . \
    --build-arg VERSION="$(jq -r .version package.json)" \
    --build-arg REVISION="$(git rev-parse HEAD)" \
    --build-arg BUILDTIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t foyer:local
```

A pipeline that builds the app in an earlier step can pass `--build-arg CI=true` to reuse that build; see `CI` in [Build variables](#build-variables).

## npm package and the foyer command

The repository is also the `@arpanrec/foyer` npm package. It ships the production build together with a `foyer` command, so users can run `npm install -g @arpanrec/foyer` and then `foyer server`. See [npm Installation](/installation/npm/) for the user side.

| Path                             | What it is                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                | Parses the command line: `server`, `init` and their options                                    |
| `src/cli/foyer.ts`               | The `foyer` command. Starts Next.js on the shipped build, or writes a config folder for `init` |
| `src/cli/init.ts`                | The starter config template that `foyer init` writes                                           |
| `src/cli/close-logger.ts`        | Ends the server's logger before the command exits                                              |
| `tsconfig.cli.json`              | Compiles `src/cli/` to `dist/cli/`, the `bin` entry of `package.json`                          |
| `src/build/package-externals.ts` | Prepares `.next/node_modules` for packing, described below                                     |

### Running the command from the repository

Compile the command:

```bash
pnpm build:cli
node dist/cli/foyer.js --help
```

`foyer init` needs nothing else:

```bash
node dist/cli/foyer.js init /tmp/my-foyer
```

`foyer server` runs the production build in `.next/`, so build that first, with [`FOYER_NPM_PACKAGE=true`](#build-variables) as the published package is. A plain `pnpm build` runs too, with a Next.js warning that `next start` does not work with the standalone output.

```bash
FOYER_NPM_PACKAGE=true pnpm build
node dist/cli/foyer.js server --config /tmp/my-foyer/foyer.config.jsonc.njk --port 3000
```

There is no development mode for the command: it always runs the production build. Use `pnpm dev` for hot reload. After a change, run `pnpm build:cli` again for `src/cli/`, and `pnpm build` for the app.

`node src/cli/foyer.ts` does not work. The sources import each other as `.js` files, such as `./args.js` and `./init.js`, which exist only once compiled.

### Packing

`pnpm pack` and `pnpm publish` run the `prepack` script, which:

1. runs `pnpm build` with `FOYER_NPM_PACKAGE=true` and the footer values filled in, as [Build variables](#build-variables) describes;
2. runs `node src/build/package-externals.ts`;
3. runs `pnpm build:cli`.

The `files` list in `package.json` decides what goes in: `dist/cli/`, `.next/` without its `cache`, `dev`, `diagnostics` and `standalone` folders, `public/`, `next.config.ts` and the config JSON Schema.

Turbopack loads every package in `serverExternalPackages` through a link named `<package>-<hash>` in `.next/node_modules`. In this repository those links point into pnpm's `node_modules/.pnpm` folder, which an npm install does not have. `package-externals.ts` swaps each link for a small package that loads the dependency by its own name, for `require()` and `import()`. Node.js then finds it in the `node_modules` npm gave the installed package. The step can run more than once.

Because of this, everything the server loads at runtime has to be in `dependencies`, not `devDependencies`: npm installs only `dependencies` for users.

### Testing the package

Install the packed tarball into a throwaway prefix to run it the way users do:

```bash
pnpm pack --pack-destination /tmp/foyer-pack
npm install -g --prefix /tmp/foyer-global /tmp/foyer-pack/arpanrec-foyer-*.tgz
/tmp/foyer-global/bin/foyer init /tmp/my-foyer
/tmp/foyer-global/bin/foyer server --config /tmp/my-foyer/foyer.config.jsonc.njk
```

npm may report skipped install scripts; see [Install scripts](/installation/npm/#install-scripts).

After `pnpm pack`, `.next/` holds the package build. Run `pnpm build` again before building the Docker image from the same folder.

### Publishing

Bump `version` in `package.json`, then:

```bash
pnpm publish --access public
```

## Build variables

These are read while Foyer is built, by `pnpm build`, the Docker image build or `pnpm pack`, and are fixed in the build from then on. Setting them on a running server has no effect; change them and build again. The variables a running server reads are in [Environment Variables](/configs/environment-variables/).

| Variable                  | Docker build argument | Default                     | Description                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_VERSION`     | `VERSION`             | `dev`                       | Version shown in the dashboard footer, and sent as `foyer/<version>` in the `User-Agent` of outbound requests such as feeds, images, streams, calendars and releases. `dev`, `main` and `nightly` show as plain text; any other value links to its GitHub release. |
| `NEXT_PUBLIC_REVISION`    | `REVISION`            | `dev`                       | Git revision shown in the footer, cut to its first 7 characters.                                                                                                                                                                                                   |
| `NEXT_PUBLIC_BUILDTIME`   | `BUILDTIME`           | the date the page is viewed | Build time shown in the footer as a date. A value that is not a date, such as `dev`, is shown as written.                                                                                                                                                          |
| `FOYER_NPM_PACKAGE`       | none                  | unset                       | `true` builds without the standalone output that the Docker image runs, for the npm package. `pnpm pack` sets it, and so does the `foyer` command at runtime, since Next.js reads `next.config.ts` again when it starts.                                           |
| `CI`                      | `CI`                  | unset                       | Docker build only. `true` skips `pnpm install` and `pnpm build` in the image and uses the `.next/standalone/` and `.next/static/` folders from the build context, built beforehand with a plain `pnpm build`.                                                      |
| `NEXT_TELEMETRY_DISABLED` | none                  | `1`                         | Turns off Next.js telemetry. The `pnpm` scripts and the Dockerfile always set it.                                                                                                                                                                                  |

`pnpm pack` sets `NEXT_PUBLIC_VERSION`, `NEXT_PUBLIC_REVISION` and `NEXT_PUBLIC_BUILDTIME` when they are unset: the version from `package.json`, the current commit and the current time.

## Docs site

The docs are an [Astro Starlight](https://starlight.astro.build/) site in `docs/`, a pnpm workspace package that `pnpm install` at the repository root installs along with the app. The pages are Markdown files under `docs/src/content/docs/`, and images go in `docs/public/assets/`. Astro needs Node.js 22.23.4 or later.

```bash
pnpm docs:dev      # http://localhost:4321, rebuilds on change
pnpm docs:build    # static site in docs/dist/, fails on a broken internal link
```
