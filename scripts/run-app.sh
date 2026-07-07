#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

PORT="${PORT:-8080}"
BACKUP_DIR="data/backups"
DB_PATH="${DB_PATH:-data/recovery.sqlite}"

if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  "${REPO_DIR}/scripts/run-with-infisical.sh" docker compose up -d --build
else
  docker compose up -d --build
fi

mkdir -p data "${BACKUP_DIR}"
if [[ -f "${DB_PATH}" ]]; then
  latest_backup="${BACKUP_DIR}/recovery-boot-$(date +%Y%m%d-%H%M%S).sqlite"
  cp "${DB_PATH}" "${latest_backup}"
fi
