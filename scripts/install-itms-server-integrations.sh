#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this script with sudo or as root."
  exit 1
fi

ITMS_ROOT_DEFAULT="/home/itteam/itms"
ITMS_ROOT="${ITMS_ROOT:-$ITMS_ROOT_DEFAULT}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ITMS_ROOT/backend/.env}"
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
WAZUH_API_PORT="${WAZUH_API_PORT:-55000}"
WAZUH_API_USERNAME="${WAZUH_API_USERNAME:-wazuh}"
WAZUH_API_PASSWORD="${WAZUH_API_PASSWORD:-}"
INSTALL_WAZUH_MANAGER="${INSTALL_WAZUH_MANAGER:-true}"
SERVER_HOST="${SERVER_HOST:-$(hostname -I | awk '{print $1}')}"

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

  echo "Installing Python distribution metadata for ${module_name}..."
  pip_install_compat "$package_name"
}

package_exists() {
  apt-cache show "$1" >/dev/null 2>&1
}

append_if_available() {
  local package_name="$1"
  if package_exists "$package_name"; then
    INSTALL_PACKAGES+=("$package_name")
    return 0
  fi
  return 1
}

install_repo_prerequisites() {
  apt-get update
  apt-get install -y curl gnupg ca-certificates lsb-release software-properties-common
}

echo "Installing Salt API, OpenSCAP, and optional Wazuh manager on Ubuntu..."
export DEBIAN_FRONTEND=noninteractive
ensure_runtime_secret "SALT_API_PASSWORD" "ChangeMe-Salt-API!"
ensure_runtime_secret "WAZUH_API_PASSWORD" "ChangeMe-Wazuh-API-2026!"
install_repo_prerequisites
configure_salt_repo
apt-get update

INSTALL_PACKAGES=(
  curl
  gnupg
  lsb-release
  ca-certificates
  jq
  software-properties-common
  python3-pip
  salt-common
  salt-master
  salt-api
  salt-minion
  python3-cherrypy3
  apache2-utils
)

if ! append_if_available "openscap-scanner"; then
  echo "Warning: openscap-scanner is not available from current apt sources. Skipping OpenSCAP scanner package." >&2
fi

if ! append_if_available "scap-security-guide"; then
  if ! append_if_available "ssg-base"; then
    echo "Warning: no SCAP content package was found (tried scap-security-guide and ssg-base)." >&2
  fi
fi

apt-get install -y "${INSTALL_PACKAGES[@]}"

ensure_python_distribution "contextvars" "contextvars"

if ! python3 - <<'PY' >/dev/null 2>&1
import cherrypy
PY
then
  pip_install_compat cherrypy
fi

ensure_salt_api_user

write_salt_auth_config
fix_salt_config_permissions

systemctl enable --now salt-master
systemctl restart salt-master
if ! systemctl enable --now salt-api; then
  echo "salt-api failed to start on the first attempt; retrying after dependency repair..." >&2
  ensure_python_distribution "contextvars" "contextvars"
  systemctl restart salt-master
  systemctl restart salt-api
fi

if [[ "$INSTALL_WAZUH_MANAGER" == "true" ]]; then
  curl -fsSL https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor >/usr/share/keyrings/wazuh.gpg
  cat >/etc/apt/sources.list.d/wazuh.list <<EOF
deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main
EOF
  apt-get update
  apt-get install -y wazuh-manager
  systemctl enable --now wazuh-manager

  if [[ -f /var/ossec/api/configuration/auth/internal_users.yml ]]; then
    if ! grep -q "^${WAZUH_API_USERNAME}:" /var/ossec/api/configuration/auth/internal_users.yml; then
      cat >>/var/ossec/api/configuration/auth/internal_users.yml <<EOF
${WAZUH_API_USERNAME}: ${WAZUH_API_PASSWORD}
EOF
    else
      sed -i "s#^${WAZUH_API_USERNAME}:.*#${WAZUH_API_USERNAME}: ${WAZUH_API_PASSWORD}#" /var/ossec/api/configuration/auth/internal_users.yml
    fi
    systemctl restart wazuh-manager
  elif [[ -f /var/ossec/api/configuration/security/rbac.db ]]; then
    /var/ossec/framework/python/bin/python3 - <<EOF
import asyncio
from wazuh.security import update_user
from wazuh.core.cluster import utils as cluster_utils

async def main():
    response = await cluster_utils.forward_function(
        update_user,
        f_kwargs={'user_id': '1', 'password': ${WAZUH_API_PASSWORD@Q}},
        request_type='local_master',
    )
    if isinstance(response, Exception):
        raise response
    print(response)

asyncio.run(main())
EOF
  fi
fi

if [[ -f "$BACKEND_ENV_FILE" ]]; then
  python3 - "$BACKEND_ENV_FILE" "$BACKEND_SECRETS_FILE" "$SALT_API_PORT" "$SALT_API_USER" "$SALT_API_PASSWORD" "$SALT_API_EAUTH" "$WAZUH_API_PORT" "$WAZUH_API_USERNAME" "$WAZUH_API_PASSWORD" <<'PY'
import pathlib
import sys

env_path = pathlib.Path(sys.argv[1])
secret_path = pathlib.Path(sys.argv[2])
salt_api_port = sys.argv[3]
salt_api_user = sys.argv[4]
salt_api_password = sys.argv[5]
salt_api_eauth = sys.argv[6]
wazuh_api_port = sys.argv[7]
wazuh_api_user = sys.argv[8]
wazuh_api_password = sys.argv[9]
text = env_path.read_text() if env_path.exists() else ""
secret_text = secret_path.read_text() if secret_path.exists() else ""
public_updates = {
    "SALT_API_BASE_URL": f"http://127.0.0.1:{salt_api_port}",
    "SALT_API_TOKEN": "",
    "SALT_API_USERNAME": salt_api_user,
    "SALT_API_PASSWORD": "",
    "SALT_API_EAUTH": salt_api_eauth,
    "WAZUH_API_BASE_URL": f"https://127.0.0.1:{wazuh_api_port}",
    "WAZUH_API_USERNAME": wazuh_api_user,
    "WAZUH_API_PASSWORD": "",
    "WAZUH_API_INSECURE_SKIP_VERIFY": "true",
}
secret_updates = {
    "SALT_API_PASSWORD": salt_api_password,
    "WAZUH_API_PASSWORD": wazuh_api_password,
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

cat <<EOF

Server integrations installed.

Salt API:
  URL: http://${SERVER_HOST}:${SALT_API_PORT}
  EAuth: ${SALT_API_EAUTH}
  User: ${SALT_API_USER}

OpenSCAP:
  Binary: $(command -v oscap || echo not-found)

Wazuh API:
  URL: https://${SERVER_HOST}:${WAZUH_API_PORT}
  User: ${WAZUH_API_USERNAME}

Next steps:
  1. Review ${BACKEND_ENV_FILE} and ${BACKEND_SECRETS_FILE} for the generated integration values.
  2. Restart the ITMS backend so it picks up the new environment variables.
  3. Copy your Salt states into the Salt fileserver and test an install from the Users page.
EOF