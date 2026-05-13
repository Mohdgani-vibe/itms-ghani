#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$BACKEND_DIR/.env}"
BACKEND_SECRETS_FILE="${BACKEND_SECRETS_FILE:-$BACKEND_DIR/.env.secrets}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"
BACKEND_PORT="${BACKEND_PORT:-3001}"

prefer_ssh_terminal_identity() {
  local ssh_home
  local rsa_key
  local rsa_cert
  local known_hosts_path

  ssh_home="${HOME}/.ssh"
  rsa_key="${ssh_home}/id_rsa"
  rsa_cert="${ssh_home}/id_rsa-cert.pub"
  known_hosts_path="${ssh_home}/known_hosts"

  if [[ -f "$rsa_key" ]]; then
    export SSH_TERMINAL_PRIVATE_KEY_PATH="$rsa_key"
  fi

  if [[ -f "$rsa_cert" ]]; then
    export SSH_TERMINAL_CERTIFICATE_PATH="$rsa_cert"
  fi

  if [[ -f "$known_hosts_path" && -z "${SSH_TERMINAL_KNOWN_HOSTS_PATH:-}" ]]; then
    export SSH_TERMINAL_KNOWN_HOSTS_PATH="$known_hosts_path"
  fi
}

log_ssh_terminal_identity() {
  if [[ -z "${SSH_TERMINAL_USERNAME:-}" ]]; then
    return
  fi

  echo "SSH terminal identity: usernames=${SSH_TERMINAL_USERNAME} key=${SSH_TERMINAL_PRIVATE_KEY_PATH:-unset} cert=${SSH_TERMINAL_CERTIFICATE_PATH:-unset} known_hosts=${SSH_TERMINAL_KNOWN_HOSTS_PATH:-unset}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command curl
require_command docker
require_command ss
require_command ps

if [[ -f "$REPO_ROOT/scripts/load-itms-backend-env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$REPO_ROOT/scripts/load-itms-backend-env.sh"
fi
prefer_ssh_terminal_identity
log_ssh_terminal_identity

latest_backend_source_epoch() {
  {
    stat -c '%Y' "$BACKEND_DIR/Dockerfile" "$COMPOSE_FILE" "$BACKEND_DIR/go.mod" "$BACKEND_DIR/go.sum" 2>/dev/null || true
    find \
      "$BACKEND_DIR/cmd" \
      "$BACKEND_DIR/internal" \
      "$BACKEND_DIR/pkg" \
      "$BACKEND_DIR/data/db/postgres_migrations" \
      -type f -printf '%T@\n' 2>/dev/null || true
  } | awk 'BEGIN { max = 0 } { if ($1 > max) max = $1 } END { printf "%.0f\n", max }'
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
    return 0
  fi

  echo "Neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
}

backend_container_id() {
  compose ps -q backend 2>/dev/null | head -n 1 || true
}

backend_container_started_epoch() {
  local container_id="$1"
  local started_at

  [[ -z "$container_id" ]] && return 1
  started_at="$(docker inspect --format '{{.State.StartedAt}}' "$container_id" 2>/dev/null || true)"
  [[ -z "$started_at" ]] && return 1
  date -d "$started_at" +%s 2>/dev/null || return 1
}

backend_source_newer_than_container() {
  local container_id
  local source_epoch
  local started_epoch

  container_id="$(backend_container_id)"
  [[ -z "$container_id" ]] && return 1

  source_epoch="$(latest_backend_source_epoch)"
  started_epoch="$(backend_container_started_epoch "$container_id")" || return 1
  [[ -z "$source_epoch" || -z "$started_epoch" ]] && return 1

  (( source_epoch > started_epoch ))
}

remove_backend_service_containers() {
  local container_ids

  container_ids="$(docker ps -aq --filter label=com.docker.compose.service=backend 2>/dev/null || true)"
  if [[ -n "$container_ids" ]]; then
    docker rm -f $container_ids >/dev/null 2>&1 || true
  fi
}

backend_healthy() {
  curl -fsS "$HEALTH_URL" >/dev/null 2>&1
}

find_backend_pids() {
  ss -ltnp "( sport = :${BACKEND_PORT} )" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u
}

kill_stale_backend_processes() {
  local pid
  local cmdline

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    cmdline="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    [[ -z "$cmdline" ]] && continue

    if [[ "$cmdline" == *"go run ./cmd/server"* ]] || [[ "$cmdline" == *"/app/itms-server"* ]] || [[ "$cmdline" == *"/bin/itms-server"* ]] || [[ "$cmdline" == *"make run"* ]] || [[ "$cmdline" == *"/cmd/server"* ]]; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      if ps -p "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
  done < <(find_backend_pids)
}

remove_exited_backend_container() {
  local container_id
  local state

  container_id="$(compose ps -q backend 2>/dev/null || true)"
  [[ -z "$container_id" ]] && return 0

  state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
  if [[ "$state" != "running" && -n "$state" ]]; then
    compose rm -f backend >/dev/null
  fi
}

refresh_backend_container() {
  compose up -d postgres
  compose build backend
  compose stop backend >/dev/null 2>&1 || true
  compose rm -f backend >/dev/null 2>&1 || true
  remove_backend_service_containers
  compose up -d backend
}

wait_for_backend() {
  local attempt
  for attempt in $(seq 1 30); do
    if backend_healthy; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if backend_healthy; then
  if backend_source_newer_than_container; then
    echo "Backend healthy at $HEALTH_URL, but backend source is newer than the running container. Refreshing backend..."
  else
    echo "Backend already healthy at $HEALTH_URL"
    exit 0
  fi
fi

kill_stale_backend_processes
remove_exited_backend_container

refresh_backend_container

if ! wait_for_backend; then
  echo "Backend did not become healthy at $HEALTH_URL" >&2
  compose ps >&2 || true
  exit 1
fi

compose ps
curl -fsS "$HEALTH_URL"
echo