#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_TEMPLATE="$STACK_ROOT/.env.example"
ENV_FILE="$STACK_ROOT/.env"
VALID_SALT_APP_ENVIRONMENTS_REGEX='^(staging|monitoring|production)$'

usage() {
  cat <<'EOF'
Usage:
  deploy-teleport.sh [options]

Options:
  --init-env        Create .env from .env.example when missing
  --render-only     Render runtime configs and stop
  --install-salt-config Install runtime/rest_cherrypy.conf to SALT_API_CONFIG_TARGET
  --restart-salt-api Restart SALT_API_SERVICE_NAME after Salt config install
  --check-salt-api  Check SALT_API_HEALTHCHECK_URL after Salt config install
  --bootstrap-admin Run bootstrap-teleport.sh after the stack is up
  --help            Show this message
EOF
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

pick_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose'
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    printf 'docker-compose'
    return
  fi
  echo "Neither docker compose nor docker-compose is available." >&2
  exit 1
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

validate_no_placeholders() {
  local placeholder_lines
  local salt_app_environment

  placeholder_lines="$(grep -nE '^[A-Z0-9_]+=.*(replace-|changeme)' "$ENV_FILE" || true)"
  if [[ -n "$placeholder_lines" ]]; then
    echo "Unresolved placeholder values remain in $ENV_FILE:" >&2
    echo "$placeholder_lines" >&2
    exit 1
  fi

  salt_app_environment="$(grep -E '^SALT_APP_ENVIRONMENT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  if [[ -z "$salt_app_environment" ]] || [[ ! "$salt_app_environment" =~ $VALID_SALT_APP_ENVIRONMENTS_REGEX ]]; then
    echo "SALT_APP_ENVIRONMENT must be one of: staging, monitoring, production" >&2
    exit 1
  fi
}

validate_file_exists() {
  local file_path="$1"
  local label="$2"

  if [[ ! -f "$file_path" ]]; then
    echo "$label not found: $file_path" >&2
    exit 1
  fi
}

validate_rendered_files() {
  local unresolved

  unresolved="$({ grep -R -n -E '__[A-Z0-9_]+__' "$STACK_ROOT/runtime" || true; } | sort -u)"
  if [[ -n "$unresolved" ]]; then
    echo "Unresolved template placeholders remain in rendered runtime files:" >&2
    echo "$unresolved" >&2
    exit 1
  fi
}

install_salt_config() {
  local rendered_config="$STACK_ROOT/runtime/rest_cherrypy.conf"
  local target_path="${SALT_API_CONFIG_TARGET}"
  local target_dir
  local install_cmd=(install -D -m 0640 "$rendered_config" "$target_path")

  validate_file_exists "$rendered_config" "Rendered Salt API config"
  validate_file_exists "$SALT_API_TLS_CERT_PATH" "Salt API TLS certificate"
  validate_file_exists "$SALT_API_TLS_KEY_PATH" "Salt API TLS key"

  target_dir="$(dirname "$target_path")"
  if [[ ! -d "$target_dir" ]]; then
    echo "Salt config target directory does not exist: $target_dir" >&2
    exit 1
  fi

  if [[ -w "$target_dir" ]]; then
    "${install_cmd[@]}"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "${install_cmd[@]}"
  else
    echo "Cannot write to $target_dir and sudo is not available." >&2
    exit 1
  fi

  echo "Installed Salt API config to $target_path"
}

run_systemctl() {
  local action="$1"
  local service_name="$2"

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl "$action" "$service_name" >/dev/null 2>&1; then
      return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
      sudo systemctl "$action" "$service_name"
      return 0
    fi
  fi

  echo "Unable to run systemctl $action $service_name" >&2
  exit 1
}

restart_salt_api() {
  run_systemctl restart "$SALT_API_SERVICE_NAME"
  run_systemctl is-active "$SALT_API_SERVICE_NAME"
  echo "Restarted Salt API service: $SALT_API_SERVICE_NAME"
}

check_salt_api() {
  require curl
  curl -ksSf --max-time "$SALT_API_HEALTHCHECK_TIMEOUT" "$SALT_API_HEALTHCHECK_URL" >/dev/null
  echo "Salt API health check succeeded: $SALT_API_HEALTHCHECK_URL"
}

init_env=0
render_only=0
bootstrap_admin=0
install_salt_runtime=0
restart_salt_api_service=0
check_salt_api_health=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init-env)
      init_env=1
      ;;
    --render-only)
      render_only=1
      ;;
    --install-salt-config)
      install_salt_runtime=1
      ;;
    --restart-salt-api)
      restart_salt_api_service=1
      ;;
    --check-salt-api)
      check_salt_api_health=1
      ;;
    --bootstrap-admin)
      bootstrap_admin=1
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

require bash
require docker

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$init_env" -eq 1 ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "Created $ENV_FILE from $ENV_TEMPLATE"
  else
    echo "Missing $ENV_FILE. Re-run with --init-env to create it from .env.example." >&2
    exit 1
  fi
fi

validate_no_placeholders
load_env

validate_file_exists "$TLS_CERT_PATH" "Nginx TLS certificate"
validate_file_exists "$TLS_KEY_PATH" "Nginx TLS key"

bash "$SCRIPT_DIR/render-configs.sh"
validate_rendered_files

if [[ "$install_salt_runtime" -eq 1 ]]; then
  install_salt_config
  if [[ "$restart_salt_api_service" -eq 1 ]]; then
    restart_salt_api
  fi
  if [[ "$check_salt_api_health" -eq 1 ]]; then
    check_salt_api
  fi
elif [[ "$restart_salt_api_service" -eq 1 || "$check_salt_api_health" -eq 1 ]]; then
  echo "--restart-salt-api and --check-salt-api require --install-salt-config" >&2
  exit 1
fi

if [[ "$render_only" -eq 1 ]]; then
  echo "Runtime configs rendered only. No containers started."
  exit 0
fi

compose_cmd="$(pick_compose_cmd)"
cd "$STACK_ROOT"
$compose_cmd up -d

if [[ "$bootstrap_admin" -eq 1 ]]; then
  bash "$SCRIPT_DIR/bootstrap-teleport.sh"
fi

echo "Teleport stack deployed from $STACK_ROOT"
