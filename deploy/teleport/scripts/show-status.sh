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

  printf '\n'
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

proxy_dns_state() {
  local proxy_addr="$1"
  local host

  host="$(proxy_host "$proxy_addr")"
  if [[ -z "$host" ]]; then
    printf 'n/a\n'
    return
  fi

  if getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1; then
    printf 'ok\n'
    return
  fi

  printf 'unresolved\n'
}

direct_host_state() {
  local host="$1"

  if [[ -z "$host" ]]; then
    printf 'n/a\n'
    return
  fi

  if is_local_host "$host"; then
    printf 'ok\n'
    return
  fi

  if getent hosts "$host" >/dev/null 2>&1 || getent ahosts "$host" >/dev/null 2>&1; then
    printf 'ok\n'
    return
  fi

  printf 'unresolved\n'
}

ssh_client_state() {
  if command -v ssh >/dev/null 2>&1 && command -v scp >/dev/null 2>&1; then
    printf 'ok\n'
    return
  fi
  printf 'missing\n'
}

direct_local_privilege_state() {
  local host="$1"
  local user="$2"

  if [[ -z "$host" ]]; then
    printf 'n/a\n'
    return
  fi

  if ! is_local_host "$host"; then
    printf 'unknown\n'
    return
  fi

  if [[ "$user" == "root" ]]; then
    if timeout 8 ssh -o BatchMode=yes -o ConnectTimeout=5 "root@$host" true >/dev/null 2>&1; then
      printf 'ok\n'
      return
    fi
    printf 'missing\n'
    return
  fi

  if timeout 8 ssh -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" 'sudo -n true' >/dev/null 2>&1; then
    printf 'ok\n'
    return
  fi
  printf 'missing\n'
}

status_line() {
  local label="$1"
  local value="$2"
  printf '%-22s %s\n' "$label" "$value"
}

main() {
  local sync_unresolved_keys
  local deploy_unresolved_keys
  local sync_unresolved_count=0
  local deploy_unresolved_count=0
  local tsh_bin
  local tsh_state="n/a"
  local proxy_dns="n/a"
  local ssh_host_dns="n/a"
  local ssh_client="n/a"
  local direct_privilege="n/a"
  local tls_cert_state="missing"
  local tls_key_state="missing"
  local license_state="n/a"
  local sync_ready=1
  local deploy_ready=1

  load_env
  sync_unresolved_keys="$($LIST_SCRIPT --scope sync "$ENV_FILE" || true)"
  deploy_unresolved_keys="$($LIST_SCRIPT --scope deploy-only "$ENV_FILE" || true)"
  if [[ -n "$sync_unresolved_keys" ]]; then
    sync_unresolved_count="$(printf '%s\n' "$sync_unresolved_keys" | sed '/^$/d' | wc -l | tr -d ' ')"
    sync_ready=0
  fi
  if [[ -n "$deploy_unresolved_keys" ]]; then
    deploy_unresolved_count="$(printf '%s\n' "$deploy_unresolved_keys" | sed '/^$/d' | wc -l | tr -d ' ')"
    deploy_ready=0
  fi

  if [[ -f "$TLS_CERT_PATH" ]]; then
    tls_cert_state="ok"
  else
    deploy_ready=0
  fi

  if [[ -f "$TLS_KEY_PATH" ]]; then
    tls_key_state="ok"
  else
    deploy_ready=0
  fi

  if [[ -n "${TELEPORT_LICENSE_PATH:-}" ]]; then
    if [[ -f "$TELEPORT_LICENSE_PATH" ]]; then
      license_state="ok"
    else
      license_state="missing"
      deploy_ready=0
    fi
  fi

  tsh_bin="$(resolve_tsh_bin)"
  if [[ "${SALT_API_SSH_TRANSPORT:-}" == "teleport" ]]; then
    proxy_dns="$(proxy_dns_state "${SALT_API_TELEPORT_PROXY:-}")"
    if [[ "$proxy_dns" != "ok" ]]; then
      sync_ready=0
    fi
    if [[ -n "$tsh_bin" ]]; then
      if "$tsh_bin" status >/dev/null 2>&1; then
        tsh_state="logged-in"
      else
        tsh_state="not-logged-in"
        sync_ready=0
      fi
    else
      tsh_state="not-found"
      sync_ready=0
    fi
  else
    ssh_host_dns="$(direct_host_state "${SALT_API_SSH_HOST:-}")"
    ssh_client="$(ssh_client_state)"
    direct_privilege="$(direct_local_privilege_state "${SALT_API_SSH_HOST:-}" "${SALT_API_SSH_USER:-root}")"
    if [[ "$ssh_host_dns" != "ok" ]]; then
      sync_ready=0
    fi
    if [[ "$ssh_client" != "ok" ]]; then
      sync_ready=0
    fi
    if [[ "$direct_privilege" == "missing" ]]; then
      sync_ready=0
    fi
  fi

  echo "Teleport local status"
  status_line "env file" "$ENV_FILE"
  status_line "transport" "${SALT_API_SSH_TRANSPORT:-direct}"
  status_line "teleport proxy" "${SALT_API_TELEPORT_PROXY:-n/a}"
  status_line "proxy dns" "$proxy_dns"
  status_line "ssh host" "${SALT_API_SSH_HOST:-n/a}"
  status_line "ssh host dns" "$ssh_host_dns"
  status_line "ssh client" "$ssh_client"
  status_line "direct privilege" "$direct_privilege"
  status_line "teleport node" "${SALT_API_TELEPORT_NODE:-n/a}"
  status_line "sync unresolved" "$sync_unresolved_count"
  status_line "deploy unresolved" "$deploy_unresolved_count"
  status_line "nginx tls cert" "$tls_cert_state"
  status_line "nginx tls key" "$tls_key_state"
  status_line "teleport license" "$license_state"
  status_line "tsh" "$tsh_state"
  status_line "sync ready" "$( [[ "$sync_ready" == "1" ]] && printf yes || printf no )"
  status_line "deploy ready" "$( [[ "$deploy_ready" == "1" ]] && printf yes || printf no )"

  echo
  if [[ "$sync_unresolved_count" != "0" ]]; then
    echo "Unresolved sync keys:"
    printf '%s\n' "$sync_unresolved_keys"
    echo
  fi

  if [[ "$deploy_unresolved_count" != "0" ]]; then
    echo "Unresolved deploy-only keys:"
    printf '%s\n' "$deploy_unresolved_keys"
    echo
  fi

  if [[ "$proxy_dns" == "unresolved" ]]; then
    echo "Teleport proxy host is not resolvable from this machine."
    echo "Update SALT_API_TELEPORT_PROXY or add DNS/hosts resolution for $(proxy_host "${SALT_API_TELEPORT_PROXY:-}")."
    echo
  fi

  if [[ "$ssh_host_dns" == "unresolved" ]]; then
    echo "Direct SSH host is not resolvable from this machine."
    echo "Update SALT_API_SSH_HOST or add DNS/hosts resolution for ${SALT_API_SSH_HOST:-<unset>}."
    echo
  fi

  if [[ "$ssh_client" == "missing" ]]; then
    echo "Local SSH client tools are required for direct transport: ssh and scp."
    echo
  fi

  if [[ "${SALT_API_SSH_TRANSPORT:-direct}" == "direct" ]]; then
    if [[ "$direct_privilege" == "missing" ]]; then
      echo "Direct transport is missing required install privileges on ${SALT_API_SSH_USER:-root}@${SALT_API_SSH_HOST:-<unset>}."
      echo "Use root SSH or passwordless sudo for install/systemctl/curl/journalctl on the target host."
    elif [[ "$direct_privilege" == "unknown" ]]; then
      echo "Direct transport still requires remote install privileges on ${SALT_API_SSH_USER:-root}@${SALT_API_SSH_HOST:-<unset>}"
      echo "Use root SSH or passwordless sudo for install/systemctl/curl/journalctl on the target host."
    fi
    echo
  fi

  if [[ "$sync_ready" == "1" ]]; then
    echo "Next command: make teleport-sync"
  else
    echo "Next command: make teleport-manual-steps"
  fi
}

main "$@"