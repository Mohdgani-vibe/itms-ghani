#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCOPE="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'EOF'
Usage:
  list-unresolved-env-keys.sh [--scope all|sync|deploy-only] [env-file]
EOF
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

ENV_FILE="${1:-${ENV_FILE:-$STACK_ROOT/.env}}"
SYNC_KEYS_REGEX='^(SALT_API_BIND_HOST|SALT_API_BIND_PORT|SALT_API_TLS_CERT_PATH|SALT_API_TLS_KEY_PATH|SALT_API_CONFIG_TARGET|SALT_API_SERVICE_NAME|SALT_API_HEALTHCHECK_URL|SALT_API_HEALTHCHECK_TIMEOUT|SALT_API_JOURNAL_LINES|SALT_API_SSH_TRANSPORT|SALT_API_SSH_HOST|SALT_API_SSH_PORT|SALT_API_SSH_USER|SALT_API_REMOTE_TMPDIR|SALT_API_SSH_OPTIONS|SALT_API_TELEPORT_PROXY|SALT_API_TELEPORT_CLUSTER|SALT_API_TELEPORT_NODE|SALT_API_TELEPORT_OPTIONS)$'
VALID_SALT_APP_ENVIRONMENTS_REGEX='^(staging|monitoring|production)$'

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

matches="$(grep -nE '^[A-Z0-9_]+=.*(replace-|changeme)' "$ENV_FILE" || true)"

salt_app_environment="$(grep -E '^SALT_APP_ENVIRONMENT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
if [[ -n "$salt_app_environment" ]] && [[ ! "$salt_app_environment" =~ $VALID_SALT_APP_ENVIRONMENTS_REGEX ]]; then
  if [[ -n "$matches" ]]; then
    matches+=$'\n'
  fi
  matches+="SALT_APP_ENVIRONMENT=$salt_app_environment"
fi

if [[ -z "$matches" ]]; then
  exit 0
fi

keys="$(printf '%s\n' "$matches" | sed -E 's/^[0-9]+://; s/=.*$//')"

case "$SCOPE" in
  all)
    printf '%s\n' "$keys"
    ;;
  sync)
    printf '%s\n' "$keys" | grep -E "$SYNC_KEYS_REGEX" || true
    ;;
  deploy-only)
    printf '%s\n' "$keys" | grep -Ev "$SYNC_KEYS_REGEX" || true
    ;;
  *)
    echo "Unsupported scope: $SCOPE" >&2
    exit 1
    ;;
esac
