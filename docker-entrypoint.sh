#!/bin/sh

set -e

# Default to root
export PUID=${PUID:-0}
export PGID=${PGID:-0}

# Without an /app/config mount, use /config, the folder lscr.io images mount
[ ! -d "/app/config" ] && ln -s /config /app/config

export FOYER_BUILDTIME=$(date +%s)

# Try IPv6 first (dual stack when available), but fall back to IPv4 if the bind fails
export HOSTNAME=${HOSTNAME:-::}
if [ "$HOSTNAME" = "::" ]; then
  if ! node -e "const server = require('http').createServer(() => {}); const host = '::'; const port = process.env.PORT || 3000; server.once('error', (err) => { console.error('IPv6 bind failed:', err.message); process.exit(1); }); server.listen(port, host, () => server.close(() => process.exit(0)));"; then
    echo "Falling back to IPv4 bind at 0.0.0.0"
    export HOSTNAME=0.0.0.0
  fi
fi

# Check ownership before chown
if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for /app/config"
elif [ -e /app/config ]; then
  CURRENT_UID=$(stat -c %u /app/config)
  CURRENT_GID=$(stat -c %g /app/config)

  if [ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]; then
    echo "Fixing ownership of /app/config"
    if ! chown -R "$PUID:$PGID" /app/config 2>/dev/null; then
      echo "Warning: Could not chown /app/config; continuing anyway"
    fi
  else
    echo "/app/config already owned by correct UID/GID, skipping chown"
  fi
else
  echo "/app/config does not exist; skipping ownership check"
fi

if [ -d /app/.next ]; then
  CURRENT_UID=$(stat -c %u /app/.next)
  CURRENT_GID=$(stat -c %g /app/.next)

  if [ "$PUID" -ne 0 ] && ([ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]); then
    echo "Fixing ownership of /app/.next"
    if ! chown -R "$PUID:$PGID" /app/.next 2>/dev/null; then
      echo "Warning: Could not chown /app/.next; continuing anyway"
    fi
  else
    echo "/app/.next already owned by correct UID/GID or running as root, skipping chown"
  fi
fi

# Drop privileges (when asked to) if root, otherwise run as current user
if [ "$(id -u)" = "0" ] && [ "${PUID}" != "0" ]; then
  exec su-exec ${PUID}:${PGID} "$@"
else
  exec "$@"
fi
