#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"
LIST_SCRIPT="$SCRIPT_DIR/list-unresolved-env-keys.sh"

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

check_file() {
  local file_path="$1"
  if [[ -f "$file_path" ]]; then
    return 0
  fi
  return 1
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

proxy_dns_is_ok() {
  local host

  host="$(proxy_host "${SALT_API_TELEPORT_PROXY:-}")"
  if [[ -z "$host" ]]; then
    return 1
  fi

  getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1
}

direct_host_is_ok() {
  local host="${SALT_API_SSH_HOST:-}"

  if [[ -z "$host" ]]; then
    return 1
  fi

  if is_local_host "$host"; then
    return 0
  fi

  getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1
}

ssh_tools_ok() {
  command -v ssh >/dev/null 2>&1 && command -v scp >/dev/null 2>&1
}

direct_local_privilege_is_ready() {
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

print_tsh_login_step() {
  local tsh_bin="${TSH_BIN:-}"

  if [[ -z "$tsh_bin" ]]; then
    if command -v tsh >/dev/null 2>&1; then
      tsh_bin="$(command -v tsh)"
    elif [[ -x "$HOME/.local/bin/tsh" ]]; then
      tsh_bin="$HOME/.local/bin/tsh"
    fi
  fi

  if [[ -n "$tsh_bin" && -x "$tsh_bin" ]]; then
    if "$tsh_bin" status >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "- Log in to Teleport before the real sync:" 
  echo "  make teleport-login"
  if [[ -n "$tsh_bin" ]]; then
    if [[ -n "${SALT_API_TELEPORT_CLUSTER:-}" ]]; then
      echo "  or TSH_BIN=\"$tsh_bin\" \"$tsh_bin\" login --proxy=$SALT_API_TELEPORT_PROXY --cluster=$SALT_API_TELEPORT_CLUSTER"
    else
      echo "  or TSH_BIN=\"$tsh_bin\" \"$tsh_bin\" login --proxy=$SALT_API_TELEPORT_PROXY"
    fi
  else
    echo "  or tsh login --proxy=$SALT_API_TELEPORT_PROXY"
  fi

  return 1
}

main() {
  local sync_unresolved_keys
  local deploy_unresolved_keys
  local has_sync_blockers=0
  local has_deploy_blockers=0

  load_env
  sync_unresolved_keys="$($LIST_SCRIPT --scope sync "$ENV_FILE" || true)"
  deploy_unresolved_keys="$($LIST_SCRIPT --scope deploy-only "$ENV_FILE" || true)"

  echo "Remaining manual Teleport rollout steps:"

  if [[ -n "$sync_unresolved_keys" ]]; then
    has_sync_blockers=1
    echo
    echo "Sync blockers:"
    echo "- Fill these required env keys in $ENV_FILE:"
    while IFS= read -r key; do
      [[ -n "$key" ]] || continue
      echo "  $key"
    done <<<"$sync_unresolved_keys"
  fi

  if [[ "${SALT_API_SSH_TRANSPORT:-}" == "teleport" ]]; then
    local teleport_proxy_blocked=0
    local teleport_login_blocked=0

    if ! proxy_dns_is_ok; then
      if [[ "$has_sync_blockers" == "0" ]]; then
        echo
        echo "Sync blockers:"
      fi
      echo "- Resolve the Teleport proxy hostname before login: $(proxy_host "${SALT_API_TELEPORT_PROXY:-}")"
      echo "  Update SALT_API_TELEPORT_PROXY in $ENV_FILE to a reachable endpoint, or add DNS/hosts resolution for that name."
      teleport_proxy_blocked=1
    fi

    if ! print_tsh_login_step; then
      if [[ "$teleport_proxy_blocked" == "0" && "$has_sync_blockers" == "0" ]]; then
        echo
        echo "Sync blockers:"
      fi
      teleport_login_blocked=1
    fi

    if [[ "$teleport_proxy_blocked" == "1" || "$teleport_login_blocked" == "1" ]]; then
      has_sync_blockers=1
    fi
  elif [[ "${SALT_API_SSH_TRANSPORT:-direct}" == "direct" ]]; then
    if [[ -n "$sync_unresolved_keys" ]]; then
      :
    elif ! direct_host_is_ok || ! ssh_tools_ok || ! direct_local_privilege_is_ready; then
      echo
      echo "Sync blockers:"
    fi
    if ! direct_host_is_ok; then
      has_sync_blockers=1
      echo "- Resolve the direct SSH host before sync: ${SALT_API_SSH_HOST:-<unset>}"
      echo "  Update SALT_API_SSH_HOST in $ENV_FILE to a reachable endpoint, or add DNS/hosts resolution for that name."
    fi
    if ! ssh_tools_ok; then
      has_sync_blockers=1
      echo "- Install local SSH client tools before sync: ssh and scp"
    fi
    if ! direct_local_privilege_is_ready; then
      has_sync_blockers=1
      echo "- Local direct target is reachable, but ${SALT_API_SSH_USER:-root} lacks required install privileges over SSH."
      echo "  Use root SSH, or grant passwordless sudo for install/systemctl/curl/journalctl operations."
    else
      echo
      echo "Direct SSH requirements:"
      echo "- Ensure the SSH user can install and restart Salt on the remote host:"
      echo "  Use root SSH, or grant passwordless sudo to ${SALT_API_SSH_USER:-root} for install/systemctl/curl/journalctl operations."
    fi
  fi

  if [[ -n "$deploy_unresolved_keys" ]]; then
    echo
    echo "Deploy-only blockers:"
    has_deploy_blockers=1
    echo "- Fill these deploy-only env keys in $ENV_FILE:"
    while IFS= read -r key; do
      [[ -n "$key" ]] || continue
      echo "  $key"
    done <<<"$deploy_unresolved_keys"
  fi

  if ! check_file "$TLS_CERT_PATH"; then
    if [[ "$has_deploy_blockers" == "0" ]]; then
      echo
      echo "Deploy-only blockers:"
    fi
    has_deploy_blockers=1
    echo "- Provide the Nginx TLS certificate or update TLS_CERT_PATH: $TLS_CERT_PATH"
  fi

  if ! check_file "$TLS_KEY_PATH"; then
    if [[ "$has_deploy_blockers" == "0" ]]; then
      echo
      echo "Deploy-only blockers:"
    fi
    has_deploy_blockers=1
    echo "- Provide the Nginx TLS key or update TLS_KEY_PATH: $TLS_KEY_PATH"
  fi

  if [[ -n "${TELEPORT_LICENSE_PATH:-}" ]] && ! check_file "$TELEPORT_LICENSE_PATH"; then
    if [[ "$has_deploy_blockers" == "0" ]]; then
      echo
      echo "Deploy-only blockers:"
    fi
    has_deploy_blockers=1
    echo "- Provide the Teleport license or update TELEPORT_LICENSE_PATH: $TELEPORT_LICENSE_PATH"
  fi

  echo
  if [[ "$has_sync_blockers" == "0" ]]; then
    if [[ "${SALT_API_SSH_TRANSPORT:-direct}" == "direct" ]]; then
      echo "- Local reachability checks passed for direct transport. If remote install privileges are in place, next step:"
    else
      echo "- No local blockers detected for make teleport-sync. Next step:"
    fi
    echo "  make teleport-sync"
  elif [[ "$has_deploy_blockers" == "1" ]]; then
    echo "- Deploy-only blockers above do not prevent make teleport-sync, but they do block a full Teleport stack deploy."
  fi
}

main "$@"