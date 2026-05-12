#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$STACK_ROOT/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require docker
require bash

bash "$SCRIPT_DIR/render-configs.sh"

resolve_teleport_container() {
  if [[ -n "${TELEPORT_CONTAINER:-}" ]]; then
    if docker ps --format '{{.Names}}' | grep -Fxq "$TELEPORT_CONTAINER"; then
      printf '%s\n' "$TELEPORT_CONTAINER"
      return 0
    fi
    echo "Configured TELEPORT_CONTAINER is not running: $TELEPORT_CONTAINER" >&2
    exit 1
  fi

  local service_name="${TELEPORT_SERVICE:-teleport-1}"
  local container_name
  container_name="$(docker ps --filter "label=com.docker.compose.service=${service_name}" --format '{{.Names}}' | head -n1)"
  if [[ -z "$container_name" ]]; then
    echo "Teleport container for service ${service_name} is not running." >&2
    exit 1
  fi

  printf '%s\n' "$container_name"
}

ADMIN_USER="${ADMIN_USER:-zerodha-admin}"
ADMIN_ROLES="${ADMIN_ROLES:-access,editor,zerodha-staging-ops,zerodha-monitoring-ops}"
TELEPORT_CONTAINER_NAME="$(resolve_teleport_container)"

docker exec "$TELEPORT_CONTAINER_NAME" tctl create -f /etc/teleport/dynamic/team-roles.yaml

if ! docker exec "$TELEPORT_CONTAINER_NAME" tctl users ls | grep -q "^${ADMIN_USER}[[:space:]]"; then
  docker exec "$TELEPORT_CONTAINER_NAME" tctl users add "$ADMIN_USER" --roles="$ADMIN_ROLES"
fi

echo "Teleport bootstrap complete. Create production access by submitting a request for role zerodha-prod-ops."
