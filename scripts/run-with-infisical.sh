#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [args...]"
  exit 1
fi

if ! command -v infisical >/dev/null 2>&1; then
  echo "Missing required command: infisical"
  exit 1
fi

if [[ -n "${INFISICAL_DOMAIN:-}" ]]; then
  export INFISICAL_DOMAIN
fi

if [[ -z "${INFISICAL_TOKEN:-}" ]]; then
  if [[ -n "${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID:-}" && -n "${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET:-}" ]]; then
    export INFISICAL_TOKEN
    INFISICAL_TOKEN="$(
      infisical login \
        --method=universal-auth \
        --client-id="${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID}" \
        --client-secret="${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET}" \
        --silent \
        --plain
    )"
    export INFISICAL_TOKEN
  else
    echo "Missing INFISICAL_TOKEN or universal auth credentials."
    exit 1
  fi
fi

if [[ -z "${INFISICAL_PROJECT_ID:-}" ]]; then
  echo "Missing required env var: INFISICAL_PROJECT_ID"
  exit 1
fi

INFISICAL_ARGS=(
  run
  --projectId="${INFISICAL_PROJECT_ID}"
)

if [[ -n "${INFISICAL_ENV:-}" ]]; then
  INFISICAL_ARGS+=(--env="${INFISICAL_ENV}")
fi

if [[ -n "${INFISICAL_PATH:-}" ]]; then
  INFISICAL_ARGS+=(--path="${INFISICAL_PATH}")
fi

INFISICAL_ARGS+=(-- "$@")

exec infisical "${INFISICAL_ARGS[@]}"
