# Deployment Handoff

Current validated branch and commit:

- Branch: `main`
- Commit: `059bc08e1c9f1db66258fb3565b8fca7409f4497`
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
