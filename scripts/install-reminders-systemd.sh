#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_NAME="denise-recovery-reminders"
SERVICE_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.service"
TIMER_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.timer"

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
