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

if [[ -z "${REMINDER_CONFIG_PATH:-}" && -f "${HOME}/Library/Application Support/DeniseRecovery/reminder-runner/reminders.json" ]]; then
  export REMINDER_CONFIG_PATH="${HOME}/Library/Application Support/DeniseRecovery/reminder-runner/reminders.json"
fi
if [[ -z "${REMINDER_STATE_PATH:-}" && -f "${HOME}/Library/Application Support/DeniseRecovery/reminder-runner/reminder-state.json" ]]; then
  export REMINDER_STATE_PATH="${HOME}/Library/Application Support/DeniseRecovery/reminder-runner/reminder-state.json"
fi

if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  exec "${REPO_DIR}/scripts/run-with-infisical.sh" python3 scripts/pushover_reminders.py
fi

exec python3 scripts/pushover_reminders.py
