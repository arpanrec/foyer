# =========================
# Builder Stage
# =========================
FROM node:26-slim AS builder
WORKDIR /app

# Setup
RUN mkdir config
COPY . .

ARG CI
ARG BUILDTIME
ARG VERSION
ARG REVISION
ENV CI=$CI
ENV NEXT_TELEMETRY_DISABLED=1

# Install and build only outside CI
RUN if [ "$CI" != "true" ]; then \
      npm install --global corepack@latest && \
      corepack enable && corepack prepare pnpm@latest --activate && \
      pnpm install --frozen-lockfile --prefer-offline && \
      NEXT_PUBLIC_BUILDTIME=$BUILDTIME \
      NEXT_PUBLIC_VERSION=$VERSION \
      NEXT_PUBLIC_REVISION=$REVISION \
      pnpm run build; \
    else \
      echo "✅ Using prebuilt app from CI context"; \
    fi

# =========================
# Runtime Stage
# =========================
FROM node:26-alpine AS runner
LABEL org.opencontainers.image.title="Foyer"
LABEL org.opencontainers.image.description="A self-hosted services landing page, with docker and service integrations."
LABEL org.opencontainers.image.url="https://github.com/arpanrec/foyer"
LABEL org.opencontainers.image.documentation='https://github.com/arpanrec/foyer/tree/dev/docs'
LABEL org.opencontainers.image.source='https://github.com/arpanrec/foyer'
LABEL org.opencontainers.image.licenses='GPL-3.0-only'

# Setup
WORKDIR /app

# Copy some files from context
COPY --link --chown=1000:1000 /public ./public/
COPY --link --chmod=755 docker-entrypoint.sh /usr/local/bin/

# Copy only necessary files from the build stage
COPY --link --from=builder --chown=1000:1000 /app/.next/standalone/ ./
COPY --link --from=builder --chown=1000:1000 /app/.next/static/ ./.next/static

RUN apk add --no-cache su-exec iputils-ping shadow

USER root

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=::
ENV PORT=3000
EXPOSE $PORT

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider -Y off http://127.0.0.1:$PORT/api/healthcheck || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
