#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$REPO_ROOT/backend/.env"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$(dirname "$BACKEND_ENV_FILE")/.env.secrets}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@zerodha.com}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-replace-with-a-strong-admin-password}"
SEEDED_ADMIN_PASSWORD="${SEEDED_ADMIN_PASSWORD:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command curl
require_command python3

file_env_value() {
  local file="$1"
  local key="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  env -i bash -lc "set -a; source \"$file\" >/dev/null 2>&1; printf '%s' \"\${$key:-}\""
}

warn_backend_env_drift() {
  local env_email secrets_email env_password secrets_password

  env_email="$(file_env_value "$BACKEND_ENV_FILE" DEFAULT_ADMIN_EMAIL)"
  secrets_email="$(file_env_value "$BACKEND_SECRETS_FILE" DEFAULT_ADMIN_EMAIL)"
  env_password="$(file_env_value "$BACKEND_ENV_FILE" DEFAULT_ADMIN_PASSWORD)"
  secrets_password="$(file_env_value "$BACKEND_SECRETS_FILE" DEFAULT_ADMIN_PASSWORD)"

  if [[ -n "$env_email" && -n "$secrets_email" && "$env_email" != "$secrets_email" ]]; then
    echo "Warning: backend/.env and backend/.env.secrets define different DEFAULT_ADMIN_EMAIL values." >&2
    echo "Warning: scripts/load-itms-backend-env.sh loads .env.secrets last, so it overrides backend/.env during smoke tests." >&2
  fi

  if [[ -n "$env_password" && -n "$secrets_password" && "$env_password" != "$secrets_password" ]]; then
    echo "Warning: backend/.env and backend/.env.secrets define different DEFAULT_ADMIN_PASSWORD values." >&2
    echo "Warning: scripts/load-itms-backend-env.sh loads .env.secrets last, so it overrides backend/.env during smoke tests." >&2
  fi
}

if [[ -f "$REPO_ROOT/scripts/load-itms-backend-env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$REPO_ROOT/scripts/load-itms-backend-env.sh"
  ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-$ADMIN_EMAIL}"
  ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-$ADMIN_PASSWORD}"
fi

warn_backend_env_drift

api_json() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local body="${4:-}"
  local args=( -fsS -X "$method" "$url" )

  if [[ -n "$token" ]]; then
    args+=( -H "Authorization: Bearer $token" )
  fi
  if [[ -n "$body" ]]; then
    args+=( -H "Content-Type: application/json" --data "$body" )
  else
    :
  fi

  curl "${args[@]}"
}

API_STATUS=""
API_BODY=""

api_request() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local body="${4:-}"
  local response_file
  local args=( -sS -o )

  response_file="$(mktemp)"
  args+=( "$response_file" -w '%{http_code}' -X "$method" "$url" )

  if [[ -n "$token" ]]; then
    args+=( -H "Authorization: Bearer $token" )
  fi
  if [[ -n "$body" ]]; then
    args+=( -H "Content-Type: application/json" --data "$body" )
  fi

  API_STATUS="$(curl "${args[@]}" || true)"
  API_BODY="$(cat "$response_file")"
  rm -f "$response_file"

  if [[ ! "$API_STATUS" =~ ^2 ]]; then
    echo "Request failed: $method $url (status $API_STATUS)" >&2
    if [[ -n "$API_BODY" ]]; then
      echo "$API_BODY" >&2
    fi
    return 1
  fi

  return 0
}

expect_http_error() {
  local expected_status="$1"
  local actual_status="$2"
  local response_body="$3"
  local expected_fragment="$4"
  local description="$5"

  if [[ "$actual_status" != "$expected_status" ]]; then
    echo "$description returned unexpected status: $actual_status" >&2
    if [[ -n "$response_body" ]]; then
      echo "$response_body" >&2
    fi
    return 1
  fi

  if [[ "$response_body" != *"$expected_fragment"* ]]; then
    echo "$description returned unexpected body: $response_body" >&2
    return 1
  fi

  return 0
}

LOGIN_STATUS=""
LOGIN_BODY=""

attempt_login() {
  local email="$1"
  local password="$2"
  local response_file

  response_file="$(mktemp)"
  LOGIN_STATUS="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$API_BASE_URL/api/auth/login" -H "Content-Type: application/json" --data "{\"email\":\"$email\",\"password\":\"$password\"}" || true)"
  LOGIN_BODY="$(cat "$response_file")"
  rm -f "$response_file"

  [[ "$LOGIN_STATUS" == "200" ]]
}

json_field() {
  local field="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); value=data$field; print(value if value is not None else '')"
}

json_len() {
  python3 -c "import json,sys; data=json.load(sys.stdin); print(len(data))"
}

json_require_keys() {
  python3 -c 'import json, sys; payload = json.load(sys.stdin); missing = [key for key in sys.argv[1:] if key not in payload]; sys.exit("missing keys: " + ", ".join(missing) if missing else 0)' "$@"
}

created_inventory_id=""
created_inventory_import_id=""
created_inventory_duplicate_id=""
created_inventory_db_duplicate_id=""

cleanup_inventory_item() {
  if [[ -z "$created_inventory_id" || -z "${token:-}" ]]; then
    :
  else
    curl -fsS -X DELETE -H "Authorization: Bearer $token" "$API_BASE_URL/api/inventory/$created_inventory_id" >/dev/null 2>&1 || true
  fi

  if [[ -n "$created_inventory_import_id" && -n "${token:-}" ]]; then
    curl -fsS -X DELETE -H "Authorization: Bearer $token" "$API_BASE_URL/api/inventory/$created_inventory_import_id" >/dev/null 2>&1 || true
  fi

  if [[ -n "$created_inventory_duplicate_id" && -n "${token:-}" ]]; then
    curl -fsS -X DELETE -H "Authorization: Bearer $token" "$API_BASE_URL/api/inventory/$created_inventory_duplicate_id" >/dev/null 2>&1 || true
  fi

  if [[ -n "$created_inventory_db_duplicate_id" && -n "${token:-}" ]]; then
    curl -fsS -X DELETE -H "Authorization: Bearer $token" "$API_BASE_URL/api/inventory/$created_inventory_db_duplicate_id" >/dev/null 2>&1 || true
  fi
}

trap cleanup_inventory_item EXIT

echo "Checking API health at $API_BASE_URL/api/health ..."
health_payload="$(api_json GET "$API_BASE_URL/api/health")"
echo "$health_payload"

echo
echo "Logging in as admin: $ADMIN_EMAIL"

login_source="configured backend/.env password"
if attempt_login "$ADMIN_EMAIL" "$ADMIN_PASSWORD"; then
  login_payload="$LOGIN_BODY"
elif [[ -n "$SEEDED_ADMIN_PASSWORD" && "$ADMIN_PASSWORD" != "$SEEDED_ADMIN_PASSWORD" ]] && attempt_login "$ADMIN_EMAIL" "$SEEDED_ADMIN_PASSWORD"; then
  login_payload="$LOGIN_BODY"
  login_source="seeded fallback password"
  echo "Warning: DEFAULT_ADMIN_PASSWORD in the backend env files does not match the live admin credential." >&2
  echo "Warning: ITMS only seeds the default admin on first insert, so changing the env files does not rotate the stored password automatically." >&2
else
  echo "Admin login failed for $ADMIN_EMAIL." >&2
  echo "Configured password status: $LOGIN_STATUS" >&2
  if [[ -n "$LOGIN_BODY" ]]; then
    echo "$LOGIN_BODY" >&2
  fi
  exit 1
fi

token="$(printf '%s' "$login_payload" | json_field "['token']")"

if [[ -z "$token" ]]; then
  echo "Login succeeded but no token was returned." >&2
  exit 1
fi

echo "Auth token acquired using $login_source."

echo
echo "Checking authenticated profile ..."
api_json GET "$API_BASE_URL/api/auth/me" "$token"

echo
echo "Checking core live endpoints ..."
users_count="$(api_json GET "$API_BASE_URL/api/users" "$token" | json_len)"
devices_count="$(api_json GET "$API_BASE_URL/api/devices" "$token" | json_len)"
requests_count="$(api_json GET "$API_BASE_URL/api/requests" "$token" | json_len)"
announcements_count="$(api_json GET "$API_BASE_URL/api/announcements" "$token" | json_len)"
devices_payload="$(api_json GET "$API_BASE_URL/api/devices" "$token")"
assets_payload="$(api_json GET "$API_BASE_URL/api/assets" "$token")"

echo "users: $users_count"
echo "devices: $devices_count"
echo "requests: $requests_count"
echo "announcements: $announcements_count"

echo
echo "Checking patch endpoints ..."
patch_dashboard_payload="$(api_json GET "$API_BASE_URL/api/patch/dashboard" "$token")"
printf '%s' "$patch_dashboard_payload" | json_require_keys failed pending rebootPending total upToDate

patch_devices_payload="$(api_json GET "$API_BASE_URL/api/patch/devices" "$token")"
patch_devices_count="$(printf '%s' "$patch_devices_payload" | json_len)"

patch_reports_payload="$(api_json GET "$API_BASE_URL/api/patch/reports?limit=1" "$token")"
patch_reports_count="$(printf '%s' "$patch_reports_payload" | json_len)"
if (( patch_reports_count > 1 )); then
  echo "Patch reports limit query returned more than one item: $patch_reports_count" >&2
  exit 1
fi

patch_workspace_execute_response_file="$(mktemp)"
patch_workspace_execute_status="$(curl -sS -o "$patch_workspace_execute_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data '{}' "$API_BASE_URL/api/salt/workspace/execute" || true)"
patch_workspace_execute_body="$(cat "$patch_workspace_execute_response_file")"
rm -f "$patch_workspace_execute_response_file"
expect_http_error "400" "$patch_workspace_execute_status" "$patch_workspace_execute_body" "function is required" "salt workspace execute validation"

echo "patch dashboard total: $(printf '%s' "$patch_dashboard_payload" | json_field "['total']")"
echo "patch devices: $patch_devices_count"
echo "patch reports (limit=1): $patch_reports_count"

terminal_hostname="$(printf '%s' "$devices_payload" | python3 -c 'import json, sys; devices = json.load(sys.stdin); hostname = next((str(device.get("hostname", "")).strip() for device in devices if str(device.get("hostname", "")).strip()), ""); print(hostname)')"
ssh_asset_id="$(printf '%s' "$assets_payload" | python3 -c 'import json, sys; assets = json.load(sys.stdin); asset_id = next((str(asset.get("id", "")).strip() for asset in assets if str(asset.get("id", "")).strip()), ""); print(asset_id)')"
if [[ -n "$terminal_hostname" ]]; then
  terminal_target_path="$(TERMINAL_HOSTNAME="$terminal_hostname" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["TERMINAL_HOSTNAME"], safe=""))')"
  terminal_target_payload="$(api_json GET "$API_BASE_URL/api/terminal/targets/$terminal_target_path" "$token")"
  printf '%s' "$terminal_target_payload" | json_require_keys assetId assetTag connected hostname minionId policy
  printf '%s' "$terminal_target_payload" | python3 -c 'import json, sys; payload = json.load(sys.stdin); policy = payload.get("policy") or {}; missing = [key for key in ("allowedCommands", "restrictions", "presetCommands", "blockedExamples") if key not in policy]; sys.exit("missing terminal policy keys: " + ", ".join(missing) if missing else 0)'
  terminal_minion_id="$(printf '%s' "$terminal_target_payload" | json_field "['minionId']")"
  terminal_execute_response_file="$(mktemp)"
  terminal_execute_status="$(curl -sS -o "$terminal_execute_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data '{"command":"ps aux | grep salt"}' "$API_BASE_URL/api/terminal/targets/$terminal_target_path/execute" || true)"
  terminal_execute_body="$(cat "$terminal_execute_response_file")"
  rm -f "$terminal_execute_response_file"
  expect_http_error "400" "$terminal_execute_status" "$terminal_execute_body" "command contains a blocked shell pattern" "terminal blocked command validation"

  missing_terminal_target_path="missing-terminal-target-smoke"
  missing_terminal_response_file="$(mktemp)"
  missing_terminal_status="$(curl -sS -o "$missing_terminal_response_file" -w '%{http_code}' -H "Authorization: Bearer $token" "$API_BASE_URL/api/terminal/targets/$missing_terminal_target_path" || true)"
  missing_terminal_body="$(cat "$missing_terminal_response_file")"
  rm -f "$missing_terminal_response_file"
  expect_http_error "404" "$missing_terminal_status" "$missing_terminal_body" "terminal target not found" "terminal target missing validation"
fi

if [[ -n "$ssh_asset_id" ]]; then
  ssh_target_payload="$(api_json GET "$API_BASE_URL/api/ssh/assets/$ssh_asset_id" "$token")"
  printf '%s' "$ssh_target_payload" | json_require_keys assetId address username reachable keyFingerprint usernames

  missing_ssh_response_file="$(mktemp)"
  missing_ssh_status="$(curl -sS -o "$missing_ssh_response_file" -w '%{http_code}' -H "Authorization: Bearer $token" "$API_BASE_URL/api/ssh/assets/00000000-0000-0000-0000-000000000000" || true)"
  missing_ssh_body="$(cat "$missing_ssh_response_file")"
  rm -f "$missing_ssh_response_file"
  expect_http_error "404" "$missing_ssh_status" "$missing_ssh_body" "asset not found" "ssh target missing validation"
fi

echo
echo "Checking inventory endpoints ..."
inventory_payload="$(api_json GET "$API_BASE_URL/api/inventory?page=1&pageSize=5" "$token")"
printf '%s' "$inventory_payload" | json_require_keys items total summary groups
inventory_total="$(printf '%s' "$inventory_payload" | json_field "['summary']['total']")"

inventory_options_payload="$(api_json GET "$API_BASE_URL/api/inventory/module/options" "$token")"
printf '%s' "$inventory_options_payload" | json_require_keys items subItems suppliers branches employees
inventory_branch_count="$(printf '%s' "$inventory_options_payload" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['branches']))")"
inventory_branch_id="$(printf '%s' "$inventory_options_payload" | json_field "['branches'][0]['id']")"

if [[ -z "$inventory_branch_id" ]]; then
  echo "Inventory module options returned no visible branches for live create/delete validation." >&2
  exit 1
fi

inventory_template_header="$(curl -fsS -H "Authorization: Bearer $token" "$API_BASE_URL/api/inventory/import-template" | head -n 1 | tr -d '\r')"
if [[ "$inventory_template_header" != "Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status" ]]; then
  echo "Unexpected inventory import template header: $inventory_template_header" >&2
  exit 1
fi

smoke_inventory_suffix="$(date +%s)"
smoke_inventory_asset_tag="S-$smoke_inventory_suffix"
smoke_inventory_serial="S-SN-$smoke_inventory_suffix"
smoke_inventory_payload="$(printf '{"category":"Laptop","name":"S L %s","assetTag":"%s","serialNumber":"%s","specs":"smoke test","branchId":"%s","status":"inventory"}' "$smoke_inventory_suffix" "$smoke_inventory_asset_tag" "$smoke_inventory_serial" "$inventory_branch_id")"
smoke_import_item_code="C-$smoke_inventory_suffix"
smoke_import_asset_tag="CA-$smoke_inventory_suffix"
smoke_import_serial="CS-$smoke_inventory_suffix"

api_request POST "$API_BASE_URL/api/inventory" "$token" "$smoke_inventory_payload"
printf '%s' "$API_BODY" | json_require_keys id itemCode
created_inventory_id="$(printf '%s' "$API_BODY" | json_field "['id']")"
created_inventory_item_code="$(printf '%s' "$API_BODY" | json_field "['itemCode']")"

inventory_created_payload="$(api_json GET "$API_BASE_URL/api/inventory?search=$smoke_inventory_asset_tag&page=1&pageSize=5" "$token")"
printf '%s' "$inventory_created_payload" | json_require_keys items total summary groups
inventory_created_visible="$(printf '%s' "$inventory_created_payload" | SMOKE_ASSET_TAG="$smoke_inventory_asset_tag" python3 -c 'import json, os, sys; payload = json.load(sys.stdin); target = os.environ["SMOKE_ASSET_TAG"]; print("1" if any(item.get("assetTag") == target for item in payload.get("items", [])) else "0")')"
if [[ "$inventory_created_visible" != "1" ]]; then
  echo "Created inventory item was not returned by inventory search." >&2
  exit 1
fi

api_request DELETE "$API_BASE_URL/api/inventory/$created_inventory_id" "$token"
printf '%s' "$API_BODY" | json_require_keys status
if [[ "$(printf '%s' "$API_BODY" | json_field "['status']")" != "deleted" ]]; then
  echo "Unexpected inventory delete response: $API_BODY" >&2
  exit 1
fi
created_inventory_id=""

smoke_import_csv_file="$(mktemp)"
cat > "$smoke_import_csv_file" <<EOF
Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status
$smoke_import_item_code,Laptop,SI L $smoke_inventory_suffix,$smoke_import_asset_tag,$smoke_import_serial,smoke csv import,$inventory_branch_id,,2027-01-01,50000,inventory
EOF

import_response_file="$(mktemp)"
import_status="$(curl -sS -o "$import_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -F "file=@$smoke_import_csv_file;type=text/csv" "$API_BASE_URL/api/inventory/import" || true)"
import_body="$(cat "$import_response_file")"
rm -f "$import_response_file" "$smoke_import_csv_file"

if [[ ! "$import_status" =~ ^2 ]]; then
  echo "Request failed: POST $API_BASE_URL/api/inventory/import (status $import_status)" >&2
  if [[ -n "$import_body" ]]; then
    echo "$import_body" >&2
  fi
  exit 1
fi

printf '%s' "$import_body" | json_require_keys created updated errors
if [[ "$(printf '%s' "$import_body" | json_field "['created']")" != "1" ]]; then
  echo "Unexpected inventory import create count: $import_body" >&2
  exit 1
fi
if [[ "$(printf '%s' "$import_body" | json_field "['updated']")" != "0" ]]; then
  echo "Unexpected inventory import update count: $import_body" >&2
  exit 1
fi

inventory_import_payload="$(api_json GET "$API_BASE_URL/api/inventory?search=$smoke_import_asset_tag&page=1&pageSize=5" "$token")"
printf '%s' "$inventory_import_payload" | json_require_keys items total summary groups
created_inventory_import_id="$(printf '%s' "$inventory_import_payload" | SMOKE_ASSET_TAG="$smoke_import_asset_tag" python3 -c 'import json, os, sys; payload = json.load(sys.stdin); target = os.environ["SMOKE_ASSET_TAG"]; matches = [item.get("id", "") for item in payload.get("items", []) if item.get("assetTag") == target]; print(matches[0] if matches else "")')"
if [[ -z "$created_inventory_import_id" ]]; then
  echo "Imported inventory item was not returned by inventory search." >&2
  exit 1
fi

api_request DELETE "$API_BASE_URL/api/inventory/$created_inventory_import_id" "$token"
printf '%s' "$API_BODY" | json_require_keys status
if [[ "$(printf '%s' "$API_BODY" | json_field "['status']")" != "deleted" ]]; then
  echo "Unexpected imported inventory delete response: $API_BODY" >&2
  exit 1
fi
created_inventory_import_id=""

smoke_invalid_import_csv_file="$(mktemp)"
cat > "$smoke_invalid_import_csv_file" <<EOF
Item Code,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status
NC-$smoke_inventory_suffix,Missing Category $smoke_inventory_suffix,NCA-$smoke_inventory_suffix,NCS-$smoke_inventory_suffix,missing category,$inventory_branch_id,,2027-01-01,50000,inventory
EOF

invalid_import_response_file="$(mktemp)"
invalid_import_status="$(curl -sS -o "$invalid_import_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -F "file=@$smoke_invalid_import_csv_file;type=text/csv" "$API_BASE_URL/api/inventory/import" || true)"
invalid_import_body="$(cat "$invalid_import_response_file")"
rm -f "$invalid_import_response_file" "$smoke_invalid_import_csv_file"

expect_http_error "400" "$invalid_import_status" "$invalid_import_body" "csv must include category column" "inventory import missing category validation"

smoke_duplicate_import_csv_file="$(mktemp)"
smoke_duplicate_item_code_one="D1-$smoke_inventory_suffix"
smoke_duplicate_item_code_two="D2-$smoke_inventory_suffix"
smoke_duplicate_asset_tag="DA-$smoke_inventory_suffix"
cat > "$smoke_duplicate_import_csv_file" <<EOF
Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status
$smoke_duplicate_item_code_one,Laptop,Duplicate One $smoke_inventory_suffix,$smoke_duplicate_asset_tag,DS1-$smoke_inventory_suffix,duplicate first row,$inventory_branch_id,,2027-01-01,50000,inventory
$smoke_duplicate_item_code_two,Laptop,Duplicate Two $smoke_inventory_suffix,$smoke_duplicate_asset_tag,DS2-$smoke_inventory_suffix,duplicate second row,$inventory_branch_id,,2027-01-01,50000,inventory
EOF

duplicate_import_response_file="$(mktemp)"
duplicate_import_status="$(curl -sS -o "$duplicate_import_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -F "file=@$smoke_duplicate_import_csv_file;type=text/csv" "$API_BASE_URL/api/inventory/import" || true)"
duplicate_import_body="$(cat "$duplicate_import_response_file")"
rm -f "$duplicate_import_response_file" "$smoke_duplicate_import_csv_file"

if [[ "$duplicate_import_status" != "200" ]]; then
  echo "inventory import duplicate-row validation returned unexpected status: $duplicate_import_status" >&2
  if [[ -n "$duplicate_import_body" ]]; then
    echo "$duplicate_import_body" >&2
  fi
  exit 1
fi

printf '%s' "$duplicate_import_body" | json_require_keys created updated errors
if [[ "$(printf '%s' "$duplicate_import_body" | json_field "['created']")" != "1" ]]; then
  echo "Unexpected duplicate import create count: $duplicate_import_body" >&2
  exit 1
fi
if [[ "$(printf '%s' "$duplicate_import_body" | json_field "['updated']")" != "0" ]]; then
  echo "Unexpected duplicate import update count: $duplicate_import_body" >&2
  exit 1
fi
duplicate_import_error_row="$(printf '%s' "$duplicate_import_body" | json_field "['errors'][0]['row']")"
duplicate_import_error_message="$(printf '%s' "$duplicate_import_body" | json_field "['errors'][0]['message']")"
if [[ "$duplicate_import_error_row" != "3" || "$duplicate_import_error_message" != "duplicate asset_tag in file" ]]; then
  echo "Unexpected duplicate import validation response: $duplicate_import_body" >&2
  exit 1
fi

inventory_duplicate_payload="$(api_json GET "$API_BASE_URL/api/inventory?search=$smoke_duplicate_asset_tag&page=1&pageSize=5" "$token")"
printf '%s' "$inventory_duplicate_payload" | json_require_keys items total summary groups
created_inventory_duplicate_id="$(printf '%s' "$inventory_duplicate_payload" | SMOKE_ASSET_TAG="$smoke_duplicate_asset_tag" python3 -c 'import json, os, sys; payload = json.load(sys.stdin); target = os.environ["SMOKE_ASSET_TAG"]; matches = [item.get("id", "") for item in payload.get("items", []) if item.get("assetTag") == target]; print(matches[0] if matches else "")')"
if [[ -z "$created_inventory_duplicate_id" ]]; then
  echo "Duplicate import first row was not returned by inventory search." >&2
  exit 1
fi

api_request DELETE "$API_BASE_URL/api/inventory/$created_inventory_duplicate_id" "$token"
printf '%s' "$API_BODY" | json_require_keys status
if [[ "$(printf '%s' "$API_BODY" | json_field "['status']")" != "deleted" ]]; then
  echo "Unexpected duplicate import cleanup delete response: $API_BODY" >&2
  exit 1
fi
created_inventory_duplicate_id=""

smoke_db_duplicate_asset_tag="EA-$smoke_inventory_suffix"
smoke_db_duplicate_serial="ES-$smoke_inventory_suffix"
smoke_db_duplicate_seed_payload="$(printf '{"category":"Laptop","name":"DB Dup %s","assetTag":"%s","serialNumber":"%s","specs":"db duplicate seed","branchId":"%s","status":"inventory"}' "$smoke_inventory_suffix" "$smoke_db_duplicate_asset_tag" "$smoke_db_duplicate_serial" "$inventory_branch_id")"

api_request POST "$API_BASE_URL/api/inventory" "$token" "$smoke_db_duplicate_seed_payload"
printf '%s' "$API_BODY" | json_require_keys id itemCode
created_inventory_db_duplicate_id="$(printf '%s' "$API_BODY" | json_field "['id']")"

smoke_db_duplicate_import_csv_file="$(mktemp)"
cat > "$smoke_db_duplicate_import_csv_file" <<EOF
Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status
ED-$smoke_inventory_suffix,Laptop,Existing Duplicate $smoke_inventory_suffix,$smoke_db_duplicate_asset_tag,$smoke_db_duplicate_serial,db duplicate,$inventory_branch_id,,2027-01-01,50000,inventory
EOF

db_duplicate_import_response_file="$(mktemp)"
db_duplicate_import_status="$(curl -sS -o "$db_duplicate_import_response_file" -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -F "file=@$smoke_db_duplicate_import_csv_file;type=text/csv" "$API_BASE_URL/api/inventory/import" || true)"
db_duplicate_import_body="$(cat "$db_duplicate_import_response_file")"
rm -f "$db_duplicate_import_response_file" "$smoke_db_duplicate_import_csv_file"

if [[ "$db_duplicate_import_status" != "200" ]]; then
  echo "inventory import database-duplicate validation returned unexpected status: $db_duplicate_import_status" >&2
  if [[ -n "$db_duplicate_import_body" ]]; then
    echo "$db_duplicate_import_body" >&2
  fi
  exit 1
fi

printf '%s' "$db_duplicate_import_body" | json_require_keys created updated errors
if [[ "$(printf '%s' "$db_duplicate_import_body" | json_field "['created']")" != "0" ]]; then
  echo "Unexpected database duplicate import create count: $db_duplicate_import_body" >&2
  exit 1
fi
if [[ "$(printf '%s' "$db_duplicate_import_body" | json_field "['updated']")" != "0" ]]; then
  echo "Unexpected database duplicate import update count: $db_duplicate_import_body" >&2
  exit 1
fi
db_duplicate_import_error_row="$(printf '%s' "$db_duplicate_import_body" | json_field "['errors'][0]['row']")"
db_duplicate_import_error_message="$(printf '%s' "$db_duplicate_import_body" | json_field "['errors'][0]['message']")"
if [[ "$db_duplicate_import_error_row" != "2" || "$db_duplicate_import_error_message" != "asset_tag or serial_number already exists in database" ]]; then
  echo "Unexpected database duplicate import validation response: $db_duplicate_import_body" >&2
  exit 1
fi

api_request DELETE "$API_BASE_URL/api/inventory/$created_inventory_db_duplicate_id" "$token"
printf '%s' "$API_BODY" | json_require_keys status
if [[ "$(printf '%s' "$API_BODY" | json_field "['status']")" != "deleted" ]]; then
  echo "Unexpected database duplicate cleanup delete response: $API_BODY" >&2
  exit 1
fi
created_inventory_db_duplicate_id=""

echo "inventory items: $inventory_total"
echo "inventory visible branches: $inventory_branch_count"
echo "inventory import template header: ok"
echo "inventory create/delete live path: ok ($created_inventory_item_code)"
echo "inventory csv import live path: ok ($smoke_import_item_code)"
echo "inventory csv negative path: ok (missing category rejected)"
echo "inventory csv duplicate-row path: ok (duplicate asset_tag rejected)"
echo "inventory csv database-duplicate path: ok (existing asset rejected)"
if [[ -n "$terminal_hostname" ]]; then
  echo "terminal target path: ok ($terminal_hostname -> $terminal_minion_id)"
  echo "terminal blocked command path: ok"
  echo "terminal target missing path: ok"
else
  echo "terminal target path: skipped (no device hostname available)"
fi
if [[ -n "$ssh_asset_id" ]]; then
  echo "ssh target path: ok ($ssh_asset_id)"
  echo "ssh target missing path: ok"
else
  echo "ssh target path: skipped (no device id available)"
fi

echo
echo "Smoke test completed successfully."