#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

if [[ -z "${INFISICAL_PROJECT_ID:-}" && -f "${REPO_DIR}/.env" ]]; then
  set -a
  . "${REPO_DIR}/.env"
  set +a
fi

if [[ -z "${REMINDER_CONFIG_PATH:-}" ]]; then
  export REMINDER_CONFIG_PATH="${REPO_DIR}/data/reminders.json"
fi
if [[ -z "${REMINDER_STATE_PATH:-}" ]]; then
  export REMINDER_STATE_PATH="${REPO_DIR}/data/reminder-state.json"
fi

if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  exec "${REPO_DIR}/scripts/run-with-infisical.sh" python3 scripts/pushover_reminders.py "$@"
fi

exec python3 scripts/pushover_reminders.py "$@"
