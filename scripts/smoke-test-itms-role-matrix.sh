#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$REPO_ROOT/backend/.env"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"

ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@zerodha.com}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-replace-with-a-strong-admin-password}"

IT_TEAM_EMAIL="${IT_TEAM_EMAIL:-portal.itteam@zerodha.com}"
IT_TEAM_PASSWORD="${IT_TEAM_PASSWORD:-}"
AUDITOR_EMAIL="${AUDITOR_EMAIL:-portal.auditor@zerodha.com}"
AUDITOR_PASSWORD="${AUDITOR_PASSWORD:-}"
EMPLOYEE_EMAIL="${EMPLOYEE_EMAIL:-portal.employee@zerodha.com}"
EMPLOYEE_PASSWORD="${EMPLOYEE_PASSWORD:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command python3

if [[ -f "$REPO_ROOT/scripts/load-itms-backend-env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$REPO_ROOT/scripts/load-itms-backend-env.sh"
  ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-$ADMIN_EMAIL}"
  ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-$ADMIN_PASSWORD}"
fi

if [[ -z "$IT_TEAM_PASSWORD" || -z "$AUDITOR_PASSWORD" || -z "$EMPLOYEE_PASSWORD" ]]; then
  cat >&2 <<'EOF'
Missing role credentials.

Set these environment variables before running:
  IT_TEAM_PASSWORD
  AUDITOR_PASSWORD
  EMPLOYEE_PASSWORD

Optional email overrides:
  IT_TEAM_EMAIL
  AUDITOR_EMAIL
  EMPLOYEE_EMAIL
EOF
  exit 1
fi

export API_BASE_URL
export ADMIN_EMAIL
export ADMIN_PASSWORD
export IT_TEAM_EMAIL
export IT_TEAM_PASSWORD
export AUDITOR_EMAIL
export AUDITOR_PASSWORD
export EMPLOYEE_EMAIL
export EMPLOYEE_PASSWORD

python3 - <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

base = os.environ['API_BASE_URL'].rstrip('/')

accounts = {
    'super_admin': (os.environ['ADMIN_EMAIL'], os.environ['ADMIN_PASSWORD']),
    'it_team': (os.environ['IT_TEAM_EMAIL'], os.environ['IT_TEAM_PASSWORD']),
    'auditor': (os.environ['AUDITOR_EMAIL'], os.environ['AUDITOR_PASSWORD']),
    'employee': (os.environ['EMPLOYEE_EMAIL'], os.environ['EMPLOYEE_PASSWORD']),
}

checks = {
    'super_admin': [
        ('/api/auth/me', 200),
        ('/api/users?paginate=1&page=1&page_size=5', 200),
        ('/api/requests?paginate=1&page=1&page_size=5', 200),
        ('/api/announcements?paginate=1&page=1&page_size=5', 200),
        ('/api/chat/channels?paginate=1&page=1&page_size=5', 200),
        ('/api/gatepass?paginate=1&page=1&page_size=1', 200),
        ('/api/audit?paginate=1&page=1&page_size=4&action=login&module=access', 200),
    ],
    'it_team': [
        ('/api/auth/me', 200),
        ('/api/users?paginate=1&page=1&page_size=5', 200),
        ('/api/requests?paginate=1&page=1&page_size=5', 200),
        ('/api/announcements?paginate=1&page=1&page_size=5', 200),
        ('/api/chat/channels?paginate=1&page=1&page_size=5', 200),
        ('/api/gatepass?paginate=1&page=1&page_size=1', 200),
        ('/api/audit?paginate=1&page=1&page_size=4&action=login&module=access', 200),
    ],
    'auditor': [
        ('/api/auth/me', 200),
        ('/api/users?paginate=1&page=1&page_size=5', 200),
        ('/api/devices?paginate=1&page=1&page_size=5', 200),
        ('/api/alerts?paginate=1&page=1&page_size=5', 200),
        ('/api/announcements?paginate=1&page=1&page_size=5', 200),
        ('/api/requests?paginate=1&page=1&page_size=5', 403),
        ('/api/patch/reports', 403),
        ('/api/audit?paginate=1&page=1&page_size=4&action=login&module=access', 403),
    ],
    'employee': [
        ('/api/auth/me', 200),
        ('/api/me/assets', 200),
        ('/api/me/requests?paginate=1&page=1&page_size=5', 200),
        ('/api/announcements?paginate=1&page=1&page_size=5', 200),
        ('/api/chat/channels?paginate=1&page=1&page_size=5', 200),
        ('/api/users?paginate=1&page=1&page_size=5', 403),
        ('/api/requests?paginate=1&page=1&page_size=5', 403),
    ],
}


def login(email, password):
    request = urllib.request.Request(
        base + '/api/auth/login',
        data=json.dumps({'email': email, 'password': password}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
            return response.status, payload['token']
    except urllib.error.HTTPError as exc:
        return exc.code, None


def call(path, token):
    request = urllib.request.Request(
        base + path,
        headers={'Authorization': f'Bearer {token}'},
        method='GET',
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


results = {}
failed = False

for role, (email, password) in accounts.items():
    status, token = login(email, password)
    checks_out = []
    if status == 200:
      for path, expected in checks[role]:
        actual = call(path, token)
        ok = actual == expected
        checks_out.append({'path': path, 'expected': expected, 'actual': actual, 'ok': ok})
        failed = failed or not ok
    else:
      failed = True
    results[role] = {'email': email, 'login_status': status, 'checks': checks_out}

print(json.dumps(results, indent=2))

if failed:
    sys.exit(1)
PY