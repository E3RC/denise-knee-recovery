#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLIST_SOURCE="${REPO_DIR}/launchd/com.denise.recovery.reminders.plist"
PLIST_TARGET="${HOME}/Library/LaunchAgents/com.denise.recovery.reminders.plist"
SECRET_DIR="${HOME}/Library/Application Support/DeniseRecovery"
SECRET_FILE="${SECRET_DIR}/reminders.env"
RUNNER_DIR="${SECRET_DIR}/reminder-runner"
LABEL="com.denise.recovery.reminders"

if [[ ! -f "${REPO_DIR}/.env" ]]; then
  echo ".env is missing. Copy .env.example to .env and set PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN first."
  exit 1
fi

mkdir -p "${SECRET_DIR}"
grep -E '^(PUSHOVER_USER_KEY|PUSHOVER_APP_TOKEN)=' "${REPO_DIR}/.env" > "${SECRET_FILE}"
chmod 600 "${SECRET_FILE}"

mkdir -p "${RUNNER_DIR}"
cp "${REPO_DIR}/scripts/pushover_reminders.py" "${RUNNER_DIR}/pushover_reminders.py"
cp "${REPO_DIR}/data/reminders.json" "${RUNNER_DIR}/reminders.json"
chmod 700 "${RUNNER_DIR}"

mkdir -p "${HOME}/Library/LaunchAgents"
cp "${PLIST_SOURCE}" "${PLIST_TARGET}"

launchctl bootout "gui/$(id -u)" "${PLIST_TARGET}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST_TARGET}"
launchctl enable "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed ${LABEL}"
echo "Logs:"
echo "  ${RUNNER_DIR}/reminders-launchd.log"
echo "  ${RUNNER_DIR}/reminders-launchd.err"
echo "Secrets file:"
echo "  ${SECRET_FILE}"
echo "Runner dir:"
echo "  ${RUNNER_DIR}"
