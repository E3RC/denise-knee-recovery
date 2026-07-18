#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

PORT="${PORT:-8080}"
APP_URL="${APP_URL:-http://127.0.0.1:${PORT}}"
DB_PATH="${DB_PATH:-data/recovery.sqlite}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_command docker
require_command tailscale

if [[ ! -f .env ]]; then
  echo ".env is missing. Copy .env.example to .env and set real CAREGIVER_PIN and SESSION_SECRET values first."
  exit 1
fi

if grep -Eq 'replace-with-a-long-random-session-secret|replace-with-a-private' .env; then
  echo ".env still contains placeholder secrets. Replace them before starting the host."
  exit 1
fi

if [[ ! -f "${DB_PATH}" ]]; then
  echo "Warning: ${DB_PATH} is missing. Restore it first if this host should keep existing caregiver history."
fi

echo "Starting the app on ${APP_URL}"
docker compose up -d --build

echo "Exposing ${APP_URL} to the tailnet with Tailscale Serve"
sudo tailscale serve --bg --yes --http=80 "localhost:${PORT}"

echo "Done"
echo "Check status with: tailscale serve status"
echo "Turn it off with: sudo tailscale serve --http=80 localhost:${PORT} off"
echo "Tailnet access does not remove the app PIN gate. /caregiver should still prompt before /dashboard is reachable."
