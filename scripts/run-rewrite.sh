#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

python3 scripts/backup_sqlite.py
docker compose --profile reminders up -d --build
curl --fail --silent --show-error http://127.0.0.1:"${HOST_PORT:-8080}"/api/health
echo
