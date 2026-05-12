#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this script with sudo or as root."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ROOT="$REPO_ROOT/scripts/salt"
TARGET_ROOT="${SALT_FILESERVER_ROOT:-/srv/salt}"
ITMS_FILES_DIR="$TARGET_ROOT/itms/files"

if [[ ! -d "$SOURCE_ROOT" ]]; then
  echo "Missing source Salt tree: $SOURCE_ROOT" >&2
  exit 1
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_command install
require_command rsync

mkdir -p "$TARGET_ROOT"

rsync -a --delete "$SOURCE_ROOT/" "$TARGET_ROOT/"
mkdir -p "$ITMS_FILES_DIR"
install -m 0644 "$REPO_ROOT/scripts/push-system-inventory.py" "$ITMS_FILES_DIR/push-system-inventory.py"
install -m 0644 "$REPO_ROOT/scripts/push-system-inventory.ps1" "$ITMS_FILES_DIR/push-system-inventory.ps1"

echo "Synced repo Salt states into $TARGET_ROOT"
echo
find "$TARGET_ROOT" -maxdepth 4 -type f | sort