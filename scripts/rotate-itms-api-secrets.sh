#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$REPO_ROOT/backend/.env}"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"
SALT_API_USER="${SALT_API_USER:-itms-salt}"
SALT_API_PORT="${SALT_API_PORT:-8000}"
WAZUH_API_USERNAME="${WAZUH_API_USERNAME:-wazuh}"
CHECK_ONLY=0
ROTATE_SALT=1
ROTATE_WAZUH=1
SALT_API_PASSWORD="${SALT_API_PASSWORD:-}"
WAZUH_API_PASSWORD="${WAZUH_API_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage:
  scripts/rotate-itms-api-secrets.sh [options]

Options:
  --check-only             Report placeholder integration secrets and exit non-zero if any remain
  --skip-salt              Skip Salt API rotation/checks
  --skip-wazuh             Skip Wazuh API rotation/checks
  --salt-password VALUE    Use a specific Salt API password instead of generating one
  --wazuh-password VALUE   Use a specific Wazuh API password instead of generating one
  --help                   Show this message

Notes:
  Rotation mode updates protected service-side credentials and therefore must run as root
  or with passwordless sudo available.
EOF
}

log_step() {
  printf '\n[rotate-itms-api-secrets] %s\n' "$*"
}

fail() {
  echo "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

wait_for_local_tcp_port() {
  local port="$1"
  local attempt

  for attempt in $(seq 1 30); do
    if ss -ltn "( sport = :${port} )" 2>/dev/null | grep -q ":${port} "; then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_salt_api_login() {
  local password="$1"
  local attempt
  local response_file
  local http_code

  response_file="$(mktemp)"

  if ! wait_for_local_tcp_port "$SALT_API_PORT"; then
    rm -f "$response_file"
    echo "Salt API did not start listening on port ${SALT_API_PORT} after restart." >&2
    return 1
  fi

  for attempt in $(seq 1 20); do
    http_code="$(curl -s -o "$response_file" -w '%{http_code}' -X POST "http://127.0.0.1:${SALT_API_PORT}/login" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"${SALT_API_USER}\",\"password\":\"${password}\",\"eauth\":\"file\"}" 2>/dev/null || true)"
    if [[ "$http_code" == "200" ]]; then
      rm -f "$response_file"
      return 0
    fi
    sleep 1
  done

  echo "Salt API login probe did not succeed after restart. Last response code: ${http_code:-none}" >&2
  if [[ -s "$response_file" ]]; then
    cat "$response_file" >&2
  fi
  rm -f "$response_file"
  return 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check-only)
        CHECK_ONLY=1
        shift
        ;;
      --skip-salt)
        ROTATE_SALT=0
        shift
        ;;
      --skip-wazuh)
        ROTATE_WAZUH=0
        shift
        ;;
      --salt-password)
        SALT_API_PASSWORD="${2:-}"
        shift 2
        ;;
      --wazuh-password)
        WAZUH_API_PASSWORD="${2:-}"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done
}

env_value() {
  local key="$1"
  if [[ -f "$BACKEND_SECRETS_FILE" ]]; then
    grep -E "^${key}=" "$BACKEND_SECRETS_FILE" | tail -n 1 | cut -d '=' -f 2-
    return 0
  fi
  [[ -f "$BACKEND_ENV_FILE" ]] || return 0
  grep -E "^${key}=" "$BACKEND_ENV_FILE" | tail -n 1 | cut -d '=' -f 2-
}

is_placeholder_secret() {
  local value="$1"
  [[ "$value" == "ChangeMe-Salt-API!" || "$value" == "ChangeMe-Wazuh-API-2026!" ]]
}

generate_secret() {
  python3 - <<'PY'
import secrets

print(secrets.token_hex(24))
PY
}

generate_wazuh_secret() {
  python3 - <<'PY'
import secrets
import string

uppercase = secrets.choice(string.ascii_uppercase)
lowercase = secrets.choice(string.ascii_lowercase)
digit = secrets.choice(string.digits)
special = secrets.choice('!@#%^*_+=-')
rest_alphabet = string.ascii_letters + string.digits + '!@#%^*_+=-'
rest = ''.join(secrets.choice(rest_alphabet) for _ in range(20))
print(uppercase + lowercase + digit + special + rest)
PY
}

wazuh_password_meets_policy() {
  local value="$1"
  [[ ${#value} -ge 12 ]] || return 1
  [[ "$value" == *[[:upper:]]* ]] || return 1
  [[ "$value" == *[[:lower:]]* ]] || return 1
  [[ "$value" == *[[:digit:]]* ]] || return 1
  [[ "$value" == *['!'@'#''%''^''*''_''+''=''-']* ]] || return 1
  return 0
}

salt_auth_file_password() {
  python3 - <<'PY'
from pathlib import Path

path = Path('/etc/salt/itms-api-users.conf')
text = path.read_text().strip()
if ':' not in text:
    print('')
else:
    print(text.split(':', 1)[1])
PY
}

ensure_secret_value() {
  local current_value="$1"
  if [[ -n "$current_value" ]] && ! is_placeholder_secret "$current_value"; then
    printf '%s\n' "$current_value"
    return 0
  fi
  generate_secret
}

ensure_wazuh_secret_value() {
  local current_value="$1"
  if [[ -n "$current_value" ]] && ! is_placeholder_secret "$current_value"; then
    wazuh_password_meets_policy "$current_value" || fail "Provided WAZUH_API_PASSWORD does not meet the expected complexity policy"
    printf '%s\n' "$current_value"
    return 0
  fi
  generate_wazuh_secret
}

run_as_root() {
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    "$@"
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo -n "$@"
    return 0
  fi
  fail "This operation requires root or passwordless sudo."
}

fix_salt_auth_file_permissions() {
  if run_as_root getent group salt >/dev/null 2>&1; then
    run_as_root chgrp salt /etc/salt/itms-api-users.conf
    run_as_root chmod 640 /etc/salt/itms-api-users.conf
    return 0
  fi

  run_as_root chown root:root /etc/salt/itms-api-users.conf
  run_as_root chmod 600 /etc/salt/itms-api-users.conf
}

update_env_value() {
  local key="$1"
  local value="$2"
  python3 - "$BACKEND_SECRETS_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
rendered = f"{key}={value}"

for index, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[index] = rendered
        break
else:
    lines.append(rendered)

path.write_text("\n".join(lines).rstrip() + "\n")
PY
}

clear_public_env_value() {
  local key="$1"
  python3 - "$BACKEND_ENV_FILE" "$key" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
rendered = f"{key}="

for index, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[index] = rendered
        break
else:
    lines.append(rendered)

path.write_text("\n".join(lines).rstrip() + "\n")
PY
}

check_only() {
  local failed=0
  local salt_value wazuh_value

  salt_value="$(env_value SALT_API_PASSWORD)"
  wazuh_value="$(env_value WAZUH_API_PASSWORD)"

  if [[ "$ROTATE_SALT" -eq 1 ]]; then
    if [[ -z "$salt_value" ]]; then
      echo "SALT_API_PASSWORD is empty in $BACKEND_SECRETS_FILE" >&2
      failed=1
    elif is_placeholder_secret "$salt_value"; then
      echo "SALT_API_PASSWORD is still using the placeholder default in $BACKEND_SECRETS_FILE" >&2
      failed=1
    else
      echo "SALT_API_PASSWORD is set to a non-placeholder value"
    fi
  fi

  if [[ "$ROTATE_WAZUH" -eq 1 ]]; then
    if [[ -z "$wazuh_value" ]]; then
      echo "WAZUH_API_PASSWORD is empty in $BACKEND_SECRETS_FILE" >&2
      failed=1
    elif is_placeholder_secret "$wazuh_value"; then
      echo "WAZUH_API_PASSWORD is still using the placeholder default in $BACKEND_SECRETS_FILE" >&2
      failed=1
    else
      echo "WAZUH_API_PASSWORD is set to a non-placeholder value"
    fi
  fi

  return "$failed"
}

rotate_salt_secret() {
  local password="$1"
  local file_password

  [[ -f /etc/salt/itms-api-users.conf ]] || fail "Salt auth file not found: /etc/salt/itms-api-users.conf"
  require_command python3
  require_command curl
  require_command ss

  log_step 'Rotating Salt API user password'
  run_as_root python3 - "$SALT_API_USER" "$password" <<'PY'
from pathlib import Path
import sys

path = Path('/etc/salt/itms-api-users.conf')
user = sys.argv[1]
password = sys.argv[2]
path.write_text(f"{user}:{password}\n")
PY
  run_as_root chown root:root /etc/salt/itms-api-users.conf
  run_as_root chmod 600 /etc/salt/itms-api-users.conf
  run_as_root python3 - "$SALT_API_USER" "$password" <<'PY'
import subprocess
import sys

subprocess.run(['chpasswd'], input=f"{sys.argv[1]}:{sys.argv[2]}\n".encode(), check=True)
PY
  fix_salt_auth_file_permissions
  run_as_root systemctl restart salt-master
  run_as_root systemctl restart salt-api

  update_env_value SALT_API_PASSWORD "$password"
  clear_public_env_value SALT_API_PASSWORD

  if wait_for_salt_api_login "$password"; then
    return 0
  fi

  file_password="$(salt_auth_file_password)"
  if [[ -n "$file_password" && "$file_password" != "$password" ]]; then
    echo "Salt auth file password differs from the requested password. Retrying validation with the current file value." >&2
    update_env_value SALT_API_PASSWORD "$file_password"
    clear_public_env_value SALT_API_PASSWORD
    wait_for_salt_api_login "$file_password"
    return 0
  fi

  return 1
}

rotate_wazuh_secret() {
  local password="$1"

  require_command python3

  if [[ -f /var/ossec/api/configuration/auth/internal_users.yml ]]; then
    log_step 'Rotating Wazuh API password in internal_users.yml'
    run_as_root python3 - "$WAZUH_API_USERNAME" "$password" <<'PY'
from pathlib import Path
import sys

path = Path('/var/ossec/api/configuration/auth/internal_users.yml')
username = sys.argv[1]
password = sys.argv[2]
text = path.read_text() if path.exists() else ''
lines = text.splitlines()
rendered = f"{username}: {password}"

for index, line in enumerate(lines):
    if line.startswith(f"{username}:"):
        lines[index] = rendered
        break
else:
    lines.append(rendered)

path.write_text("\n".join(lines).rstrip() + "\n")
PY
    run_as_root systemctl restart wazuh-manager
    update_env_value WAZUH_API_PASSWORD "$password"
    clear_public_env_value WAZUH_API_PASSWORD
    return 0
  fi

  if [[ -f /var/ossec/api/configuration/security/rbac.db && -x /var/ossec/framework/python/bin/python3 ]]; then
    log_step 'Rotating Wazuh API password through RBAC database'
    run_as_root /var/ossec/framework/python/bin/python3 - "$password" <<'PY'
import asyncio
import sys

from wazuh.security import update_user
from wazuh.core.cluster import utils as cluster_utils

async def main() -> None:
    response = await cluster_utils.forward_function(
        update_user,
        f_kwargs={'user_id': '1', 'password': sys.argv[1]},
        request_type='local_master',
    )
    if isinstance(response, Exception):
        raise response

asyncio.run(main())
PY
    run_as_root systemctl restart wazuh-manager
    update_env_value WAZUH_API_PASSWORD "$password"
    clear_public_env_value WAZUH_API_PASSWORD
    return 0
  fi

  fail 'Unable to locate a writable Wazuh API credential store on this host.'
}

main() {
  parse_args "$@"

  [[ -f "$BACKEND_ENV_FILE" ]] || fail "Backend env file not found: $BACKEND_ENV_FILE"
  require_command python3

  if [[ "$CHECK_ONLY" -eq 1 ]]; then
    check_only
    exit $?
  fi

  if [[ "$ROTATE_SALT" -eq 1 ]]; then
    SALT_API_PASSWORD="$(ensure_secret_value "$SALT_API_PASSWORD")"
    rotate_salt_secret "$SALT_API_PASSWORD"
  fi

  if [[ "$ROTATE_WAZUH" -eq 1 ]]; then
    WAZUH_API_PASSWORD="$(ensure_wazuh_secret_value "$WAZUH_API_PASSWORD")"
    rotate_wazuh_secret "$WAZUH_API_PASSWORD"
  fi

  log_step 'Integration API secret rotation completed'
}

main "$@"