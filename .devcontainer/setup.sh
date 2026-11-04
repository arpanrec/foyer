#!/usr/bin/env bash

# Install the Node packages of the app and the docs site
pnpm install

# Without a config file the dashboard shows an error in place of its services
if [ ! -e foyer.config.jsonc.njk ] && [ -z "${FOYER_CONFIG_FILE}" ]; then
  echo "Create foyer.config.jsonc.njk before running pnpm dev, see https://foyer.arpanrec.com/configs/"
fi
