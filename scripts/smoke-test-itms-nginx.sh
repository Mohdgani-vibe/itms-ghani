#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$REPO_ROOT/backend/.env"
BASE_URL="${BASE_URL:-}"
SKIP_SERVICE_CHECK=0

usage() {
  cat <<'EOF'
Usage:
  scripts/smoke-test-itms-nginx.sh [options]

Options:
  --base-url URL           Override the nginx-served base URL to verify
  --skip-service-check     Skip systemctl nginx service checks
  --help                   Show this message
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

log_step() {
  printf '\n[smoke-test-itms-nginx] %s\n' "$*"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base-url)
        BASE_URL="${2:-}"
        shift 2
        ;;
      --skip-service-check)
        SKIP_SERVICE_CHECK=1
        shift
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
  done
}

resolve_base_url() {
  if [[ -n "$BASE_URL" ]]; then
    printf '%s\n' "${BASE_URL%/}"
    return
  fi

  local public_server_url="http://YOUR_SERVER_IP"
  if [[ -f "$BACKEND_ENV_FILE" ]]; then
    local env_public_server_url
    env_public_server_url="$(grep -E '^PUBLIC_SERVER_URL=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)"
    env_public_server_url="${env_public_server_url%$'\r'}"
    env_public_server_url="${env_public_server_url#\"}"
    env_public_server_url="${env_public_server_url%\"}"
    if [[ -n "$env_public_server_url" ]]; then
      public_server_url="$env_public_server_url"
    fi
  fi

  printf '%s\n' "${public_server_url%/}"
}

check_service_state() {
  if [[ "$SKIP_SERVICE_CHECK" -eq 1 ]]; then
    return 0
  fi
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "systemctl not found; skipping nginx service state checks" >&2
    return 0
  fi

  local active_state enabled_state
  active_state="$(systemctl is-active nginx 2>/dev/null || true)"
  enabled_state="$(systemctl is-enabled nginx 2>/dev/null || true)"

  [[ "$active_state" == "active" ]] || {
    echo "nginx service is not active: $active_state" >&2
    exit 1
  }
  [[ "$enabled_state" == "enabled" ]] || {
    echo "nginx service is not enabled: $enabled_state" >&2
    exit 1
  }

  echo "nginx service: $active_state / $enabled_state"
}

expect_http_ok() {
  local url="$1"
  local label="$2"

  local response_headers
  response_headers="$(curl -fsSIL --max-time 10 "$url")"
  printf '%s\n' "$response_headers" | awk 'toupper($1) ~ /^HTTP\// { print; exit }'
  printf '%s\n' "$response_headers" | grep -qi '^HTTP/.* 200 ' || {
    echo "$label did not return HTTP 200: $url" >&2
    exit 1
  }
}

main() {
  parse_args "$@"
  require_command curl
  require_command grep
  require_command awk

  local resolved_base_url
  resolved_base_url="$(resolve_base_url)"

  log_step 'Checking nginx service state'
  check_service_state

  log_step "Checking frontend login route at ${resolved_base_url}/login"
  expect_http_ok "${resolved_base_url}/login" 'Frontend login route'

  log_step "Checking proxied backend health at ${resolved_base_url}/api/health"
  curl -fsS --max-time 10 "${resolved_base_url}/api/health"

  log_step "Checking published Linux installer at ${resolved_base_url}/installers/install-itms-agent.sh"
  expect_http_ok "${resolved_base_url}/installers/install-itms-agent.sh" 'Linux installer'

  log_step 'nginx smoke test completed successfully'
}

main "$@"