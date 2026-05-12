#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"
LIST_SCRIPT="$SCRIPT_DIR/list-unresolved-env-keys.sh"

require_file() {
  local file_path="$1"
  local label="$2"

  if [[ ! -f "$file_path" ]]; then
    echo "$label not found: $file_path" >&2
    return 1
  fi

  echo "$label found: $file_path"
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing environment file: $ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

main() {
  local failed=0
  local unresolved_keys

  unresolved_keys="$($LIST_SCRIPT "$ENV_FILE" || true)"
  if [[ -n "$unresolved_keys" ]]; then
    echo "Unresolved required env keys:" >&2
    echo "$unresolved_keys" >&2
    failed=1
  fi

  load_env

  require_file "$TLS_CERT_PATH" "Nginx TLS certificate" || failed=1
  require_file "$TLS_KEY_PATH" "Nginx TLS key" || failed=1

  if [[ -n "${TELEPORT_LICENSE_PATH:-}" ]]; then
    require_file "$TELEPORT_LICENSE_PATH" "Teleport license" || failed=1
  fi

  if [[ "$failed" == "1" ]]; then
    exit 1
  fi
}

main "$@"