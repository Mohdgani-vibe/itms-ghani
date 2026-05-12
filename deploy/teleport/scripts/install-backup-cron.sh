#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-teleport.sh"

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  chmod 0755 "$BACKUP_SCRIPT"
fi

TMP_CRON="$(mktemp)"
trap 'rm -f "$TMP_CRON"' EXIT

crontab -l 2>/dev/null | grep -v 'backup-teleport.sh' > "$TMP_CRON" || true
printf '17 2 * * * %s >> /var/log/teleport-backup.log 2>&1\n' "$BACKUP_SCRIPT" >> "$TMP_CRON"
crontab "$TMP_CRON"

echo "Installed daily Teleport backup cron at 02:17 server time."
