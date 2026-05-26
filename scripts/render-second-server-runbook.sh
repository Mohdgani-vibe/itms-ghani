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

usage() {
  cat <<'EOF'
Usage:
  render-second-server-runbook.sh --server-ip IP [options]

Options:
  --server-ip IP         Required server IP used in backend and integration steps
  --server-name NAME     Hostname or public endpoint for nginx and smoke tests
  --admin-email EMAIL    Seeded admin email (default: admin@zerodha.com)
  --admin-password PASS  Seeded admin password placeholder or real value
  --jwt-secret VALUE     JWT secret placeholder or real value
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
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET="${2:-}"
      shift 2
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

rendered_content="$(python3 - "$TEMPLATE_PATH" "$SERVER_IP" "$SERVER_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$JWT_SECRET" <<'PY'
from pathlib import Path
import sys

template_path = Path(sys.argv[1])
server_ip = sys.argv[2]
server_name = sys.argv[3]
admin_email = sys.argv[4]
admin_password = sys.argv[5]
jwt_secret = sys.argv[6]

text = template_path.read_text()
replacements = {
    'YOUR_SERVER_NAME_OR_IP': server_name,
    'YOUR_SERVER_IP': server_ip,
    'admin@zerodha.com': admin_email,
    'replace-with-a-strong-admin-password': admin_password,
    'replace-with-a-random-secret-of-at-least-32-characters': jwt_secret,
}

for old, new in replacements.items():
    text = text.replace(old, new)

print(text, end='')
PY
)"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s' "$rendered_content" > "$OUTPUT_PATH"
  echo "Rendered runbook written to $OUTPUT_PATH"
else
  printf '%s' "$rendered_content"
fi