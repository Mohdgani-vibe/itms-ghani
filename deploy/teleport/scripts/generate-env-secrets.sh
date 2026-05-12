#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  generate-env-secrets.sh [--dry-run]

Replaces placeholder values for randomly generated secrets in deploy/teleport/.env.
It updates only:
  POSTGRES_PASSWORD
  TELEPORT_AUTH_TOKEN
  SESSION_STORAGE_ACCESS_KEY
  SESSION_STORAGE_SECRET_KEY

It does not modify TELEPORT_CA_PIN, SESSION_STORAGE_URI, BACKUP_S3_URI, or file paths.
EOF
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

require openssl
require python3
require cp

generate_hex() {
  openssl rand -hex 32
}

replace_placeholder() {
  local key="$1"
  local current_value="$2"
  local new_value="$3"

  if [[ "$current_value" != *replace-* && "$current_value" != *changeme* ]]; then
    return 0
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "Would replace placeholder for $key"
    return 0
  fi

  python_expr_old=$(printf '%s=%s' "$key" "$current_value")
  python_expr_new=$(printf '%s=%s' "$key" "$new_value")
  python3 - "$ENV_FILE" "$python_expr_old" "$python_expr_new" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
old = sys.argv[2]
new = sys.argv[3]
text = path.read_text()
if text.count(old) != 1:
    raise SystemExit(f"Expected exactly one match for: {old}")
path.write_text(text.replace(old, new, 1))
PY
  echo "Replaced placeholder for $key"
}

backup_file="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
if [[ "$DRY_RUN" != "1" ]]; then
  cp "$ENV_FILE" "$backup_file"
  echo "Backup created: $backup_file"
fi

while IFS='=' read -r key value; do
  case "$key" in
    POSTGRES_PASSWORD|TELEPORT_AUTH_TOKEN|SESSION_STORAGE_ACCESS_KEY|SESSION_STORAGE_SECRET_KEY)
      replace_placeholder "$key" "$value" "$(generate_hex)"
      ;;
  esac
done < <(grep -E '^(POSTGRES_PASSWORD|TELEPORT_AUTH_TOKEN|SESSION_STORAGE_ACCESS_KEY|SESSION_STORAGE_SECRET_KEY)=' "$ENV_FILE")