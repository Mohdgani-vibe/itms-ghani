#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  cat <<'EOF'
Usage:
  enroll-openssh-node.sh <teleport-proxy-host> <ca-pin> <token> <environment> [install-script-sha256]

This script enrolls a Linux server into Teleport while keeping OpenSSH on the host.
It installs the Teleport agent, configures labels for RBAC, and leaves salt-minion untouched.
EOF
  exit 1
fi

PROXY_HOST="$1"
CA_PIN="$2"
TOKEN="$3"
ENVIRONMENT="$4"
INSTALL_SCRIPT_SHA256="${5:-${TELEPORT_INSTALL_SHA256:-}}"
INSTALL_SCRIPT_URL="https://${PROXY_HOST}/scripts/install.sh"
INSTALLER_TMP="$(mktemp)"
TELEPORT_CONFIG_PATH="/etc/teleport/teleport.yaml"

trap 'rm -f "$INSTALLER_TMP"' EXIT

write_teleport_config() {
  local include_join_material="$1"
  local config_tmp

  config_tmp="$(mktemp)"
  chmod 0600 "$config_tmp"

  cat > "$config_tmp" <<EOF
version: v3
teleport:
  nodename: $(hostname -f)
  data_dir: /var/lib/teleport
EOF

  if [[ "$include_join_material" == "1" ]]; then
    cat >> "$config_tmp" <<EOF
  auth_token: ${TOKEN}
  proxy_server: ${PROXY_HOST}:443
  ca_pin: ${CA_PIN}
EOF
  else
    cat >> "$config_tmp" <<EOF
  proxy_server: ${PROXY_HOST}:443
EOF
  fi

  cat >> "$config_tmp" <<EOF

auth_service:
  enabled: false

proxy_service:
  enabled: false

ssh_service:
  enabled: true
  labels:
    environment: ${ENVIRONMENT}
    team: platform
    os_family: linux
  commands:
    - name: hostname
      command: [hostname]
      period: 1m0s
EOF

  install -m 0600 "$config_tmp" "$TELEPORT_CONFIG_PATH"
  rm -f "$config_tmp"
}

command -v curl >/dev/null 2>&1 || {
  echo "Missing required command: curl" >&2
  exit 1
}
command -v sha256sum >/dev/null 2>&1 || {
  echo "Missing required command: sha256sum" >&2
  exit 1
}

if [[ -z "$INSTALL_SCRIPT_SHA256" ]]; then
  echo "A trusted Teleport installer SHA-256 is required. Pass it as argument 5 or TELEPORT_INSTALL_SHA256." >&2
  exit 1
fi

curl --proto '=https' --tlsv1.2 --fail --show-error --silent --location "$INSTALL_SCRIPT_URL" -o "$INSTALLER_TMP"
echo "${INSTALL_SCRIPT_SHA256}  ${INSTALLER_TMP}" | sha256sum -c - >/dev/null
bash "$INSTALLER_TMP"

install -d -m 0755 /etc/teleport
write_teleport_config 1

systemctl enable teleport
systemctl restart teleport
systemctl is-active --quiet teleport

# After the first successful join, Teleport uses its issued identity from data_dir.
# Strip the one-time join material from disk so the token and CA pin do not persist.
write_teleport_config 0
