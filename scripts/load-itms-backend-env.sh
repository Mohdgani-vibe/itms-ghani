#!/usr/bin/env bash

if [[ -n "${ITMS_BACKEND_ENV_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

__itms_loader_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$__itms_loader_root/backend/.env}"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"

set -a
if [[ -f "$BACKEND_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_ENV_FILE"
fi
if [[ -f "$BACKEND_SECRETS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_SECRETS_FILE"
fi
set +a

ITMS_BACKEND_ENV_LOADED=1
export ITMS_BACKEND_ENV_LOADED