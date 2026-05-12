#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"

usage() {
  cat <<'EOF'
Usage:
  sync-salt-config.sh [options]

Options:
  --dry-run         Show the remote sync actions without copying or restarting anything
  --restart-salt-api Restart SALT_API_SERVICE_NAME on the remote host after install
  --check-salt-api  Check SALT_API_HEALTHCHECK_URL on the remote host after install
  --help            Show this message
EOF
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
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

is_local_host() {
  local host="$1"
  case "$host" in
    localhost|127.0.0.1|::1)
      return 0
      ;;
  esac
  return 1
}

validate_teleport_proxy_dns() {
  local host

  host="$(proxy_host "$SALT_API_TELEPORT_PROXY")"
  if getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1; then
    return 0
  fi

  echo "Teleport proxy hostname is not resolvable from this host: $host" >&2
  echo "Configured proxy: $SALT_API_TELEPORT_PROXY" >&2
  echo "Update SALT_API_TELEPORT_PROXY in $ENV_FILE to a reachable Teleport proxy endpoint, or add DNS/hosts resolution for $host before retrying." >&2
  return 1
}

validate_direct_host_resolution() {
  local host="${SALT_API_SSH_HOST:-}"

  if [[ -z "$host" ]]; then
    echo "SALT_API_SSH_HOST is not set in $ENV_FILE" >&2
    return 1
  fi

  if is_local_host "$host"; then
    return 0
  fi

  if getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1; then
    return 0
  fi

  echo "Direct SSH host is not resolvable from this host: $host" >&2
  echo "Configured direct SSH target: ${SALT_API_SSH_USER:-root}@$host:${SALT_API_SSH_PORT:-22}" >&2
  echo "Update SALT_API_SSH_HOST in $ENV_FILE to a reachable SSH endpoint, or add DNS/hosts resolution for $host before retrying." >&2
  return 1
}

direct_local_privilege_ready() {
  local host="${SALT_API_SSH_HOST:-}"
  local user="${SALT_API_SSH_USER:-root}"

  if ! is_local_host "$host"; then
    return 0
  fi

  if [[ "$user" == "root" ]]; then
    timeout 8 ssh -o BatchMode=yes -o ConnectTimeout=5 "root@$host" true >/dev/null 2>&1
    return $?
  fi

  timeout 8 ssh -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" 'sudo -n true' >/dev/null 2>&1
}

validate_direct_local_privileges() {
  local host="${SALT_API_SSH_HOST:-}"
  local user="${SALT_API_SSH_USER:-root}"

  if ! is_local_host "$host"; then
    return 0
  fi

  if direct_local_privilege_ready; then
    return 0
  fi

  if [[ "$user" == "root" ]]; then
    echo "Local direct SSH target requires working root SSH access, but root@$host is not reachable with the current SSH auth." >&2
    echo "Enable root SSH for the target host or switch SALT_API_SSH_USER to a non-root account with passwordless sudo before retrying." >&2
    return 1
  fi

  echo "Local direct SSH target requires passwordless sudo for $user@$host, but 'sudo -n true' failed over SSH." >&2
  echo "Grant passwordless sudo to $user for install/systemctl/curl/journalctl operations, or switch SALT_API_SSH_USER to root with working SSH access before retrying." >&2
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

validate_no_placeholders() {
  local placeholder_lines

  placeholder_lines="$(grep -nE '^[A-Z0-9_]+=.*(replace-|changeme)' "$ENV_FILE" || true)"
  if [[ -z "$placeholder_lines" ]]; then
    return 0
  fi

  if [[ -n "$placeholder_lines" ]]; then
    if [[ "$dry_run" == "1" ]]; then
      echo "Warning: unresolved placeholder values remain in $ENV_FILE:" >&2
      echo "$placeholder_lines" >&2
      return 0
    fi
    echo "Unresolved placeholder values remain in $ENV_FILE:" >&2
    echo "$placeholder_lines" >&2
    return 1
  fi
}

validate_sync_placeholders() {
  local placeholder_lines
  local sync_keys_pattern

  sync_keys_pattern='^(SALT_API_BIND_HOST|SALT_API_BIND_PORT|SALT_API_TLS_CERT_PATH|SALT_API_TLS_KEY_PATH|SALT_API_CONFIG_TARGET|SALT_API_SERVICE_NAME|SALT_API_HEALTHCHECK_URL|SALT_API_HEALTHCHECK_TIMEOUT|SALT_API_JOURNAL_LINES|SALT_API_SSH_TRANSPORT|SALT_API_SSH_HOST|SALT_API_SSH_PORT|SALT_API_SSH_USER|SALT_API_REMOTE_TMPDIR|SALT_API_SSH_OPTIONS|SALT_API_TELEPORT_PROXY|SALT_API_TELEPORT_CLUSTER|SALT_API_TELEPORT_NODE|SALT_API_TELEPORT_OPTIONS)=.*(replace-|changeme)'
  placeholder_lines="$(grep -nE "${sync_keys_pattern}" "$ENV_FILE" || true)"
  if [[ -z "$placeholder_lines" ]]; then
    return 0
  fi

  if [[ "$dry_run" == "1" ]]; then
    echo "Warning: unresolved sync placeholder values remain in $ENV_FILE:" >&2
    echo "$placeholder_lines" >&2
    return 0
  fi

  echo "Unresolved sync placeholder values remain in $ENV_FILE:" >&2
  echo "$placeholder_lines" >&2
  return 1
}

read_ssh_options() {
  local ssh_port="${SALT_API_SSH_PORT:-22}"
  SSH_OPTS=(-p "$ssh_port")
  SCP_OPTS=(-P "$ssh_port")

  if [[ -n "${SALT_API_SSH_OPTIONS:-}" ]]; then
    local extra_opts=()
    read -r -a extra_opts <<<"$SALT_API_SSH_OPTIONS"
    SSH_OPTS+=("${extra_opts[@]}")
    SCP_OPTS+=("${extra_opts[@]}")
  fi
}

read_teleport_options() {
  TSH_SSH_OPTS=(--proxy "$SALT_API_TELEPORT_PROXY")
  TSH_SCP_OPTS=(--proxy "$SALT_API_TELEPORT_PROXY")

  if [[ -n "${SALT_API_TELEPORT_CLUSTER}" ]]; then
    TSH_SSH_OPTS+=(--cluster "$SALT_API_TELEPORT_CLUSTER")
    TSH_SCP_OPTS+=(--cluster "$SALT_API_TELEPORT_CLUSTER")
  fi

  if [[ -n "${SALT_API_TELEPORT_OPTIONS}" ]]; then
    local extra_opts=()
    read -r -a extra_opts <<<"$SALT_API_TELEPORT_OPTIONS"
    TSH_SSH_OPTS+=("${extra_opts[@]}")
    TSH_SCP_OPTS+=("${extra_opts[@]}")
  fi
}

normalize_transport() {
  local value="${SALT_API_SSH_TRANSPORT:-direct}"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"

  case "$value" in
    direct|teleport)
      printf '%s\n' "$value"
      ;;
    *)
      echo "Unsupported SALT_API_SSH_TRANSPORT: $value" >&2
      exit 1
      ;;
  esac
}

ensure_transport_requirements() {
  require bash
  if [[ "$dry_run" == "1" ]]; then
    return
  fi

  case "$SSH_TRANSPORT" in
    direct)
      require ssh
      require scp
      ;;
    teleport)
      TSH_CMD="$(resolve_tsh_bin)"
      ;;
  esac
}

validate_teleport_login() {
  if [[ "$dry_run" == "1" || "$SSH_TRANSPORT" != "teleport" ]]; then
    return 0
  fi

  validate_teleport_proxy_dns || return 1

  if "$TSH_CMD" status >/dev/null 2>&1; then
    return 0
  fi

  echo "Teleport client is not logged in for transport=teleport." >&2
  echo "Run the following command and retry:" >&2
  echo "  make teleport-login" >&2
  if [[ -n "${SALT_API_TELEPORT_CLUSTER}" ]]; then
    echo "  or TSH_BIN=\"$TSH_CMD\" \"$TSH_CMD\" login --proxy=$SALT_API_TELEPORT_PROXY --cluster=$SALT_API_TELEPORT_CLUSTER" >&2
  else
    echo "  or TSH_BIN=\"$TSH_CMD\" \"$TSH_CMD\" login --proxy=$SALT_API_TELEPORT_PROXY" >&2
  fi
  return 1
}

run_local_preflight_checks() {
  local failed=0

  validate_sync_placeholders || failed=1
  if [[ "$SSH_TRANSPORT" == "teleport" ]]; then
    validate_teleport_login || failed=1
  else
    validate_direct_host_resolution || failed=1
    if [[ "$dry_run" != "1" ]]; then
      validate_direct_local_privileges || failed=1
    fi
  fi

  if [[ "$failed" == "1" ]]; then
    exit 1
  fi
}

run_remote_shell() {
  if [[ "$SSH_TRANSPORT" == "teleport" ]]; then
    "$TSH_CMD" ssh "${TSH_SSH_OPTS[@]}" "$remote_host" -- "$@"
    return
  fi

  ssh "${SSH_OPTS[@]}" "$remote_host" "$@"
}

copy_to_remote() {
  local source_path="$1"
  local target_path="$2"

  if [[ "$SSH_TRANSPORT" == "teleport" ]]; then
    "$TSH_CMD" scp "${TSH_SCP_OPTS[@]}" "$source_path" "$remote_host:$target_path"
    return
  fi

  scp "${SCP_OPTS[@]}" "$source_path" "$remote_host:$target_path"
}

validate_file_exists() {
  local file_path="$1"
  local label="$2"

  if [[ ! -f "$file_path" ]]; then
    echo "$label not found: $file_path" >&2
    exit 1
  fi
}

run_remote_preflight() {
  run_remote_shell bash -s -- \
    "$SALT_API_CONFIG_TARGET" \
    "$SALT_API_TLS_CERT_PATH" \
    "$SALT_API_TLS_KEY_PATH" \
    "$SALT_API_SERVICE_NAME" \
    "$restart_salt_api" \
    "$check_salt_api" <<'EOF'
set -euo pipefail

target_path="$1"
tls_cert_path="$2"
tls_key_path="$3"
service_name="$4"
restart_service="$5"
check_health="$6"

require_remote() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command on remote host: $1" >&2
    exit 1
  }
}

can_use_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

target_dir="$(dirname "$target_path")"

[[ -f "$tls_cert_path" ]] || {
  echo "Salt API TLS certificate not found on remote host: $tls_cert_path" >&2
  exit 1
}
[[ -f "$tls_key_path" ]] || {
  echo "Salt API TLS key not found on remote host: $tls_key_path" >&2
  exit 1
}
[[ -d "$target_dir" ]] || {
  echo "Salt config target directory does not exist on remote host: $target_dir" >&2
  exit 1
}

if [[ ! -w "$target_dir" ]] && ! can_use_sudo; then
  echo "Target directory is not writable and passwordless sudo is unavailable: $target_dir" >&2
  exit 1
fi

if [[ "$restart_service" == "1" ]]; then
  require_remote systemctl
fi

if [[ "$restart_service" == "1" || "$check_health" == "1" ]]; then
  require_remote journalctl
fi

if [[ "$check_health" == "1" ]]; then
  require_remote curl
fi

echo "Remote preflight checks passed for $service_name"
EOF
}

restart_salt_api=0
check_salt_api=0
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --restart-salt-api)
      restart_salt_api=1
      ;;
    --check-salt-api)
      check_salt_api=1
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

SSH_TRANSPORT="$(normalize_transport)"
if [[ "$SSH_TRANSPORT" == "teleport" ]]; then
  : "${SALT_API_TELEPORT_PROXY:?SALT_API_TELEPORT_PROXY is required when SALT_API_SSH_TRANSPORT=teleport}"
  read_teleport_options
else
  read_ssh_options
fi
ensure_transport_requirements
run_local_preflight_checks

bash "$SCRIPT_DIR/render-configs.sh" --salt-only
validate_file_exists "$STACK_ROOT/runtime/rest_cherrypy.conf" "Rendered Salt API config"

remote_target="${SALT_API_SSH_HOST}"
if [[ "$SSH_TRANSPORT" == "teleport" && -n "${SALT_API_TELEPORT_NODE}" ]]; then
  remote_target="$SALT_API_TELEPORT_NODE"
fi
remote_host="${SALT_API_SSH_USER}@${remote_target}"
remote_tmp_path="${SALT_API_REMOTE_TMPDIR%/}/rest_cherrypy.conf.$$"

if [[ "$dry_run" -eq 1 ]]; then
  echo "Dry run: no files will be copied and no remote commands will run."
  echo "Transport: $SSH_TRANSPORT"
  echo "Remote host: $remote_host"
  if [[ "$SSH_TRANSPORT" == "teleport" ]]; then
    echo "Teleport proxy: $SALT_API_TELEPORT_PROXY"
    if [[ -n "${SALT_API_TELEPORT_CLUSTER}" ]]; then
      echo "Teleport cluster: $SALT_API_TELEPORT_CLUSTER"
    fi
    if [[ -n "${SALT_API_TELEPORT_NODE}" ]]; then
      echo "Teleport node override: $SALT_API_TELEPORT_NODE"
    fi
    echo "Teleport options: ${TSH_SSH_OPTS[*]}"
  else
    echo "SSH options: ${SSH_OPTS[*]}"
  fi
  echo "Upload: $STACK_ROOT/runtime/rest_cherrypy.conf -> $remote_tmp_path"
  echo "Install target: $SALT_API_CONFIG_TARGET"
  echo "Remote TLS cert check: $SALT_API_TLS_CERT_PATH"
  echo "Remote TLS key check: $SALT_API_TLS_KEY_PATH"
  echo "Would run remote preflight probe before upload"
  echo "Would create a timestamped backup of the current remote config before overwrite"
  if [[ "$restart_salt_api" -eq 1 ]]; then
    echo "Would restart remote service: $SALT_API_SERVICE_NAME"
  fi
  if [[ "$check_salt_api" -eq 1 ]]; then
    echo "Would health-check remote URL: $SALT_API_HEALTHCHECK_URL"
  fi
  exit 0
fi

run_remote_preflight

copy_to_remote "$STACK_ROOT/runtime/rest_cherrypy.conf" "$remote_tmp_path"

run_remote_shell bash -s -- \
  "$remote_tmp_path" \
  "$SALT_API_CONFIG_TARGET" \
  "$SALT_API_TLS_CERT_PATH" \
  "$SALT_API_TLS_KEY_PATH" \
  "$SALT_API_SERVICE_NAME" \
  "$SALT_API_HEALTHCHECK_URL" \
  "$SALT_API_HEALTHCHECK_TIMEOUT" \
  "$SALT_API_JOURNAL_LINES" \
  "$restart_salt_api" \
  "$check_salt_api" <<'EOF'
set -euo pipefail

remote_tmp_path="$1"
target_path="$2"
tls_cert_path="$3"
tls_key_path="$4"
service_name="$5"
healthcheck_url="$6"
healthcheck_timeout="$7"
journal_lines="$8"
restart_service="$9"
check_health="${10}"
backup_path=""
backup_created=0
installed_new_config=0
restore_attempted=0

require_remote() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command on remote host: $1" >&2
    exit 1
  }
}

can_use_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

run_with_optional_sudo() {
  if "$@"; then
    return 0
  fi

  if can_use_sudo; then
    sudo -n "$@"
    return 0
  fi

  return 1
}

show_remote_diagnostics() {
  local service="$1"

  echo "Remote diagnostics for $service:" >&2
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl status "$service" --no-pager -l >&2; then
      :
    elif can_use_sudo; then
      sudo -n systemctl status "$service" --no-pager -l >&2 || true
    fi
  fi

  if command -v journalctl >/dev/null 2>&1; then
    if journalctl -u "$service" -n "$journal_lines" --no-pager >&2; then
      :
    elif can_use_sudo; then
      sudo -n journalctl -u "$service" -n "$journal_lines" --no-pager >&2 || true
    fi
  fi
}

cleanup_remote_tmp() {
  if [[ -f "$remote_tmp_path" ]]; then
    if ! run_with_optional_sudo rm -f "$remote_tmp_path"; then
      echo "Failed to remove remote temporary file: $remote_tmp_path" >&2
    fi
  fi
}

restore_backup() {
  if [[ "$backup_created" != "1" || -z "$backup_path" || "$restore_attempted" == "1" ]]; then
    return 0
  fi

  restore_attempted=1
  echo "Restoring previous Salt API config from $backup_path" >&2
  if ! run_with_optional_sudo install -D -m 0640 "$backup_path" "$target_path"; then
    echo "Failed to restore backup config from $backup_path" >&2
    return 1
  fi
  run_with_optional_sudo rm -f "$backup_path" || true

  if [[ "$restart_service" == "1" ]]; then
    run_remote_systemctl restart "$service_name" || true
  fi
}

rollback_on_error() {
  local exit_code=$?

  cleanup_remote_tmp
  if [[ "$installed_new_config" == "1" ]]; then
    echo "Remote Salt config update failed. Attempting rollback." >&2
    restore_backup || true
  fi
  show_remote_diagnostics "$service_name"
  exit "$exit_code"
}

trap rollback_on_error ERR
trap cleanup_remote_tmp EXIT

run_remote_systemctl() {
  local action="$1"
  local service="$2"

  if systemctl "$action" "$service" >/dev/null 2>&1; then
    return 0
  fi
  if can_use_sudo; then
    if sudo -n systemctl "$action" "$service"; then
      return 0
    fi
  fi

  show_remote_diagnostics "$service"
  echo "Unable to run systemctl $action $service on remote host" >&2
  exit 1
}

[[ -f "$remote_tmp_path" ]] || {
  echo "Uploaded Salt config not found: $remote_tmp_path" >&2
  exit 1
}
[[ -f "$tls_cert_path" ]] || {
  echo "Salt API TLS certificate not found on remote host: $tls_cert_path" >&2
  exit 1
}
[[ -f "$tls_key_path" ]] || {
  echo "Salt API TLS key not found on remote host: $tls_key_path" >&2
  exit 1
}

target_dir="$(dirname "$target_path")"
if [[ ! -d "$target_dir" ]]; then
  echo "Salt config target directory does not exist on remote host: $target_dir" >&2
  exit 1
fi

if [[ -f "$target_path" ]]; then
  backup_path="${target_path}.bak.$(date +%Y%m%d%H%M%S)"
  if ! run_with_optional_sudo cp -p "$target_path" "$backup_path"; then
    echo "Failed to create backup of existing Salt config: $target_path" >&2
    exit 1
  fi
  backup_created=1
  echo "Created backup of previous Salt API config at $backup_path"
fi

if ! run_with_optional_sudo install -D -m 0640 "$remote_tmp_path" "$target_path"; then
  echo "Failed to install Salt API config to $target_path" >&2
  exit 1
fi
installed_new_config=1
cleanup_remote_tmp

echo "Installed Salt API config to $target_path on remote host"

if [[ "$restart_service" == "1" ]]; then
  run_remote_systemctl restart "$service_name"
  run_remote_systemctl is-active "$service_name"
  echo "Restarted Salt API service on remote host: $service_name"
fi

if [[ "$check_health" == "1" ]]; then
  require_remote curl
  if ! curl -ksSf --max-time "$healthcheck_timeout" "$healthcheck_url" >/dev/null; then
    show_remote_diagnostics "$service_name"
    echo "Salt API health check failed on remote host: $healthcheck_url" >&2
    exit 1
  fi
  echo "Salt API health check succeeded on remote host: $healthcheck_url"
fi

if [[ "$backup_created" == "1" ]]; then
  run_with_optional_sudo rm -f "$backup_path" || true
fi
EOF

echo "Salt API config synced to $remote_host"
