#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$REPO_ROOT/backend/.env}"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_PASSWORD_FILE=""
PROMPT_ADMIN_PASSWORD=0
USER_EMAIL=""
INTERVAL_SECONDS="${INTERVAL_SECONDS:-5}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-300}"
EXPECT_NEW_COUNT="${EXPECT_NEW_COUNT:-1}"

usage() {
  cat <<'EOF'
Usage:
  scripts/watch-itms-enrollment.sh --user-email user@example.com [options]

Options:
  --user-email EMAIL     Employee email to watch for new assigned assets
  --backend-url URL      Backend base URL, default: http://127.0.0.1:3001
  --admin-email EMAIL    Admin login email, default: DEFAULT_ADMIN_EMAIL from backend env files
  --admin-password-file FILE
                       Read admin login password from FILE
  --prompt-admin-password
                       Prompt for admin login password without echo
  --interval SECONDS     Poll interval, default: 5
  --timeout SECONDS      Total wait time, default: 300
  --expect-new-count N   Number of newly assigned assets to wait for, default: 1

Example:
  scripts/watch-itms-enrollment.sh --user-email user@zerodha.com
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

read_value_file() {
  local file_path="$1"

  if [[ ! -f "$file_path" ]]; then
    echo "Value file not found: $file_path" >&2
    exit 1
  fi

  python3 - "$file_path" <<'PY'
from pathlib import Path
import sys

print(Path(sys.argv[1]).read_text().rstrip("\r\n"), end="")
PY
}

read_secret_prompt() {
  local prompt_label="$1"
  local value

  if [[ -t 0 || -t 1 ]]; then
    read -r -s -p "${prompt_label}: " value
    printf '\n' >&2
    printf '%s' "$value"
    return 0
  fi

  if ! IFS= read -r value; then
    echo "Cannot read ${prompt_label} from stdin" >&2
    exit 1
  fi

  printf '%s' "$value"
}

log() {
  printf '[watch-itms-enrollment] %s\n' "$*"
}

if [[ -f "$REPO_ROOT/scripts/load-itms-backend-env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$REPO_ROOT/scripts/load-itms-backend-env.sh"
  ADMIN_EMAIL="${ADMIN_EMAIL:-${DEFAULT_ADMIN_EMAIL:-}}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-${DEFAULT_ADMIN_PASSWORD:-}}"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user-email)
      USER_EMAIL="${2:-}"
      shift 2
      ;;
    --backend-url)
      BACKEND_URL="${2:-}"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --admin-password-file)
      ADMIN_PASSWORD_FILE="${2:-}"
      shift 2
      ;;
    --prompt-admin-password)
      PROMPT_ADMIN_PASSWORD=1
      shift
      ;;
    --interval)
      INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --expect-new-count)
      EXPECT_NEW_COUNT="${2:-}"
      shift 2
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

if [[ -n "$ADMIN_PASSWORD_FILE" ]]; then
  ADMIN_PASSWORD="$(read_value_file "$ADMIN_PASSWORD_FILE")"
elif [[ "$PROMPT_ADMIN_PASSWORD" -eq 1 ]]; then
  ADMIN_PASSWORD="$(read_secret_prompt "Admin password")"
fi

if [[ -z "$USER_EMAIL" ]]; then
  echo "--user-email is required" >&2
  usage >&2
  exit 1
fi

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Admin credentials are required. Set backend env files, pass --admin-email with --admin-password-file, or use --prompt-admin-password." >&2
  exit 1
fi

require_command curl
require_command jq
require_command python3

login_response="$(curl -fsS -X POST "$BACKEND_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(jq -cn --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{email: $email, password: $password}')")"
token="$(printf '%s' "$login_response" | jq -r '.token')"

if [[ -z "$token" || "$token" == "null" ]]; then
  echo "Failed to obtain auth token from $BACKEND_URL" >&2
  exit 1
fi

auth_header=( -H "Authorization: Bearer $token" )

fetch_user() {
  curl -fsS "$BACKEND_URL/api/users" "${auth_header[@]}" | jq -c --arg email "$USER_EMAIL" 'map(select(.email == $email)) | .[0]'
}

fetch_assets() {
  local user_id="$1"
  curl -fsS "$BACKEND_URL/api/users/$user_id/assets" "${auth_header[@]}"
}

user_json="$(fetch_user)"
user_id="$(printf '%s' "$user_json" | jq -r '.id')"
user_name="$(printf '%s' "$user_json" | jq -r '.full_name')"

if [[ -z "$user_id" || "$user_id" == "null" ]]; then
  echo "User not found for email: $USER_EMAIL" >&2
  exit 1
fi

baseline_assets="$(fetch_assets "$user_id")"
baseline_count="$(printf '%s' "$baseline_assets" | jq '.devices | length')"
target_count=$((baseline_count + EXPECT_NEW_COUNT))
deadline=$((SECONDS + TIMEOUT_SECONDS))

log "Watching $user_name <$USER_EMAIL> on $BACKEND_URL"
log "Baseline device count: $baseline_count"
printf '%s\n' "$baseline_assets" | jq '{devices: [.devices[] | {id, assetTag, hostname, status, osName, notes, toolStatus}]}'

while (( SECONDS < deadline )); do
  current_assets="$(fetch_assets "$user_id")"
  current_count="$(printf '%s' "$current_assets" | jq '.devices | length')"

  if (( current_count >= target_count )); then
    log "Detected new device assignment. Current device count: $current_count"
    printf '%s\n' "$current_assets" | jq '{devices: [.devices[] | {id, assetTag, hostname, status, osName, notes, toolStatus}]}'
    exit 0
  fi

  remaining=$((deadline - SECONDS))
  log "No new device yet. Current count: $current_count. Retrying in ${INTERVAL_SECONDS}s (${remaining}s remaining)"
  sleep "$INTERVAL_SECONDS"
done

log "Timed out after ${TIMEOUT_SECONDS}s without detecting a new device assignment"
current_assets="$(fetch_assets "$user_id")"
printf '%s\n' "$current_assets" | jq '{devices: [.devices[] | {id, assetTag, hostname, status, osName, notes, toolStatus}]}'
exit 1