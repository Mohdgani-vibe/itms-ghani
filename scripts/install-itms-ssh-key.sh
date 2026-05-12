#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-itms-ssh-key.sh [target-user] [authorized-key]

Input sources for the authorized key, in priority order:
  1. positional argument 2
  2. ITMS_AUTHORIZED_KEY
  3. ITMS_AUTHORIZED_KEY_FILE
EOF
}

TARGET_USER="${1:-zerodha-admin}"
AUTHORIZED_KEY="${2:-${ITMS_AUTHORIZED_KEY:-}}"
AUTHORIZED_KEY_FILE="${ITMS_AUTHORIZED_KEY_FILE:-}"
RESTART_SALT="${RESTART_SALT:-1}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$AUTHORIZED_KEY" && -n "$AUTHORIZED_KEY_FILE" ]]; then
  [[ -f "$AUTHORIZED_KEY_FILE" ]] || {
    echo "Authorized key file not found: $AUTHORIZED_KEY_FILE" >&2
    exit 1
  }
  AUTHORIZED_KEY="$(head -n 1 "$AUTHORIZED_KEY_FILE" | tr -d '\r')"
fi

if [[ -z "$AUTHORIZED_KEY" ]]; then
  echo "An authorized public key is required. Pass it as argument 2, ITMS_AUTHORIZED_KEY, or ITMS_AUTHORIZED_KEY_FILE." >&2
  exit 1
fi

if ! id "$TARGET_USER" >/dev/null 2>&1; then
  echo "Target user '$TARGET_USER' does not exist." >&2
  exit 1
fi

TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if [[ -z "$TARGET_HOME" || ! -d "$TARGET_HOME" ]]; then
  echo "Home directory for '$TARGET_USER' was not found." >&2
  exit 1
fi

SSH_DIR="$TARGET_HOME/.ssh"
AUTHORIZED_KEYS_FILE="$SSH_DIR/authorized_keys"

mkdir -p "$SSH_DIR"
touch "$AUTHORIZED_KEYS_FILE"

if ! grep -Fqx "$AUTHORIZED_KEY" "$AUTHORIZED_KEYS_FILE"; then
  printf '%s\n' "$AUTHORIZED_KEY" >> "$AUTHORIZED_KEYS_FILE"
  echo "Added ITMS SSH key for '$TARGET_USER'."
else
  echo "ITMS SSH key already present for '$TARGET_USER'."
fi

chown "$TARGET_USER":"$TARGET_USER" "$SSH_DIR" "$AUTHORIZED_KEYS_FILE"
chmod 700 "$SSH_DIR"
chmod 600 "$AUTHORIZED_KEYS_FILE"

if [[ "$RESTART_SALT" == "1" ]] && command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files salt-minion.service >/dev/null 2>&1; then
    systemctl restart salt-minion || true
    systemctl status --no-pager salt-minion || true
  fi
fi

echo
echo "Configured user: $TARGET_USER"
echo "Authorized keys file: $AUTHORIZED_KEYS_FILE"
if command -v ssh-keygen >/dev/null 2>&1; then
  key_fingerprint="$(printf '%s\n' "$AUTHORIZED_KEY" | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')"
  if [[ -n "$key_fingerprint" ]]; then
    echo "Installed key fingerprint: $key_fingerprint"
  fi
fi