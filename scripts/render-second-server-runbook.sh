#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_PATH="$REPO_ROOT/docs/second-server-runbook-template.md"
OUTPUT_PATH=""
SERVER_IP=""
SERVER_NAME=""
ADMIN_EMAIL="admin@zerodha.com"
ADMIN_PASSWORD="replace-with-a-strong-admin-password"
JWT_SECRET="replace-with-a-random-secret-of-at-least-32-characters"
ADMIN_PASSWORD_FILE=""
JWT_SECRET_FILE=""
PROMPT_ADMIN_PASSWORD=0
PROMPT_JWT_SECRET=0

usage() {
  cat <<'EOF'
Usage:
  render-second-server-runbook.sh --server-ip IP [options]

Options:
  --server-ip IP         Required server IP used in backend and integration steps
  --server-name NAME     Hostname or public endpoint for nginx and smoke tests
  --admin-email EMAIL    Seeded admin email (default: admin@zerodha.com)
  --admin-password-file FILE
                        Read seeded admin password from FILE
  --prompt-admin-password
                        Prompt for seeded admin password without echo
  --jwt-secret-file FILE Read JWT secret from FILE
  --prompt-jwt-secret    Prompt for JWT secret without echo
  --output PATH          Write rendered output to PATH instead of stdout
  --help                 Show this message
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip)
      SERVER_IP="${2:-}"
      shift 2
      ;;
    --server-name)
      SERVER_NAME="${2:-}"
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
    --jwt-secret-file)
      JWT_SECRET_FILE="${2:-}"
      shift 2
      ;;
    --prompt-jwt-secret)
      PROMPT_JWT_SECRET=1
      shift
      ;;
    --output)
      OUTPUT_PATH="${2:-}"
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

if [[ -z "$SERVER_IP" ]]; then
  echo "Missing required argument: --server-ip" >&2
  usage >&2
  exit 1
fi

if [[ -z "$SERVER_NAME" ]]; then
  SERVER_NAME="$SERVER_IP"
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Template not found: $TEMPLATE_PATH" >&2
  exit 1
fi

require_command python3

if [[ -n "$ADMIN_PASSWORD_FILE" ]]; then
  ADMIN_PASSWORD="$(read_value_file "$ADMIN_PASSWORD_FILE")"
elif [[ "$PROMPT_ADMIN_PASSWORD" -eq 1 ]]; then
  ADMIN_PASSWORD="$(read_secret_prompt "Seeded admin password")"
fi

if [[ -n "$JWT_SECRET_FILE" ]]; then
  JWT_SECRET="$(read_value_file "$JWT_SECRET_FILE")"
elif [[ "$PROMPT_JWT_SECRET" -eq 1 ]]; then
  JWT_SECRET="$(read_secret_prompt "JWT secret")"
fi

rendered_content="$(printf '%s\n' "$SERVER_IP" "$SERVER_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$JWT_SECRET" | python3 -c '
from pathlib import Path
import sys

template_path = Path(sys.argv[1])
server_ip, server_name, admin_email, admin_password, jwt_secret = [line.rstrip("\n") for line in sys.stdin.readlines()]

text = template_path.read_text()
replacements = {
    "YOUR_SERVER_NAME_OR_IP": server_name,
    "YOUR_SERVER_IP": server_ip,
    "admin@zerodha.com": admin_email,
    "replace-with-a-strong-admin-password": admin_password,
    "replace-with-a-random-secret-of-at-least-32-characters": jwt_secret,
}

for old, new in replacements.items():
    text = text.replace(old, new)

print(text, end="")
' "$TEMPLATE_PATH")"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s' "$rendered_content" > "$OUTPUT_PATH"
  echo "Rendered runbook written to $OUTPUT_PATH"
else
  printf '%s' "$rendered_content"
fi