#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this script with sudo or as root."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$REPO_ROOT/backend/.env}"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"
SALT_API_PORT="${SALT_API_PORT:-8000}"
SALT_API_EAUTH="${SALT_API_EAUTH:-file}"
SALT_API_USER="${SALT_API_USER:-itms-salt}"
SALT_API_PASSWORD="${SALT_API_PASSWORD:-}"
SALT_API_AUTH_FILE="${SALT_API_AUTH_FILE:-/etc/salt/itms-api-users.conf}"
SALT_REPO_FILE="/etc/apt/sources.list.d/salt.sources"
SALT_REPO_KEYRING="/etc/apt/keyrings/salt-archive-keyring.pgp"
SALT_REPO_PIN_FILE="/etc/apt/preferences.d/salt-pin-1001"
SALT_VERSION_PIN="${SALT_VERSION_PIN:-3006.*}"

generate_secure_secret() {
  python3 - <<'PY'
import secrets

print(secrets.token_urlsafe(32))
PY
}

ensure_runtime_secret() {
  local variable_name="$1"
  local placeholder_value="$2"
  local current_value="${!variable_name:-}"

  if [[ -n "$current_value" && "$current_value" != "$placeholder_value" ]]; then
    return 0
  fi

  printf -v "$variable_name" '%s' "$(generate_secure_secret)"
  echo "Generated a random secret for ${variable_name}." >&2
}

pip_install_compat() {
  if python3 -m pip install --help 2>/dev/null | grep -q -- '--break-system-packages'; then
    python3 -m pip install --break-system-packages "$@"
    return 0
  fi

  python3 -m pip install "$@"
}

ensure_salt_api_user() {
  if ! id -u "$SALT_API_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$SALT_API_USER"
  fi

  usermod --shell /bin/bash "$SALT_API_USER"
  echo "${SALT_API_USER}:${SALT_API_PASSWORD}" | chpasswd
  usermod --unlock "$SALT_API_USER" || true
  chage -E -1 -I -1 -m 0 -M 99999 "$SALT_API_USER" || true
}

fix_salt_config_permissions() {
  if getent group salt >/dev/null 2>&1; then
    chgrp salt /etc/salt/itms-api-users.conf /etc/salt/master.d/itms-api.conf 2>/dev/null || true
    chmod 640 /etc/salt/itms-api-users.conf 2>/dev/null || true
    chmod 644 /etc/salt/master.d/itms-api.conf 2>/dev/null || true

    if [[ -f /etc/salt/minion.d/itms.conf ]]; then
      chgrp salt /etc/salt/minion.d/itms.conf 2>/dev/null || true
      chmod 640 /etc/salt/minion.d/itms.conf 2>/dev/null || true
    fi
  fi
}

write_salt_auth_config() {
  install -m 600 /dev/null "$SALT_API_AUTH_FILE"
  printf '%s:%s\n' "$SALT_API_USER" "$SALT_API_PASSWORD" >"$SALT_API_AUTH_FILE"

  mkdir -p /etc/salt/master.d
  cat >/etc/salt/master.d/itms-api.conf <<EOF
rest_cherrypy:
  port: ${SALT_API_PORT}
  host: 0.0.0.0
  disable_ssl: true

netapi_enable_clients:
  - local
  - wheel

external_auth:
  file:
    ^filename: ${SALT_API_AUTH_FILE}
    ${SALT_API_USER}:
      - '@jobs'
      - test.ping
      - cmd.run_all
      - state.apply
      - key.accept
EOF
}

configure_salt_repo() {
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://packages.broadcom.com/artifactory/api/security/keypair/SaltProjectKey/public \
    -o "$SALT_REPO_KEYRING"
  curl -fsSL https://github.com/saltstack/salt-install-guide/releases/latest/download/salt.sources \
    -o "$SALT_REPO_FILE"
  cat >"$SALT_REPO_PIN_FILE" <<EOF
Package: salt-*
Pin: version ${SALT_VERSION_PIN}
Pin-Priority: 1001

Package: python3-saltpython-pygit2
Pin: version ${SALT_VERSION_PIN}
Pin-Priority: 1001
EOF
}

wait_for_salt_api_login() {
  local probe_output=""
  local attempt

  for attempt in $(seq 1 15); do
    probe_output=$(curl -i -sS -X POST "http://127.0.0.1:${SALT_API_PORT}/login" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"${SALT_API_USER}\",\"password\":\"${SALT_API_PASSWORD}\",\"eauth\":\"${SALT_API_EAUTH}\"}" 2>/dev/null || true)
    if printf '%s\n' "$probe_output" | grep -q "HTTP/1.1 200"; then
      printf '%s\n' "$probe_output" | sed -n '1,20p'
      return 0
    fi
    sleep 1
  done

  printf '%s\n' "$probe_output" | sed -n '1,20p'
  return 1
}

cleanup_rogue_salt_api() {
  local pids
  pids=$(ss -ltnp "( sport = :${SALT_API_PORT} )" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    local owner
    owner=$(ps -o user= -p "$pid" 2>/dev/null | awk '{print $1}')
    if [[ "$owner" != "root" && "$owner" != "salt" ]]; then
      echo "Stopping rogue salt-api listener pid=${pid} owner=${owner}" >&2
      kill "$pid" || true
    fi
  done <<< "$pids"

  sleep 1
}

ensure_python_distribution() {
  local module_name="$1"
  local package_name="$2"

  if python3 - <<PY >/dev/null 2>&1
import importlib.metadata
import sys

try:
    importlib.metadata.version(${module_name@Q})
except importlib.metadata.PackageNotFoundError:
    sys.exit(1)
PY
  then
    return 0
  fi

  pip_install_compat "$package_name"
}

install_repo_prerequisites() {
  apt-get update
  apt-get install -y curl gnupg ca-certificates lsb-release software-properties-common
}

export DEBIAN_FRONTEND=noninteractive
ensure_runtime_secret "SALT_API_PASSWORD" "ChangeMe-Salt-API!"
install_repo_prerequisites
configure_salt_repo
apt-get update
apt-get install -y python3-pip salt-common salt-master salt-api salt-minion python3-cherrypy3 apache2-utils

ensure_python_distribution "contextvars" "contextvars"

if ! python3 - <<'PY' >/dev/null 2>&1
import cherrypy
PY
then
  pip_install_compat cherrypy
fi

ensure_salt_api_user

cleanup_rogue_salt_api

write_salt_auth_config
fix_salt_config_permissions

systemctl enable --now salt-master
systemctl restart salt-master
systemctl restart salt-api

if [[ -f "$BACKEND_ENV_FILE" ]]; then
  SALT_API_PASSWORD="$SALT_API_PASSWORD" \
    python3 - "$BACKEND_ENV_FILE" "$BACKEND_SECRETS_FILE" "$SALT_API_PORT" "$SALT_API_USER" "$SALT_API_EAUTH" <<'PY'
import pathlib
import os
import sys

env_path = pathlib.Path(sys.argv[1])
secret_path = pathlib.Path(sys.argv[2])
salt_api_port = sys.argv[3]
salt_api_user = sys.argv[4]
salt_api_eauth = sys.argv[5]
salt_api_password = os.environ["SALT_API_PASSWORD"]
text = env_path.read_text() if env_path.exists() else ""
secret_text = secret_path.read_text() if secret_path.exists() else ""
public_updates = {
    "SALT_API_BASE_URL": f"http://127.0.0.1:{salt_api_port}",
    "SALT_API_TOKEN": "",
    "SALT_API_USERNAME": salt_api_user,
  "SALT_API_PASSWORD": "",
    "SALT_API_EAUTH": salt_api_eauth,
}
secret_updates = {
  "SALT_API_PASSWORD": salt_api_password,
}

lines = text.splitlines()
present = {line.split('=', 1)[0]: idx for idx, line in enumerate(lines) if '=' in line and not line.lstrip().startswith('#')}
for key, value in public_updates.items():
    rendered = f"{key}={value}"
    if key in present:
        lines[present[key]] = rendered
    else:
        lines.append(rendered)
env_path.write_text("\n".join(lines).rstrip() + "\n")

secret_lines = secret_text.splitlines()
secret_present = {line.split('=', 1)[0]: idx for idx, line in enumerate(secret_lines) if '=' in line and not line.lstrip().startswith('#')}
for key, value in secret_updates.items():
  rendered = f"{key}={value}"
  if key in secret_present:
    secret_lines[secret_present[key]] = rendered
  else:
    secret_lines.append(rendered)
secret_path.write_text("\n".join(secret_lines).rstrip() + "\n")
PY
fi

echo
echo "salt-api repair complete"
echo "status:"
systemctl --no-pager --full status salt-api | sed -n '1,40p'
echo
echo "login probe:"
if ! wait_for_salt_api_login; then
  echo "salt-api login probe did not return HTTP 200" >&2
  exit 1
fi