#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"

usage() {
  cat <<'EOF'
Usage:
  teleport-login.sh [--print]

Options:
  --print   Print the tsh login command instead of executing it
  --help    Show this message
EOF
}

resolve_tsh_bin() {
  if [[ -n "${TSH_BIN:-}" && -x "${TSH_BIN}" ]]; then
    printf '%s\n' "${TSH_BIN}"
    return
  fi

  if command -v tsh >/dev/null 2>&1; then
    command -v tsh
    return
  fi

  if [[ -x "$HOME/.local/bin/tsh" ]]; then
    printf '%s\n' "$HOME/.local/bin/tsh"
    return
  fi

  echo "Missing required command: tsh" >&2
  exit 1
}

proxy_host() {
  local proxy_addr="$1"
  printf '%s\n' "$proxy_addr" | cut -d: -f1
}

validate_proxy_dns() {
  local proxy_addr="$1"
  local host

  host="$(proxy_host "$proxy_addr")"
  if getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1; then
    return 0
  fi

  echo "Teleport proxy hostname is not resolvable from this host: $host" >&2
  echo "Configured proxy: $proxy_addr" >&2
  echo "Update SALT_API_TELEPORT_PROXY in $ENV_FILE to a reachable Teleport proxy endpoint, or add DNS/hosts resolution for $host before retrying." >&2
  return 1
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

print_login_command() {
  local tsh_bin="$1"

  if [[ -n "${SALT_API_TELEPORT_CLUSTER:-}" ]]; then
    printf 'TSH_BIN="%s" "%s" login --proxy=%s --cluster=%s\n' \
      "$tsh_bin" "$tsh_bin" "$SALT_API_TELEPORT_PROXY" "$SALT_API_TELEPORT_CLUSTER"
    return
  fi

  printf 'TSH_BIN="%s" "%s" login --proxy=%s\n' \
    "$tsh_bin" "$tsh_bin" "$SALT_API_TELEPORT_PROXY"
}

main() {
  local print_only=0
  local tsh_bin

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --print)
        print_only=1
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

  load_env
  tsh_bin="$(resolve_tsh_bin)"

  if [[ "${SALT_API_SSH_TRANSPORT:-direct}" != "teleport" ]]; then
    echo "SALT_API_SSH_TRANSPORT is not set to teleport in $ENV_FILE" >&2
    exit 1
  fi

  if [[ -z "${SALT_API_TELEPORT_PROXY:-}" ]]; then
    echo "SALT_API_TELEPORT_PROXY is not set in $ENV_FILE" >&2
    exit 1
  fi

  validate_proxy_dns "$SALT_API_TELEPORT_PROXY"

  if [[ "$print_only" == "1" ]]; then
    print_login_command "$tsh_bin"
    exit 0
  fi

  if [[ -n "${SALT_API_TELEPORT_CLUSTER:-}" ]]; then
    export TSH_BIN="$tsh_bin"
    exec "$tsh_bin" login --proxy="$SALT_API_TELEPORT_PROXY" --cluster="$SALT_API_TELEPORT_CLUSTER"
  fi

  export TSH_BIN="$tsh_bin"
  exec "$tsh_bin" login --proxy="$SALT_API_TELEPORT_PROXY"
}

main "$@"