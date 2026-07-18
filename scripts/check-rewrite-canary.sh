#!/usr/bin/env bash
set -euo pipefail

PORT="${HOST_PORT:-8080}"
BASE="http://127.0.0.1:${PORT}"

curl --fail --silent --show-error "${BASE}/api/health" >/dev/null
curl --fail --silent --show-error -o /dev/null -w 'family: %{http_code}\n' "${BASE}/"
curl --fail --silent --show-error -o /dev/null -w 'caregiver: %{http_code}\n' "${BASE}/caregiver"
curl --fail --silent --show-error -o /dev/null -w 'dashboard unauthenticated: %{http_code}\n' "${BASE}/dashboard"

echo "Application is responding on ${BASE}."
