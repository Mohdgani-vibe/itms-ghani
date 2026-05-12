#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"
RUNTIME_DIR="$STACK_ROOT/runtime"
RENDER_SALT_ONLY=0
VALID_SALT_APP_ENVIRONMENTS_REGEX='^(staging|monitoring|production)$'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --salt-only)
      RENDER_SALT_ONLY=1
      ;;
    --help|-h)
      cat <<'EOF'
Usage:
  render-configs.sh [--salt-only]

Options:
  --salt-only   Render only runtime/rest_cherrypy.conf for the Salt sync workflow
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

mkdir -p "$RUNTIME_DIR"

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[&|]/\\&/g'
}

render_template() {
  local template_path="$1"
  local output_path="$2"
  shift 2
  local sed_args=()
  local pair key value escaped_value

  for pair in "$@"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    escaped_value="$(escape_sed_replacement "$value")"
    sed_args+=("-e" "s|__${key}__|${escaped_value}|g")
  done

  sed "${sed_args[@]}" "$template_path" > "$output_path"
}

render_salt_runtime() {
  render_template \
    "$STACK_ROOT/salt/master.d/rest_cherrypy.conf.tmpl" \
    "$RUNTIME_DIR/rest_cherrypy.conf" \
    "SALT_API_BIND_HOST=${SALT_API_BIND_HOST}" \
    "SALT_API_BIND_PORT=${SALT_API_BIND_PORT}" \
    "SALT_API_TLS_CERT_PATH=${SALT_API_TLS_CERT_PATH}" \
    "SALT_API_TLS_KEY_PATH=${SALT_API_TLS_KEY_PATH}"
}

validate_salt_app_environment() {
  if [[ -z "${SALT_APP_ENVIRONMENT:-}" ]] || [[ ! "$SALT_APP_ENVIRONMENT" =~ $VALID_SALT_APP_ENVIRONMENTS_REGEX ]]; then
    echo "SALT_APP_ENVIRONMENT must be one of: staging, monitoring, production" >&2
    exit 1
  fi
}

if [[ "$RENDER_SALT_ONLY" == "1" ]]; then
  render_salt_runtime
  echo "Rendered Salt runtime config into $RUNTIME_DIR"
  exit 0
fi

validate_salt_app_environment

render_template \
  "$STACK_ROOT/teleport/teleport.yaml.tmpl" \
  "$RUNTIME_DIR/teleport.yaml" \
  "TELEPORT_AUTH_TOKEN=${TELEPORT_AUTH_TOKEN}" \
  "POSTGRES_USER=${POSTGRES_USER}" \
  "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  "POSTGRES_DB=${POSTGRES_DB}" \
  "SESSION_STORAGE_URI=${SESSION_STORAGE_URI}" \
  "SESSION_STORAGE_REGION=${SESSION_STORAGE_REGION}" \
  "CLUSTER_NAME=${CLUSTER_NAME}" \
  "TELEPORT_LICENSE_PATH=${TELEPORT_LICENSE_PATH}" \
  "WEB_PUBLIC_ADDR=${WEB_PUBLIC_ADDR}" \
  "SSH_PUBLIC_ADDR=${SSH_PUBLIC_ADDR}" \
  "TUNNEL_PUBLIC_ADDR=${TUNNEL_PUBLIC_ADDR}" \
  "SALT_API_URI=${SALT_API_URI}" \
  "SALT_APP_PUBLIC_ADDR=${SALT_APP_PUBLIC_ADDR}" \
  "SALT_API_SKIP_VERIFY=${SALT_API_SKIP_VERIFY}" \
  "SALT_APP_ENVIRONMENT=${SALT_APP_ENVIRONMENT}"

render_template \
  "$STACK_ROOT/nginx/nginx.conf.tmpl" \
  "$RUNTIME_DIR/nginx.conf" \
  "SSH_LISTEN_PORT=${SSH_LISTEN_PORT}" \
  "TUNNEL_LISTEN_PORT=${TUNNEL_LISTEN_PORT}" \
  "WEB_LISTEN_PORT=${WEB_LISTEN_PORT}" \
  "WEB_PUBLIC_ADDR=${WEB_PUBLIC_ADDR}"

render_template \
  "$STACK_ROOT/monitoring/rsyslog-teleport.conf.tmpl" \
  "$RUNTIME_DIR/rsyslog-teleport.conf" \
  "SYSLOG_TARGET=${SYSLOG_TARGET}" \
  "SYSLOG_PORT=${SYSLOG_PORT}"

render_salt_runtime

echo "Rendered runtime configs into $RUNTIME_DIR"
