ARG VARIANT="22-bookworm"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}

RUN npm install -g pnpm

ENV PATH="${PATH}:./node_modules/.bin"
ENV NEXT_TELEMETRY_DISABLED=1
