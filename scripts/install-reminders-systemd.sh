#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_NAME="denise-recovery-reminders"
SERVICE_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.service"
TIMER_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.timer"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'denise-knee-recovery-rewrite-reminders-1'; then
  if [[ "${ALLOW_LEGACY_REMINDERS:-}" != "1" ]]; then
    echo "Rewrite reminder worker is already running."
    echo "Refusing to enable the legacy systemd timer because it would duplicate Pushover notifications."
    echo "Set ALLOW_LEGACY_REMINDERS=1 only if you intentionally want the old timer instead of the rewrite worker."
    exit 1
  fi
fi

mkdir -p "${SYSTEMD_DIR}"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Denise Recovery Pushover reminders

[Service]
Type=oneshot
WorkingDirectory=${REPO_DIR}
ExecStart=${REPO_DIR}/scripts/run-reminders.sh
EOF

cat > "${TIMER_FILE}" <<EOF
[Unit]
Description=Run Denise Recovery reminders every minute

[Timer]
OnBootSec=1m
OnUnitActiveSec=1m
AccuracySec=10s
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "${SERVICE_NAME}.timer"

echo "Installed ${SERVICE_NAME}.timer"
echo "Service file: ${SERVICE_FILE}"
echo "Timer file: ${TIMER_FILE}"
