#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$REPO_ROOT/backend/.env"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$REPO_ROOT/backend/.env.secrets}"
BASE_URL="${BASE_URL:-}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@zerodha.com}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-replace-with-a-strong-admin-password}"
PROMPT_ADMIN_PASSWORD=0

usage() {
  cat <<'EOF'
Usage:
  scripts/smoke-test-itms-chat-live.sh [options]

Options:
  --base-url URL             Override the served app URL to verify
  --auth-token TOKEN         Use an existing bearer token instead of logging in
  --auth-token-file FILE     Read the bearer token from FILE
  --admin-email EMAIL        Override the admin email used for login fallback
  --admin-password-file FILE Read the admin password from FILE
  --prompt-admin-password    Prompt for the admin password without echo
  --help                     Show this message
EOF
}

log_step() {
  printf '\n[smoke-test-itms-chat-live] %s\n' "$*"
}

fail() {
  echo "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base-url)
        BASE_URL="${2:-}"
        shift 2
        ;;
      --auth-token)
        AUTH_TOKEN="${2:-}"
        shift 2
        ;;
      --auth-token-file)
        [[ -f "${2:-}" ]] || fail "Auth token file not found: ${2:-}"
        AUTH_TOKEN="$(tr -d '\r\n' < "${2:-}")"
        shift 2
        ;;
      --admin-email)
        ADMIN_EMAIL="${2:-}"
        shift 2
        ;;
      --admin-password-file)
        [[ -f "${2:-}" ]] || fail "Admin password file not found: ${2:-}"
        ADMIN_PASSWORD="$(tr -d '\r\n' < "${2:-}")"
        shift 2
        ;;
      --prompt-admin-password)
        PROMPT_ADMIN_PASSWORD=1
        shift
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

file_env_value() {
  local file="$1"
  local key="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  env -i bash -lc "set -a; source \"$file\" >/dev/null 2>&1; printf '%s' \"\${$key:-}\"" 2>/dev/null || true
}

resolve_base_url() {
  if [[ -n "$BASE_URL" ]]; then
    printf '%s\n' "${BASE_URL%/}"
    return
  fi

  local public_server_url="http://YOUR_SERVER_IP"
  local env_public_server_url
  env_public_server_url="$(file_env_value "$BACKEND_ENV_FILE" PUBLIC_SERVER_URL)"
  env_public_server_url="${env_public_server_url#\'}"
  env_public_server_url="${env_public_server_url%\'}"
  if [[ -n "$env_public_server_url" ]]; then
    public_server_url="$env_public_server_url"
  fi

  printf '%s\n' "${public_server_url%/}"
}

prompt_for_password() {
  local entered_password
  read -r -s -p 'Admin password: ' entered_password
  printf '\n'
  ADMIN_PASSWORD="$entered_password"
}

json_field() {
  local expression="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); value=data$expression; print(value if value is not None else '')"
}

attempt_login() {
  local api_base_url="$1"
  local response_file
  local status

  response_file="$(mktemp)"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$api_base_url/api/auth/login" -H 'Content-Type: application/json' --data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" || true)"

  if [[ "$status" == "200" ]]; then
    AUTH_TOKEN="$(json_field "['token']" < "$response_file")"
    rm -f "$response_file"
    [[ -n "$AUTH_TOKEN" ]]
    return 0
  fi

  rm -f "$response_file"
  return 1
}

attempt_container_login() {
  local container_name='zerodha-itms-backend'
  local response

  command -v docker >/dev/null 2>&1 || return 1
  docker ps --format '{{.Names}}' | grep -Fxq "$container_name" || return 1

  response="$(docker exec "$container_name" sh -lc 'curl -sS -X POST http://127.0.0.1:3001/api/auth/login -H "Content-Type: application/json" --data "{\"email\":\"$DEFAULT_ADMIN_EMAIL\",\"password\":\"$DEFAULT_ADMIN_PASSWORD\"}"' 2>/dev/null || true)"
  [[ -n "$response" ]] || return 1

  AUTH_TOKEN="$(json_field "['token']" <<< "$response")"
  [[ -n "$AUTH_TOKEN" ]]
}

fetch_json() {
  local url="$1"
  curl -fsS "$url" -H "Authorization: Bearer $AUTH_TOKEN"
}

fetch_html() {
  local url="$1"
  curl -fsS "$url"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "Expected response to contain: $needle"
}

main() {
  parse_args "$@"

  require_command curl
  require_command grep
  require_command python3

  local resolved_base_url
  resolved_base_url="$(resolve_base_url)"

  if [[ "$PROMPT_ADMIN_PASSWORD" -eq 1 && -z "$AUTH_TOKEN" ]]; then
    prompt_for_password
  fi

  if [[ -z "$AUTH_TOKEN" ]]; then
    local env_admin_email env_admin_password secrets_admin_email secrets_admin_password
    env_admin_email="$(file_env_value "$BACKEND_ENV_FILE" DEFAULT_ADMIN_EMAIL)"
    env_admin_password="$(file_env_value "$BACKEND_ENV_FILE" DEFAULT_ADMIN_PASSWORD)"
    secrets_admin_email="$(file_env_value "$BACKEND_SECRETS_FILE" DEFAULT_ADMIN_EMAIL)"
    secrets_admin_password="$(file_env_value "$BACKEND_SECRETS_FILE" DEFAULT_ADMIN_PASSWORD)"

    ADMIN_EMAIL="${secrets_admin_email:-${env_admin_email:-$ADMIN_EMAIL}}"
    ADMIN_PASSWORD="${secrets_admin_password:-${env_admin_password:-$ADMIN_PASSWORD}}"

    log_step "Obtaining an auth token for ${ADMIN_EMAIL}"
    if ! attempt_login "$resolved_base_url"; then
      log_step 'Configured login failed, trying running backend container env'
      attempt_container_login || fail 'Failed to obtain a bearer token for live chat smoke checks.'
    fi
  fi

  log_step "Checking served chat route at ${resolved_base_url}/it/chat"
  local chat_shell_html
  chat_shell_html="$(fetch_html "$resolved_base_url/it/chat")"
  assert_contains "$chat_shell_html" '<title>itms</title>'
  assert_contains "$chat_shell_html" 'id="root"'

  log_step 'Loading a real chat channel list through the served same-origin API'
  local channels_payload first_channel_id first_channel_kind first_channel_status second_channel_id
  channels_payload="$(fetch_json "$resolved_base_url/api/chat/channels?paginate=1&page=1&page_size=5")"
  first_channel_id="$(json_field "['items'][0]['id']" <<< "$channels_payload")"
  first_channel_kind="$(json_field "['items'][0]['kind']" <<< "$channels_payload")"
  first_channel_status="$(json_field "['items'][0]['status']" <<< "$channels_payload")"
  second_channel_id="$(json_field "['items'][1]['id']" <<< "$channels_payload")"

  [[ -n "$first_channel_id" ]] || fail 'No chat channels were returned by the live API.'

  log_step 'Checking live deep-link chat route for the first real channel'
  local deep_link_html
  deep_link_html="$(fetch_html "$resolved_base_url/it/chat?channel=$first_channel_id&kind=$first_channel_kind&status=$first_channel_status")"
  assert_contains "$deep_link_html" '<title>itms</title>'

  log_step 'Checking live chat messages endpoint for the selected channel'
  fetch_json "$resolved_base_url/api/chat/channels/$first_channel_id/messages?paginate=1&page=1&page_size=100" >/dev/null

  if [[ -n "$second_channel_id" ]]; then
    log_step 'Checking a second live deep-link channel route when available'
    fetch_html "$resolved_base_url/it/chat?channel=$second_channel_id&kind=$first_channel_kind" >/dev/null
  fi

  log_step 'Live chat smoke test completed successfully'
}

main "$@"