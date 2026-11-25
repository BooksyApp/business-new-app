#!/usr/bin/env bash
#
# Build the salon manager here and copy it onto the VPS.
#
# No image and no container: Caddy serves this as static files from /opt/booksy/web, which
# it maps to the panel host's root (it was /manage before business.getbooqi.tech). So a release is a build and an rsync, and nothing restarts.
#
# The build is done locally on purpose. The box has 8 GB shared with Postgres and the API,
# and a Vite build there competes with the thing customers are using.
#
#   ./ship.sh
#
set -euo pipefail

HOST="${VPS_HOST:-root@srv1946733.hstgr.cloud}"
TARGET="/opt/booksy/web"

cd "$(dirname "$0")"

# Dependencies first. `npm run build` calls tsc and vite from node_modules/.bin, and a
# clean checkout has neither — which is what "sh: tsc: command not found" means. `npm ci`
# when there is a lockfile, because it installs exactly what was locked and is faster.
if [ ! -x node_modules/.bin/vite ]; then
  echo "==> installing dependencies"
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
fi

echo "==> building"
npm run build

# vite.config sets base: "/" (the panel has its own host, business.getbooqi.tech). A build
# with another base produces a white page there and no error.
if ! grep -q 'src="/assets/' dist/index.html; then
  echo "dist/index.html does not load /assets/ from the root — check base in vite.config" >&2
  exit 1
fi

echo "==> copying to $HOST:$TARGET"
# --delete so a file removed from the build is removed from the box; without it an old
# hashed bundle lingers forever and the directory only grows.
rsync -az --delete dist/ "$HOST:$TARGET/"

echo "==> done (the panel's host serves it at /)"
