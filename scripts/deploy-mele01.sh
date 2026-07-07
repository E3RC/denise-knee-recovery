#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

PORT="${PORT:-8080}"
DB_PATH="${DB_PATH:-data/recovery.sqlite}"
BACKUP_DIR="data/backups"
INFISICAL_RUNNER="${REPO_DIR}/scripts/run-with-infisical.sh"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_command docker
require_command tailscale
require_command stat

if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  require_command infisical
fi

if [[ -z "${INFISICAL_PROJECT_ID:-}" ]]; then
  if [[ ! -f .env ]]; then
    echo ".env is missing. Start from .env.example, set real ADMIN_TOKEN and CAREGIVER_PIN values, then rerun."
    exit 1
  fi

  if ! grep -Eq '^ADMIN_TOKEN=.+' .env || ! grep -Eq '^CAREGIVER_PIN=.+' .env; then
    echo ".env must define non-empty ADMIN_TOKEN and CAREGIVER_PIN values."
    exit 1
  fi

  if grep -Eq 'replace-with-a-long-random-token|replace-with-a-private' .env; then
    echo ".env still contains placeholder secrets. Replace them before publish."
    exit 1
  fi

  ENV_MODE="$(stat -f '%Lp' .env)"
  if [[ "${ENV_MODE}" != "600" ]]; then
    echo "Warning: .env permissions are ${ENV_MODE}. Recommended: chmod 600 .env"
  fi
fi

mkdir -p data "${BACKUP_DIR}"

if [[ -f "${DB_PATH}" ]]; then
  backup_path="${BACKUP_DIR}/recovery-$(date +%Y%m%d-%H%M%S).sqlite"
  cp "${DB_PATH}" "${backup_path}"
  echo "Backed up caregiver database to ${backup_path}"
else
  echo "No existing ${DB_PATH} found."
  echo "If this is a host move, copy the current SQLite file before relying on caregiver history."
fi

echo "Bringing up Denise Recovery on mele01"
"${REPO_DIR}/scripts/run-app.sh"

echo "Publishing public family page through Tailscale Funnel"
sudo tailscale funnel --bg --yes "${PORT}"

echo "Denise Recovery is running."
echo "Family page is public through the Funnel URL."
echo "Caregiver sign-in stays at /caregiver and /dashboard stays PIN-protected."
echo "Verify before sharing:"
echo "  1. Open / and confirm the family-safe landing page loads."
echo "  2. Open /caregiver and confirm it prompts for the PIN."
echo "  3. Run: tailscale funnel status"
