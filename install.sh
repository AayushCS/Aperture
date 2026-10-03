#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v bun >/dev/null || { echo "Bun is required: https://bun.sh" >&2; exit 1; }

echo "Installing orbital-core…"
(cd packages/orbital-core && bun install)

echo "Installing launch-watcher…"
(cd apps/launch-watcher && bun install)

echo
echo "Done. Start the app with:  bun run dev   (http://localhost:3000)"
