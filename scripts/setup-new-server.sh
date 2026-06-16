#!/usr/bin/env bash
set -euo pipefail

REPO_URL=""
APP_DIR="${HOME}/itms"
SERVER_NAME=""
DB_NAME="itms"
DB_USER="itms_user"
DB_PASSWORD=""
DB_PORT="5432"
PUBLIC_SERVER_URL=""
GO_VERSION="1.22.12"
NODE_MAJOR="22"
ADMIN_EMAIL="admin@zerodha.com"
ADMIN_PASSWORD=""
JWT_SECRET=""
BACKEND_PORT="3001"
SKIP_NGINX=0

usage() {
  cat <<'EOF'
Usage:
  setup-new-server.sh --repo-url URL --server-name HOST_OR_IP [options]

Options:
  --repo-url URL          GitHub repository URL to clone
  --server-name NAME      Public host or IP used by nginx and PUBLIC_SERVER_URL
  --app-dir PATH          Install path. Default: ~/itms
  --db-name NAME          PostgreSQL database name. Default: itms
  --db-user USER          PostgreSQL user. Default: itms_user
  --db-port PORT          PostgreSQL port in DATABASE_URL and restore step. Default: 5432
  --db-password VALUE     PostgreSQL password. If omitted, prompt securely
  --admin-email EMAIL     Admin email. Default: admin@zerodha.com
  --admin-password VALUE  Admin password. If omitted, prompt securely
  --jwt-secret VALUE      JWT secret. If omitted, prompt securely
  --backend-port PORT     Backend listen port and nginx upstream. Default: 3001
  --skip-nginx            Skip nginx configuration and nginx-based verification
  --help                  Show this help message
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

prompt_secret() {
  local prompt="$1"
  local variable_name="$2"
  local value=""

  while [[ -z "$value" ]]; do
    read -rsp "$prompt: " value
    echo
  done

  printf -v "$variable_name" '%s' "$value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url)
        REPO_URL="$2"
        shift 2
        ;;
      --server-name)
        SERVER_NAME="$2"
        shift 2
        ;;
      --app-dir)
        APP_DIR="$2"
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
      --db-port)
        DB_PORT="$2"
        shift 2
        ;;
      --db-password)
        DB_PASSWORD="$2"
        shift 2
        ;;
      --admin-email)
        ADMIN_EMAIL="$2"
        shift 2
        ;;
      --admin-password)
        ADMIN_PASSWORD="$2"
        shift 2
        ;;
      --jwt-secret)
        JWT_SECRET="$2"
        shift 2
        ;;
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --skip-nginx)
        SKIP_NGINX=1
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

  if [[ -z "$REPO_URL" || -z "$SERVER_NAME" ]]; then
    usage >&2
    exit 1
  fi

  PUBLIC_SERVER_URL="http://${SERVER_NAME}"
}

install_system_packages() {
  require_command sudo
  require_command curl

  sudo apt-get update
  sudo apt-get install -y git curl nginx rsync build-essential ca-certificates gnupg lsb-release postgresql postgresql-contrib
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
}

install_go() {
  if command -v go >/dev/null 2>&1; then
    return 0
  fi

  cd /tmp
  curl -LO "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
  if ! grep -Fq '/usr/local/go/bin' "$HOME/.bashrc"; then
    echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.bashrc"
  fi
  export PATH="$PATH:/usr/local/go/bin"
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  sudo npm install -g pm2
}

clone_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    return 0
  fi

  git clone "$REPO_URL" "$APP_DIR"
}

install_project_dependencies() {
  cd "$APP_DIR/frontend"
  npm install

  cd "$APP_DIR/backend"
  go mod download
  go build -o server ./cmd/server
}

setup_postgres() {
  if [[ -z "$DB_PASSWORD" ]]; then
    prompt_secret "Enter PostgreSQL password for ${DB_USER}" DB_PASSWORD
  fi

  (cd /tmp && sudo -u postgres psql) <<EOF
DO
\$do\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$do\$;
EOF

  if ! (cd /tmp && sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'") | grep -q 1; then
    (cd /tmp && sudo -u postgres createdb -O "$DB_USER" "$DB_NAME")
  fi
}

write_env_files() {
  local db_password_encoded

  if [[ -z "$ADMIN_PASSWORD" ]]; then
    prompt_secret "Enter DEFAULT_ADMIN_PASSWORD" ADMIN_PASSWORD
  fi
  if [[ -z "$JWT_SECRET" ]]; then
    prompt_secret "Enter JWT_SECRET" JWT_SECRET
  fi
  db_password_encoded="$(urlencode "$DB_PASSWORD")"

  cd "$APP_DIR/backend"
  cp .env.example .env
  cp .env.secrets.example .env.secrets

  cat > .env <<EOF
BACKEND_ADDR=:${BACKEND_PORT}
ITMS_ENFORCE_SECURITY=false
FRONTEND_ORIGIN=${PUBLIC_SERVER_URL}
DATABASE_URL=postgres://${DB_USER}:${db_password_encoded}@localhost:${DB_PORT}/${DB_NAME}?sslmode=disable
MIGRATION_DIR=db/postgres_migrations
INVENTORY_SYNC_ENABLED=false
INVENTORY_SYNC_SOURCE_TYPE=json
INVENTORY_SYNC_SOURCE_URL=
INVENTORY_SYNC_SOURCE_TOKEN=
INVENTORY_INGEST_TOKEN=
INVENTORY_SYNC_INTERVAL=24h
INVENTORY_SYNC_RUN_ON_STARTUP=false
INVENTORY_SYNC_DEFAULT_ENTITY_ID=
INVENTORY_SYNC_DEFAULT_DEPT_ID=
INVENTORY_SYNC_DEFAULT_LOCATION_ID=
PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}
SALT_MASTER_HOST=
WAZUH_MANAGER_HOST=
JWT_SECRET=
JWT_TTL=24h
SALT_API_BASE_URL=
SALT_API_TOKEN=
SALT_API_USERNAME=
SALT_API_PASSWORD=
SALT_API_EAUTH=pam
SALT_TARGET_TYPE=glob
SSH_TERMINAL_USERNAME=
SSH_TERMINAL_PRIVATE_KEY_PATH=
SSH_TERMINAL_PRIVATE_KEY=
SSH_TERMINAL_CERTIFICATE_PATH=
SSH_TERMINAL_KNOWN_HOSTS_PATH=
SSH_TERMINAL_HOST_OVERRIDES=
SSH_TERMINAL_STRICT_HOST_KEY=true
SSH_TERMINAL_PORT=22
SALT_AGENT_INSTALL_STATE=itms_agent.install
SALT_AGENT_INSTALL_UBUNTU_STATE=itms_agent.ubuntu
SALT_AGENT_INSTALL_WINDOWS_STATE=itms_agent.windows
SALT_INVENTORY_REFRESH_STATE=itms_inventory.refresh
SALT_INVENTORY_REFRESH_UBUNTU_STATE=itms_inventory.ubuntu
SALT_INVENTORY_REFRESH_WINDOWS_STATE=itms_inventory.windows
WAZUH_API_BASE_URL=
WAZUH_API_USERNAME=
WAZUH_API_PASSWORD=
WAZUH_API_CA_FILE=
WAZUH_API_INSECURE_SKIP_VERIFY=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=${PUBLIC_SERVER_URL}/api/auth/google/callback
GOOGLE_HOSTED_DOMAIN=zerodha.com
DEFAULT_ADMIN_EMAIL=${ADMIN_EMAIL}
DEFAULT_ADMIN_PASSWORD=
DEFAULT_ADMIN_NAME='ITMS Admin'
EOF

  cat > .env.secrets <<EOF
JWT_SECRET=${JWT_SECRET}
DEFAULT_ADMIN_PASSWORD=${ADMIN_PASSWORD}
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
}

sync_imported_admin_password() {
  local backup_file="$APP_DIR/database/backup.sql"

  if [[ ! -f "$backup_file" ]]; then
    return 0
  fi

  (
    cd "$APP_DIR/backend"
    set -a
    source ./.env
    source ./.env.secrets
    set +a
    GOTOOLCHAIN=local go run ./cmd/sync_default_admin_password
  )
}

restore_database() {
  local backup_file="$APP_DIR/database/backup.sql"

  if [[ ! -f "$backup_file" ]]; then
    echo "Skipping database restore because $backup_file was not found."
    return 0
  fi

  PGPASSWORD="$DB_PASSWORD" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"
}

build_frontend() {
  cd "$APP_DIR/frontend"
  npm run build
}

write_backend_wrapper() {
  cat > "$APP_DIR/backend/start-backend.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$APP_DIR/backend"
set -a
source ./.env
source ./.env.secrets
set +a
exec ./server
EOF
  chmod +x "$APP_DIR/backend/start-backend.sh"
}

start_backend_pm2() {
  pm2 start "$APP_DIR/backend/start-backend.sh" --name itms-backend
  pm2 save
  pm2 startup systemd -u "$USER" --hp "$HOME" >/tmp/itms-pm2-startup.txt || true
}

configure_nginx() {
  if [[ "$SKIP_NGINX" -eq 1 ]]; then
    return 0
  fi

  sudo tee /etc/nginx/sites-available/itms >/dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${APP_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
      proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws/ {
      proxy_pass http://127.0.0.1:${BACKEND_PORT}/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /installers/ {
      proxy_pass http://127.0.0.1:${BACKEND_PORT}/installers/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

  sudo ln -sfn /etc/nginx/sites-available/itms /etc/nginx/sites-enabled/itms
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl restart nginx
}

verify_setup() {
  require_command curl

  curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health"
  if [[ "$SKIP_NGINX" -ne 1 ]]; then
    curl -fsS "${PUBLIC_SERVER_URL}/api/health"
  fi
  pm2 status
}

main() {
  parse_args "$@"
  install_system_packages
  install_node
  install_go
  install_pm2
  clone_repo
  install_project_dependencies
  setup_postgres
  write_env_files
  restore_database
  sync_imported_admin_password
  build_frontend
  write_backend_wrapper
  start_backend_pm2
  configure_nginx
  verify_setup

  echo
  echo "Server setup complete."
  if [[ "$SKIP_NGINX" -ne 1 ]]; then
    echo "Frontend: ${PUBLIC_SERVER_URL}/login"
    echo "Health: ${PUBLIC_SERVER_URL}/api/health"
  fi
  echo "Backend direct health: http://127.0.0.1:${BACKEND_PORT}/api/health"
}

main "$@"