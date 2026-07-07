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
BIN_DIR="${HOME}/.local/bin"
BIN_TARGET="${BIN_DIR}/denise-reminders"
LOG_PLIST_SOURCE="${REPO_DIR}/launchd/com.denise.recovery.log-check.plist"
LOG_PLIST_TARGET="${HOME}/Library/LaunchAgents/com.denise.recovery.log-check.plist"
LOG_BIN_TARGET="${BIN_DIR}/denise-log-check"

if [[ ! -f "${REPO_DIR}/.env" ]]; then
  echo ".env is missing. Copy .env.example to .env and set PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN first."
  exit 1
fi

mkdir -p "${SECRET_DIR}"
grep -E '^(PUSHOVER_USER_KEY|PUSHOVER_APP_TOKEN)=' "${REPO_DIR}/.env" > "${SECRET_FILE}"
chmod 600 "${SECRET_FILE}"

mkdir -p "${RUNNER_DIR}"
cp "${REPO_DIR}/scripts/pushover_reminders.py" "${RUNNER_DIR}/pushover_reminders.py"
cp "${REPO_DIR}/scripts/log_health_check.py" "${RUNNER_DIR}/log_health_check.py"
cp "${REPO_DIR}/data/reminders.json" "${RUNNER_DIR}/reminders.json"
cat > "${RUNNER_DIR}/run-reminders.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ -z "${REMINDER_CONFIG_PATH:-}" && -f "${SCRIPT_DIR}/reminders.json" ]]; then
  export REMINDER_CONFIG_PATH="${SCRIPT_DIR}/reminders.json"
fi
if [[ -z "${REMINDER_STATE_PATH:-}" && -f "${SCRIPT_DIR}/reminder-state.json" ]]; then
  export REMINDER_STATE_PATH="${SCRIPT_DIR}/reminder-state.json"
fi

exec python3 "${SCRIPT_DIR}/pushover_reminders.py"
EOF
chmod 700 "${RUNNER_DIR}"
chmod 700 "${RUNNER_DIR}/run-reminders.sh"

cat > "${RUNNER_DIR}/run-log-check.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ -f "${SCRIPT_DIR}/reminders.env" ]]; then
  set -a
  . "${SCRIPT_DIR}/reminders.env"
  set +a
fi

export LOG_HEALTH_STDOUT_PATH="${LOG_HEALTH_STDOUT_PATH:-${SCRIPT_DIR}/reminders-launchd.log}"
export LOG_HEALTH_STDERR_PATH="${LOG_HEALTH_STDERR_PATH:-${SCRIPT_DIR}/reminders-launchd.err}"
export LOG_HEALTH_SUMMARY_PATH="${LOG_HEALTH_SUMMARY_PATH:-${SCRIPT_DIR}/log-health-summary.txt}"
export LOG_HEALTH_STATE_PATH="${LOG_HEALTH_STATE_PATH:-${SCRIPT_DIR}/log-health-state.json}"
export LOG_HEALTH_AGENT_LABEL="${LOG_HEALTH_AGENT_LABEL:-com.denise.recovery.reminders}"

exec python3 "${SCRIPT_DIR}/log_health_check.py"
EOF
chmod 700 "${RUNNER_DIR}/run-log-check.sh"

mkdir -p "${BIN_DIR}"
cat > "${BIN_TARGET}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SECRET_DIR="${HOME}/Library/Application Support/DeniseRecovery"
RUNNER_DIR="${SECRET_DIR}/reminder-runner"

if [[ -f "${SECRET_DIR}/reminders.env" ]]; then
  set -a
  . "${SECRET_DIR}/reminders.env"
  set +a
fi

export REMINDER_CONFIG_PATH="${REMINDER_CONFIG_PATH:-${RUNNER_DIR}/reminders.json}"
export REMINDER_STATE_PATH="${REMINDER_STATE_PATH:-${RUNNER_DIR}/reminder-state.json}"
export REMINDER_WINDOW_MINUTES="${REMINDER_WINDOW_MINUTES:-90}"

exec "${RUNNER_DIR}/run-reminders.sh"
EOF
chmod 755 "${BIN_TARGET}"

cat > "${LOG_BIN_TARGET}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SECRET_DIR="${HOME}/Library/Application Support/DeniseRecovery"
RUNNER_DIR="${SECRET_DIR}/reminder-runner"

if [[ -f "${SECRET_DIR}/reminders.env" ]]; then
  set -a
  . "${SECRET_DIR}/reminders.env"
  set +a
fi

export LOG_HEALTH_STDOUT_PATH="${LOG_HEALTH_STDOUT_PATH:-${RUNNER_DIR}/reminders-launchd.log}"
export LOG_HEALTH_STDERR_PATH="${LOG_HEALTH_STDERR_PATH:-${RUNNER_DIR}/reminders-launchd.err}"
export LOG_HEALTH_SUMMARY_PATH="${LOG_HEALTH_SUMMARY_PATH:-${RUNNER_DIR}/log-health-summary.txt}"
export LOG_HEALTH_STATE_PATH="${LOG_HEALTH_STATE_PATH:-${RUNNER_DIR}/log-health-state.json}"
export LOG_HEALTH_AGENT_LABEL="${LOG_HEALTH_AGENT_LABEL:-com.denise.recovery.reminders}"

exec "${RUNNER_DIR}/run-log-check.sh"
EOF
chmod 755 "${LOG_BIN_TARGET}"

mkdir -p "${HOME}/Library/LaunchAgents"
cp "${PLIST_SOURCE}" "${PLIST_TARGET}"
cp "${LOG_PLIST_SOURCE}" "${LOG_PLIST_TARGET}"

launchctl bootout "gui/$(id -u)" "${PLIST_TARGET}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST_TARGET}"
launchctl enable "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

launchctl bootout "gui/$(id -u)" "${LOG_PLIST_TARGET}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${LOG_PLIST_TARGET}"
launchctl enable "gui/$(id -u)/com.denise.recovery.log-check" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$(id -u)/com.denise.recovery.log-check"

echo "Installed ${LABEL}"
echo "Logs:"
echo "  ${RUNNER_DIR}/reminders-launchd.log"
echo "  ${RUNNER_DIR}/reminders-launchd.err"
echo "  ${RUNNER_DIR}/log-health-summary.txt"
echo "Secrets file:"
echo "  ${SECRET_FILE}"
echo "Runner dir:"
echo "  ${RUNNER_DIR}"
echo "Binary wrapper:"
echo "  ${BIN_TARGET}"
echo "Log checker wrapper:"
echo "  ${LOG_BIN_TARGET}"
