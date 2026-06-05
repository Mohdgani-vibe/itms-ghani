#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
DATABASE_DIR="$REPO_ROOT/database"
COMMIT_MESSAGE="full project migration"
DB_MODE="docker"
DB_CONTAINER="zerodha-itms-postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="itms"
DB_USER="postgres"
REMOTE_NAME="origin"
REMOTE_URL=""
PUSH_BRANCH="main"
STAGE_ALL=0

usage() {
  cat <<'EOF'
Usage:
  export-and-push-project.sh [options]

Options:
  --db-mode docker|host       Database export mode. Default: docker
  --db-container NAME         PostgreSQL container name. Default: zerodha-itms-postgres
  --db-host HOST              PostgreSQL host for host mode. Default: localhost
  --db-port PORT              PostgreSQL port for host mode. Default: 5432
  --db-name NAME              Database name. Default: itms
  --db-user USER              Database user. Default: postgres
  --remote-name NAME          Git remote name. Default: origin
  --remote-url URL            Set or replace the push remote before pushing
  --branch NAME               Branch to push. Default: main
  --commit-message MESSAGE    Commit message. Default: full project migration
  --stage-all                 Stage the full worktree instead of migration files only
  --help                      Show this help message

Environment:
  PGPASSWORD                  Password for pg_dump in host mode
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

append_if_missing() {
  local file="$1"
  local line="$2"
  if ! grep -Fxq "$line" "$file"; then
    printf '\n%s\n' "$line" >> "$file"
  fi
}

write_empty_env_example() {
  local source_file="$1"
  local output_file="$2"
  awk -F '=' '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      key=$1
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      if (key != "") {
        print key "="
      }
    }
  ' "$source_file" > "$output_file"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --db-mode)
        DB_MODE="$2"
        shift 2
        ;;
      --db-container)
        DB_CONTAINER="$2"
        shift 2
        ;;
      --db-host)
        DB_HOST="$2"
        shift 2
        ;;
      --db-port)
        DB_PORT="$2"
        shift 2
        ;;
      --db-name)
        DB_NAME="$2"
        shift 2
        ;;
      --db-user)
        DB_USER="$2"
        shift 2
        ;;
      --remote-name)
        REMOTE_NAME="$2"
        shift 2
        ;;
      --remote-url)
        REMOTE_URL="$2"
        shift 2
        ;;
      --branch)
        PUSH_BRANCH="$2"
        shift 2
        ;;
      --commit-message)
        COMMIT_MESSAGE="$2"
        shift 2
        ;;
      --stage-all)
        STAGE_ALL=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ "$DB_MODE" != "docker" && "$DB_MODE" != "host" ]]; then
    echo "--db-mode must be either docker or host" >&2
    exit 1
  fi
}

verify_repo() {
  require_command git
  require_command awk
  require_command grep
  require_command sed

  if [[ ! -d "$REPO_ROOT/.git" ]]; then
    echo "Git repository not initialized at $REPO_ROOT" >&2
    exit 1
  fi
}

prepare_gitignore() {
  local gitignore_file="$REPO_ROOT/.gitignore"

  touch "$gitignore_file"
  append_if_missing "$gitignore_file" "logs"
  append_if_missing "$gitignore_file" "*.log"
  append_if_missing "$gitignore_file" "node_modules"
  append_if_missing "$gitignore_file" "__pycache__/"
  append_if_missing "$gitignore_file" "backend/.env"
  append_if_missing "$gitignore_file" "backend/.env.secrets"
}

prepare_env_examples() {
  if [[ -f "$BACKEND_DIR/.env" ]]; then
    write_empty_env_example "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.example"
  elif [[ -f "$BACKEND_DIR/.env.example" ]]; then
    write_empty_env_example "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env.example.tmp"
    mv "$BACKEND_DIR/.env.example.tmp" "$BACKEND_DIR/.env.example"
  else
    echo "Missing backend env source file: $BACKEND_DIR/.env or $BACKEND_DIR/.env.example" >&2
    exit 1
  fi

  if [[ -f "$BACKEND_DIR/.env.secrets" ]]; then
    write_empty_env_example "$BACKEND_DIR/.env.secrets" "$BACKEND_DIR/.env.secrets.example"
  elif [[ ! -f "$BACKEND_DIR/.env.secrets.example" ]]; then
    cat > "$BACKEND_DIR/.env.secrets.example" <<'EOF'
JWT_SECRET=
DEFAULT_ADMIN_PASSWORD=
SALT_API_TOKEN=
SALT_API_USERNAME=
SALT_API_PASSWORD=
WAZUH_API_USERNAME=
WAZUH_API_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MATTERMOST_TOKEN=
SSH_TERMINAL_PRIVATE_KEY=
EOF
  fi
}

export_database() {
  require_command mkdir
  mkdir -p "$DATABASE_DIR"

  if [[ "$DB_MODE" == "docker" ]]; then
    require_command docker
    docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges > "$DATABASE_DIR/backup.sql"
  else
    require_command pg_dump
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges > "$DATABASE_DIR/backup.sql"
  fi

  if [[ ! -s "$DATABASE_DIR/backup.sql" ]]; then
    echo "Database export failed: $DATABASE_DIR/backup.sql is empty" >&2
    exit 1
  fi
}

prepare_git_remote() {
  if [[ -n "$REMOTE_URL" ]]; then
    if git -C "$REPO_ROOT" remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
      git -C "$REPO_ROOT" remote set-url "$REMOTE_NAME" "$REMOTE_URL"
    else
      git -C "$REPO_ROOT" remote add "$REMOTE_NAME" "$REMOTE_URL"
    fi
  fi
}

stage_migration_files() {
  local path
  local migration_paths=(
    ".gitignore"
    "backend/.env.example"
    "backend/.env.secrets.example"
    "database/backup.sql"
    "scripts/export-and-push-project.sh"
    "scripts/setup-new-server.sh"
  )

  git -C "$REPO_ROOT" add -N -- "${migration_paths[@]}" >/dev/null 2>&1 || true
  for path in "${migration_paths[@]}"; do
    if [[ -e "$REPO_ROOT/$path" ]]; then
      git -C "$REPO_ROOT" add -- "$path"
    fi
  done
}

stage_commit_push() {
  if [[ "$STAGE_ALL" -eq 1 ]]; then
    git -C "$REPO_ROOT" add .
  else
    stage_migration_files
  fi

  if git -C "$REPO_ROOT" diff --cached --name-only | grep -E '(^|/)\.env($|/)|(^|/)\.env\.secrets($|/)|(^|/)backend/\.env($|/)|(^|/)backend/\.env\.secrets($|/)' >/dev/null 2>&1; then
    echo "Refusing to continue because an env file is staged." >&2
    git -C "$REPO_ROOT" diff --cached --name-only | grep -E '(^|/)\.env($|/)|(^|/)\.env\.secrets($|/)|(^|/)backend/\.env($|/)|(^|/)backend/\.env\.secrets($|/)'
    exit 1
  fi

  git -C "$REPO_ROOT" branch -M "$PUSH_BRANCH"

  if [[ "$STAGE_ALL" -ne 1 ]]; then
    echo "Staging migration files only. Use --stage-all to commit the full worktree."
  fi

  if ! git -C "$REPO_ROOT" diff --cached --quiet; then
    git -C "$REPO_ROOT" commit -m "$COMMIT_MESSAGE"
  else
    echo "No staged changes to commit."
  fi

  if ! git -C "$REPO_ROOT" remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
    echo "Remote '$REMOTE_NAME' is not configured. Use --remote-url URL." >&2
    exit 1
  fi

  git -C "$REPO_ROOT" push -u "$REMOTE_NAME" "$PUSH_BRANCH"
}

main() {
  parse_args "$@"
  verify_repo
  prepare_gitignore
  prepare_env_examples
  export_database
  prepare_git_remote
  stage_commit_push

  echo
  echo "Migration export complete."
  echo "Database dump: $DATABASE_DIR/backup.sql"
  echo "Backend example: $BACKEND_DIR/.env.example"
  echo "Secrets example: $BACKEND_DIR/.env.secrets.example"
}

main "$@"