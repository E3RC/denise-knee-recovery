#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_NAME="denise-recovery-app"
SERVICE_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.service"

mkdir -p "${SYSTEMD_DIR}"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Denise Recovery app on mele01
After=network-online.target docker.service tailscaled.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${REPO_DIR}
Environment=PORT=8080
ExecStart=${REPO_DIR}/scripts/run-app.sh
ExecStop=/usr/bin/bash -lc 'cd "${REPO_DIR}" && docker compose down'
TimeoutStartSec=0

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "${SERVICE_NAME}.service"

echo "Installed ${SERVICE_NAME}.service"
echo "Service file: ${SERVICE_FILE}"
