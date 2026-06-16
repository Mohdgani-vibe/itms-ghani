#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Mohdgani-vibe/zerodha-itms.git}"
CLONE_DIR="${CLONE_DIR:-/home/itms/itms}"
SERVER_IP="${SERVER_IP:-}"
SERVER_NAME="${SERVER_NAME:-$SERVER_IP}"
DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@zerodha.com}"
DEFAULT_ADMIN_NAME="${DEFAULT_ADMIN_NAME:-ITMS Admin}"
DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-ChangeMe-Admin#2026}"
JWT_SECRET="${JWT_SECRET:-ChangeMe-JWT#2026-Replace-This-Immediately}"
SALT_API_PASSWORD="${SALT_API_PASSWORD:-ChangeMe-Salt#2026}"
WAZUH_API_PASSWORD="${WAZUH_API_PASSWORD:-ChangeMe-Wazuh#2026}"
WAZUH_AGENT_ID="${WAZUH_AGENT_ID:-000}"
INSTALL_CLAMAV="${INSTALL_CLAMAV:-1}"
RUN_SECURITY_VERIFY="${RUN_SECURITY_VERIFY:-1}"

usage() {
  cat <<'EOF'
Usage:
  bash docs/install-itms-all-in-one.sh

Optional environment overrides:
  REPO_URL=https://github.com/Mohdgani-vibe/zerodha-itms.git
  CLONE_DIR=/home/itms/itms
  SERVER_IP=10.10.21.49
  SERVER_NAME=itms.example.com
  DEFAULT_ADMIN_EMAIL=admin@zerodha.com
  DEFAULT_ADMIN_NAME='ITMS Admin'
  DEFAULT_ADMIN_PASSWORD='StrongPasswordHere'
  JWT_SECRET='LongRandomJwtSecretHere'
  SALT_API_PASSWORD='StrongSaltPasswordHere'
  WAZUH_API_PASSWORD='StrongWazuhPasswordHere'
  WAZUH_AGENT_ID=000
  INSTALL_CLAMAV=1
  RUN_SECURITY_VERIFY=1

Example:
  SERVER_IP=10.10.21.49 \
  DEFAULT_ADMIN_PASSWORD='VeryStrong#2026' \
  JWT_SECRET='LongRandomSecretValue' \
  SALT_API_PASSWORD='SaltPassword#2026' \
  WAZUH_API_PASSWORD='WazuhPassword#2026' \
  bash docs/install-itms-all-in-one.sh
EOF
}

log() {
  printf '[install-itms-all-in-one] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

detect_server_ip() {
  local detected_ip

  if command -v hostname >/dev/null 2>&1; then
    detected_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [[ -z "$detected_ip" ]] && command -v ip >/dev/null 2>&1; then
    detected_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
  fi

  printf '%s' "$detected_ip"
}

write_file_if_changed() {
  local target="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  cat >"$tmp_file"

  if [[ -f "$target" ]] && cmp -s "$tmp_file" "$target"; then
    rm -f "$tmp_file"
    return 0
  fi

  mkdir -p "$(dirname "$target")"
  mv "$tmp_file" "$target"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command git
require_command bash
require_command sudo

if [[ -z "$SERVER_IP" ]]; then
  SERVER_IP="$(detect_server_ip)"
fi

if [[ -z "$SERVER_IP" ]]; then
  echo "Unable to detect server IP automatically. Re-run with SERVER_IP=<your-ip>." >&2
  exit 1
fi

if [[ -z "$SERVER_NAME" ]]; then
  SERVER_NAME="$SERVER_IP"
fi

if [[ -d "$CLONE_DIR/.git" ]]; then
  log "Repository already exists at $CLONE_DIR; refreshing it."
  git -C "$CLONE_DIR" fetch --all --tags
  git -C "$CLONE_DIR" pull --ff-only
else
  log "Cloning repository into $CLONE_DIR"
  mkdir -p "$(dirname "$CLONE_DIR")"
  git clone "$REPO_URL" "$CLONE_DIR"
fi

cd "$CLONE_DIR"

log "Writing backend environment files"
write_file_if_changed "$CLONE_DIR/backend/.env" <<EOF
BACKEND_ADDR=:3001
PUBLIC_SERVER_URL=http://${SERVER_IP}
FRONTEND_ORIGIN=http://${SERVER_IP}
DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL}
DEFAULT_ADMIN_NAME=${DEFAULT_ADMIN_NAME}
SALT_MASTER_HOST=${SERVER_IP}
WAZUH_MANAGER_HOST=${SERVER_IP}
EOF

write_file_if_changed "$CLONE_DIR/backend/.env.secrets" <<EOF
DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
SALT_API_PASSWORD=${SALT_API_PASSWORD}
WAZUH_API_PASSWORD=${WAZUH_API_PASSWORD}
EOF

log "Starting backend and database"
bash "$CLONE_DIR/scripts/install-docker-and-start-itms.sh" --detach

log "Deploying frontend behind nginx"
bash "$CLONE_DIR/scripts/install-itms-nginx.sh" "$SERVER_NAME"

log "Installing Salt, Wazuh, and OpenSCAP integrations"
sudo env \
  ITMS_ROOT="$CLONE_DIR" \
  SALT_API_PASSWORD="$SALT_API_PASSWORD" \
  WAZUH_API_PASSWORD="$WAZUH_API_PASSWORD" \
  bash "$CLONE_DIR/scripts/install-itms-server-integrations.sh"

log "Reloading backend configuration"
sudo docker compose -f "$CLONE_DIR/backend/docker-compose.yml" up -d --force-recreate backend

if [[ "$INSTALL_CLAMAV" == "1" ]]; then
  log "Installing ClamAV"
  sudo apt-get update
  sudo apt-get install -y clamav clamav-daemon || true
fi

log "Running API smoke test"
bash "$CLONE_DIR/scripts/smoke-test-itms-api.sh"

if [[ "$RUN_SECURITY_VERIFY" == "1" ]]; then
  log "Running security verification"
  bash "$CLONE_DIR/scripts/verify-itms-security-integrations.sh" --wazuh-agent-id "$WAZUH_AGENT_ID"
fi

cat <<EOF

Install completed.

Repository: $REPO_URL
Clone path: $CLONE_DIR
Application URL: http://${SERVER_IP}
Admin email: ${DEFAULT_ADMIN_EMAIL}
Admin password: ${DEFAULT_ADMIN_PASSWORD}

If this host already had an older ITMS database and login fails, run:
  cd ${CLONE_DIR}/backend
  docker run --rm --network backend_default -v "\$PWD":/src -w /src --env-file .env --env-file .env.secrets -e 'DATABASE_URL=postgres://postgres:postgres@postgres:5432/itms?sslmode=disable' golang:1.23 /usr/local/go/bin/go run ./cmd/sync_default_admin_password
EOF