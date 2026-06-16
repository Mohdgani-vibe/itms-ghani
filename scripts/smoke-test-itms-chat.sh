#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage:
  scripts/smoke-test-itms-chat.sh [options]

Options:
  --skip-build   Skip the frontend production build after the focused chat suite
  --help         Show this message
EOF
}

log_step() {
  printf '\n[smoke-test-itms-chat] %s\n' "$*"
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
      --skip-build)
        SKIP_BUILD=1
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

main() {
  parse_args "$@"

  require_command npm

  cd "$REPO_ROOT/frontend"

  log_step 'Running focused chat, dashboard, and recent-chat Vitest coverage'
  npm test -- \
    ChatChannelSidebar.test.tsx \
    Chat.helpers.test.ts \
    Chat.test.tsx \
    DashboardPage.test.tsx \
    DashboardPage.helpers.test.ts \
    RecentChatPanel.test.tsx

  if [[ "$SKIP_BUILD" -eq 1 ]]; then
    log_step 'Skipping frontend production build'
    return 0
  fi

  log_step 'Building frontend production bundle for preview/nginx parity'
  npm run build

  log_step 'Chat smoke test completed successfully'
}

main "$@"