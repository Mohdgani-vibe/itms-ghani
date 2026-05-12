#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$REPO_ROOT/backend/.env"
REPO_INSTALLER="$REPO_ROOT/scripts/install-itms-agent.sh"
DEPLOYED_INSTALLER_PATH="${DEPLOYED_INSTALLER_PATH:-/var/www/itms/installers/install-itms-agent.sh}"
PUBLIC_SERVER_URL_DEFAULT="http://YOUR_SERVER_IP"
INSTALLER_URL="${INSTALLER_URL:-}"

usage() {
  cat <<'EOF'
Usage:
  scripts/smoke-test-itms-installer.sh [options]

Options:
  --installer-url URL          Override the live installer URL to verify
  --deployed-path PATH         Override the deployed installer path to compare
  --help                       Show this message
EOF
}

log_step() {
  printf '\n[smoke-test-itms-installer] %s\n' "$*"
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
      --installer-url)
        INSTALLER_URL="${2:-}"
        shift 2
        ;;
      --deployed-path)
        DEPLOYED_INSTALLER_PATH="${2:-}"
        shift 2
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

assert_contains() {
  local file_path="$1"
  local expected="$2"
  if ! grep -Fq -- "$expected" "$file_path"; then
    fail "Expected to find '$expected' in $file_path"
  fi
}

assert_not_contains() {
  local file_path="$1"
  local unexpected="$2"
  if grep -Fq -- "$unexpected" "$file_path"; then
    fail "Did not expect to find '$unexpected' in $file_path"
  fi
}

resolve_installer_url() {
  if [[ -n "$INSTALLER_URL" ]]; then
    printf '%s\n' "$INSTALLER_URL"
    return
  fi

  local public_server_url="$PUBLIC_SERVER_URL_DEFAULT"
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

  printf '%s/installers/install-itms-agent.sh\n' "${public_server_url%/}"
}

main() {
  parse_args "$@"

  require_command bash
  require_command cmp
  require_command curl
  require_command grep
  require_command mktemp

  [[ -f "$REPO_INSTALLER" ]] || fail "Repository installer not found: $REPO_INSTALLER"
  [[ -f "$DEPLOYED_INSTALLER_PATH" ]] || fail "Deployed installer not found: $DEPLOYED_INSTALLER_PATH"

  local live_installer_url
  live_installer_url="$(resolve_installer_url)"

  log_step 'Checking shell syntax for repository and deployed installers'
  bash -n "$REPO_INSTALLER"
  bash -n "$DEPLOYED_INSTALLER_PATH"

  log_step 'Comparing repository installer to deployed web-root copy'
  cmp -s "$REPO_INSTALLER" "$DEPLOYED_INSTALLER_PATH" || fail 'Repository installer and deployed installer differ.'

  log_step "Downloading live installer from $live_installer_url"
  local live_copy
  live_copy="$(mktemp)"
  trap "rm -f '$live_copy'" EXIT
  curl -fsSL "$live_installer_url" -o "$live_copy"
  bash -n "$live_copy"
  cmp -s "$live_copy" "$DEPLOYED_INSTALLER_PATH" || fail 'Live installer download and deployed installer differ.'

  log_step 'Checking required Salt, Wazuh, and OpenSCAP safeguards'
  assert_contains "$live_copy" 'SALT_BOOTSTRAP_URL="${ITMS_SALT_BOOTSTRAP_URL:-https://github.com/saltstack/salt-bootstrap/releases/latest/download/bootstrap-salt.sh}"'
  assert_contains "$live_copy" 'SALT_BOOTSTRAP_VERSION="${ITMS_SALT_BOOTSTRAP_VERSION:-3006}"'
  assert_contains "$live_copy" 'REQUIRE_SALT="${ITMS_REQUIRE_SALT:-false}"'
  assert_contains "$live_copy" 'install_salt_minion_with_bootstrap() {'
  assert_contains "$live_copy" 'Installing Salt Minion via bootstrap-salt stable ${SALT_BOOTSTRAP_VERSION}'
  assert_contains "$live_copy" 'bash "$bootstrap_script" stable "$SALT_BOOTSTRAP_VERSION"'
  assert_contains "$live_copy" '--require-salt           Fail the bootstrap if Salt installation does not succeed'
  assert_contains "$live_copy" 'OPENSCAP_PROFILE="${ITMS_OPENSCAP_PROFILE:-auto}"'
  assert_contains "$live_copy" 'resolve_openscap_profile() {'
  assert_contains "$live_copy" 'PROFILE="${ITMS_OPENSCAP_PROFILE:-}"'
  assert_contains "$live_copy" "for unsupported_agent in list(target_root.findall('agent')):"
  assert_contains "$live_copy" 'curl -fsSL http://itms.example.com/installers/install-itms-agent.sh | sudo bash -s --'
  assert_not_contains "$live_copy" 'https://bootstrap.saltproject.io'
  assert_not_contains "$live_copy" 'PROFILE="${ITMS_OPENSCAP_PROFILE:-xccdf_org.ssgproject.content_profile_standard}"'

  log_step 'Installer smoke test completed successfully'
}

main "$@"