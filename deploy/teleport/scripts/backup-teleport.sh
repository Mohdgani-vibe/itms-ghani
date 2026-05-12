#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"
INCLUDE_SECRETS_IN_BACKUP="${INCLUDE_SECRETS_IN_BACKUP:-false}"
AUDIT_EVENTS_DIR="${AUDIT_EVENTS_DIR:-/var/lib/teleport/audit/events}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

archive_root="$(mktemp -d)"
cleanup() {
  rm -rf "$archive_root"
}
trap cleanup EXIT

backup_note() {
  echo "[backup-teleport] $*" >&2
}

collect_teleport_audit_events() {
  local audit_export_root="$archive_root/audit-events"
  local found_events=0
  local container_name service_name

  mkdir -p "$audit_export_root"

  while read -r container_name service_name; do
    [[ -n "$container_name" && -n "$service_name" ]] || continue
    if ! docker exec "$container_name" sh -c "test -d '$AUDIT_EVENTS_DIR'" >/dev/null 2>&1; then
      continue
    fi

    mkdir -p "$audit_export_root/$service_name"
    if docker cp "$container_name:$AUDIT_EVENTS_DIR/." "$audit_export_root/$service_name/" >/dev/null 2>&1; then
      found_events=1
      continue
    fi

    backup_note "Failed to export audit events from $service_name ($container_name)."
  done < <(docker ps --format '{{.Names}} {{.Label "com.docker.compose.service"}}' | awk '$2 ~ /^teleport-[0-9]+$/ { print $1, $2 }')

  if [[ "$found_events" == "1" ]]; then
    tar -C "$archive_root" -czf "$BACKUP_DIR/teleport-audit-events.tgz" audit-events
    return 0
  fi

  rmdir "$audit_export_root" 2>/dev/null || true
  backup_note "No running Teleport node audit-event directories were exported."
  return 0
}

mkdir -p "$BACKUP_ROOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR"

POSTGRES_CONTAINER="$(docker ps --filter label=com.docker.compose.service=postgres --format '{{.Names}}' | head -n1)"
if [[ -z "$POSTGRES_CONTAINER" ]]; then
  echo "Teleport postgres container is not running." >&2
  exit 1
fi

docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$BACKUP_DIR/teleport-postgres.dump"

collect_teleport_audit_events

mkdir -p "$archive_root/runtime"
cp -a "$STACK_ROOT/teleport" "$archive_root/teleport"
cp -a "$STACK_ROOT/docker-compose.yml" "$archive_root/docker-compose.yml"
cp -a "$STACK_ROOT/nginx" "$archive_root/nginx"
cp -a "$STACK_ROOT/monitoring" "$archive_root/monitoring"
cp -a "$STACK_ROOT/.env.example" "$archive_root/.env.example"

if [[ -f "$STACK_ROOT/runtime/nginx.conf" ]]; then
  cp -a "$STACK_ROOT/runtime/nginx.conf" "$archive_root/runtime/nginx.conf"
fi
if [[ -f "$STACK_ROOT/runtime/rsyslog-teleport.conf" ]]; then
  cp -a "$STACK_ROOT/runtime/rsyslog-teleport.conf" "$archive_root/runtime/rsyslog-teleport.conf"
fi
if [[ -f "$STACK_ROOT/runtime/rest_cherrypy.conf" ]]; then
  cp -a "$STACK_ROOT/runtime/rest_cherrypy.conf" "$archive_root/runtime/rest_cherrypy.conf"
fi

if [[ "$INCLUDE_SECRETS_IN_BACKUP" == "true" ]]; then
  [[ -f "$STACK_ROOT/.env" ]] && cp -a "$STACK_ROOT/.env" "$archive_root/.env"
  [[ -f "$STACK_ROOT/runtime/teleport.yaml" ]] && cp -a "$STACK_ROOT/runtime/teleport.yaml" "$archive_root/runtime/teleport.yaml"
else
  cat > "$archive_root/RESTORE-NOTES.txt" <<'EOF'
This backup intentionally excludes live secret material by default.

Excluded unless INCLUDE_SECRETS_IN_BACKUP=true:
- .env
- runtime/teleport.yaml

To restore the stack:
1. Recreate .env from your secret manager or a separately protected backup.
2. Run scripts/render-configs.sh to regenerate runtime/teleport.yaml.
3. Restore the PostgreSQL dump from teleport-postgres.dump.
EOF
fi

tar -C "$archive_root" -czf "$BACKUP_DIR/deploy-config.tgz" .

if [[ -n "${NFS_BACKUP_TARGET:-}" && -d "$NFS_BACKUP_TARGET" ]]; then
  rsync -a "$BACKUP_DIR/" "$NFS_BACKUP_TARGET/$STAMP/"
fi

if [[ -n "${BACKUP_S3_URI:-}" ]] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$BACKUP_DIR/teleport-postgres.dump" "$BACKUP_S3_URI/$STAMP/teleport-postgres.dump"
  aws s3 cp "$BACKUP_DIR/deploy-config.tgz" "$BACKUP_S3_URI/$STAMP/deploy-config.tgz"
  if [[ -f "$BACKUP_DIR/teleport-audit-events.tgz" ]]; then
    aws s3 cp "$BACKUP_DIR/teleport-audit-events.tgz" "$BACKUP_S3_URI/$STAMP/teleport-audit-events.tgz"
  fi
fi

echo "Backup written to $BACKUP_DIR"
