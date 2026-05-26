# Second Server Runbook Template

Use this template when bringing up a fresh Ubuntu server for ITMS. Replace every `YOUR_*` placeholder before running the commands.

If you prefer a rendered copy instead of manual edits, run `bash scripts/render-second-server-runbook.sh --server-ip YOUR_SERVER_IP --server-name YOUR_SERVER_NAME_OR_IP --prompt-admin-password --prompt-jwt-secret --output docs/second-server-runbook.generated.md` from the repo root. For non-interactive workflows, use `--admin-password-file` and `--jwt-secret-file` with protected files instead of inline secrets.

## Target Values

```text
SERVER_IP=YOUR_SERVER_IP
SERVER_NAME=YOUR_SERVER_NAME_OR_IP
ITMS_ROOT=/home/itteam/itms
ADMIN_EMAIL=admin@zerodha.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
ENABLE_SERVER_INTEGRATIONS=no
ENABLE_GOOGLE_SSO=no
```

## 1. Base Packages

```bash
sudo apt-get update
sudo apt-get install -y git nodejs npm
```

## 2. Clone Repository

```bash
cd /home/itteam
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git itms
cd /home/itteam/itms
git switch main
git pull --ff-only origin main
```

## 3. Backend Environment

Create `backend/.env`:

```bash
cat > backend/.env <<'EOF'
BACKEND_ADDR=:3001
ITMS_ENFORCE_SECURITY=false
FRONTEND_ORIGIN=http://YOUR_SERVER_IP,http://localhost:4175,http://127.0.0.1:4175
DATABASE_URL=postgres://postgres:postgres@localhost:5432/itms?sslmode=disable
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
PUBLIC_SERVER_URL=http://YOUR_SERVER_IP
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
GOOGLE_REDIRECT_URL=http://YOUR_SERVER_IP/api/auth/google/callback
GOOGLE_HOSTED_DOMAIN=zerodha.com
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_PASSWORD=
DEFAULT_ADMIN_NAME=ITMS Admin
EOF
```

Create `backend/.env.secrets`:

```bash
cat > backend/.env.secrets <<'EOF'
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-admin-password
EOF
```

If Google SSO is not being enabled yet, leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty.

## 4. Start Backend And Postgres

```bash
chmod +x scripts/install-docker-and-start-itms.sh
./scripts/install-docker-and-start-itms.sh --detach
```

This step installs Docker Engine, Buildx, and the Compose plugin automatically on Ubuntu.

## 5. Publish Frontend Through nginx

```bash
chmod +x scripts/install-itms-nginx.sh
sudo ./scripts/install-itms-nginx.sh YOUR_SERVER_NAME_OR_IP
```

This step installs `nginx` and `rsync` if they are missing, builds the frontend, copies `frontend/dist`, and proxies `/api` and `/ws` to `127.0.0.1:3001`.

## 6. Validate Stack Health

```bash
chmod +x scripts/verify-itms-stack.sh scripts/smoke-test-itms-nginx.sh scripts/smoke-test-itms-api.sh
./scripts/verify-itms-stack.sh --sudo
./scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_NAME_OR_IP
./scripts/smoke-test-itms-api.sh
```

Expected results:

- Docker Compose services are running.
- `http://YOUR_SERVER_NAME_OR_IP/login` returns `200 OK`.
- `http://YOUR_SERVER_NAME_OR_IP/api/health` returns healthy JSON.
- API login and smoke-test flows pass with the seeded admin account.

## 7. Optional Server Integrations

If this server should host Salt, OpenSCAP, or Wazuh too:

```bash
chmod +x scripts/install-itms-server-integrations.sh scripts/check-itms-server-integrations.sh
sudo SERVER_HOST=YOUR_SERVER_IP ./scripts/install-itms-server-integrations.sh
./scripts/check-itms-server-integrations.sh
```

This step installs Salt packages, OpenSCAP packages when available, and optional Wazuh packages, then updates `backend/.env` and `backend/.env.secrets` with the generated integration values.

## 8. Post-Install Checks

Run the broader readiness suite after the base stack is healthy:

```bash
chmod +x scripts/check-itms-release-readiness.sh
./scripts/check-itms-release-readiness.sh
```

If live integrations are enabled on this server:

```bash
./scripts/check-itms-release-readiness.sh --with-live-integrations
```

## Notes

- Docker Compose loads `backend/.env.secrets` after `backend/.env`, so secret values there win.
- Keep `JWT_SECRET` and `DEFAULT_ADMIN_PASSWORD` in `backend/.env.secrets` as the effective deployed values.
- Leave Salt, SSH terminal, and Wazuh settings empty unless this server is actually wired to those services.