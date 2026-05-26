# Deployment Handoff

Current validated branch and commit:

- Branch: `main`
- Commit: `840f22782ed9051c89f804428c8b68ca3a0c9498`
- Remote: `https://github.com/Mohdgani-vibe/zerodha-itms.git`

Validated on this server:

- Standard release readiness passed successfully
- Frontend production build passes on Vite `8.0.8`
- Backend compile/test pass succeeded
- Docker stack is healthy
- Live nginx frontend deployment completed successfully
- Post-deploy nginx smoke test passed

Related documentation:

- Hardening and security change summary: `docs/release-hardening-summary-2026-04-22.md`
- Stakeholder-facing release note: `docs/release-note-2026-04-22.md`
- Fillable second-server rollout checklist: `docs/second-server-runbook-template.md`

## Update Existing Server

```bash
cd /home/itteam/itms
git fetch origin
git switch main
git pull --ff-only origin main
```

## Provision Another Ubuntu Server

Base packages that must exist before the repo scripts can do the rest:

```bash
sudo apt-get update
sudo apt-get install -y git nodejs npm
```

Clone the repo and prepare the backend env files. The Compose stack requires both `backend/.env` and `backend/.env.secrets` because the backend service loads both files at startup.

```bash
cd /home/itteam
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git itms
cd /home/itteam/itms
cp backend/.env.example backend/.env
cat > backend/.env.secrets <<'EOF'
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-admin-password
EOF
```

Set the host-specific backend values before starting services:

```bash
sed -i 's|^PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=http://YOUR_SERVER_IP|' backend/.env
sed -i 's|^FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=http://YOUR_SERVER_IP,http://localhost:4175,http://127.0.0.1:4175|' backend/.env
sed -i 's|^GOOGLE_REDIRECT_URL=.*|GOOGLE_REDIRECT_URL=http://YOUR_SERVER_IP/api/auth/google/callback|' backend/.env
```

Copy-paste template for `backend/.env` on a second server:

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
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
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
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-admin-password
DEFAULT_ADMIN_NAME=ITMS Admin
EOF
```

Copy-paste template for `backend/.env.secrets`:

```bash
cat > backend/.env.secrets <<'EOF'
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-admin-password
EOF
```

Notes for those templates:

- Keep `JWT_SECRET` and `DEFAULT_ADMIN_PASSWORD` in `backend/.env.secrets` as the effective values. Docker Compose loads `.env.secrets` after `.env`.
- If Google SSO is not being used on the second server yet, leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty.
- Leave the Salt, SSH terminal, and Wazuh settings empty until that server is actually wired to those services, or run `scripts/install-itms-server-integrations.sh` to populate the Salt and Wazuh values automatically.

Start backend plus Postgres. This installer handles Docker Engine, Buildx, and the Compose plugin automatically on Ubuntu:

```bash
chmod +x scripts/install-docker-and-start-itms.sh
./scripts/install-docker-and-start-itms.sh --detach
```

Publish the frontend behind nginx. This script installs `nginx` and `rsync` if they are missing, builds the frontend, and proxies `/api` and `/ws` to `127.0.0.1:3001`:

```bash
chmod +x scripts/install-itms-nginx.sh
sudo ./scripts/install-itms-nginx.sh YOUR_SERVER_IP
```

Validate the app stack:

```bash
chmod +x scripts/verify-itms-stack.sh scripts/smoke-test-itms-nginx.sh scripts/smoke-test-itms-api.sh
./scripts/verify-itms-stack.sh --sudo
./scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_IP
./scripts/smoke-test-itms-api.sh
```

If the second server also needs Salt, OpenSCAP, or Wazuh, install the server integrations. The integration installer updates `backend/.env` and `backend/.env.secrets` with the generated Salt and Wazuh credentials:

```bash
chmod +x scripts/install-itms-server-integrations.sh scripts/check-itms-server-integrations.sh
sudo SERVER_HOST=YOUR_SERVER_IP ./scripts/install-itms-server-integrations.sh
./scripts/check-itms-server-integrations.sh
```

Notes for a fresh server:

- `node` and `npm` are required before `scripts/install-itms-nginx.sh` can build the frontend. That script does not install Node for you.
- `scripts/install-docker-and-start-itms.sh` installs Docker packages only.
- `scripts/install-itms-server-integrations.sh` installs Salt, OpenSCAP, and optional Wazuh packages and writes the backend integration env values automatically.

## Verify Frontend Dependencies

```bash
cd /home/itteam/itms/frontend
npm install
npm audit
npm run build
```

Expected result:

- `npm audit` returns `found 0 vulnerabilities`
- `npm run build` completes successfully

## Verify Backend

```bash
cd /home/itteam/itms/backend
go test ./...
```

Expected result:

- Go test completes without failures

## Full Readiness Check

Standard readiness:

```bash
cd /home/itteam/itms
./scripts/check-itms-release-readiness.sh
```

Readiness with live integrations:

```bash
cd /home/itteam/itms
./scripts/check-itms-release-readiness.sh --with-live-integrations
```

Expected result:

- Docker health passes
- API smoke test passes
- Salt and Wazuh auth report `auth-ok`
- Live Salt, Wazuh, ClamAV, and OpenSCAP verification pass
- Final output ends with `Release readiness checks completed successfully`

## Verify nginx Rollout

After the live frontend rollout, verify the nginx-served site and proxied API:

```bash
cd /home/itteam/itms
make nginx-deploy-dry-run
make nginx-deploy
./scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_IP
make nginx-smoke-test
make nginx-rollout
```

For the standard repo-driven sequence, `make nginx-rollout` now runs the dry-run, live deploy, and nginx smoke test together.

Expected result:

- nginx service reports `active / enabled`
- `http://YOUR_SERVER_IP/login` returns `200 OK`
- `http://YOUR_SERVER_IP/api/health` returns healthy JSON through nginx
- `http://YOUR_SERVER_IP/installers/install-itms-agent.sh` returns `200 OK`

## Notes

- OpenSCAP may report permission-limited warnings and `exit=2` when run without sudo/root; this is expected in the current setup as long as the report is still generated and ingested.
- A previous frontend advisory cleanup was committed in `a4cc759`; the current validated commit above includes the later nginx deployment hardening, readiness integration, and nginx smoke-test flow.
