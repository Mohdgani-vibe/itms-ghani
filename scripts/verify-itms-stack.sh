#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/backend/docker-compose.yml"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"
USE_SUDO=0

if [[ "${1:-}" == "--sudo" ]]; then
  USE_SUDO=1
fi

docker_cmd() {
  if [[ "$USE_SUDO" -eq 1 ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

compose_cmd() {
  if docker_cmd compose version >/dev/null 2>&1; then
    docker_cmd compose -f "$COMPOSE_FILE" "$@"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    if [[ "$USE_SUDO" -eq 1 ]]; then
      sudo docker-compose -f "$COMPOSE_FILE" "$@"
    else
      docker-compose -f "$COMPOSE_FILE" "$@"
    fi
    return 0
  fi

  echo "Missing required compose command: docker compose or docker-compose" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command curl
require_command docker

compose_service_health() {
  local service_name="$1"
  local container_id

  container_id="$(compose_cmd ps -q "$service_name" 2>/dev/null | head -n 1 | tr -d '\r')"
  if [[ -z "$container_id" ]]; then
    printf 'missing\n'
    return 0
  fi

  docker_cmd inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf 'missing\n'
}

echo "Checking Docker Compose services..."
compose_cmd ps

echo
echo "Checking container health..."
backend_health="$(compose_service_health backend)"
postgres_health="$(compose_service_health postgres)"
echo "backend:  ${backend_health:-missing}"
echo "postgres: ${postgres_health:-missing}"

echo
echo "Checking API health endpoint: $HEALTH_URL"
curl -fsS "$HEALTH_URL"
echo
echo
echo "ITMS stack verification completed."