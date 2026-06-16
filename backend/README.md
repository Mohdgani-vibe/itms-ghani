# Zerodha ITMS Backend

Internal-use Go backend for the Zerodha ITMS platform.

## Stack

- Go 1.22.2
- Gin
- PostgreSQL
- `database/sql` with `pgx`
- JWT auth
- Google OAuth 2.0 entrypoints

## What is implemented

- Auth: local JWT login, Google SSO entrypoints, logout, current user
- Core APIs: entities, locations, departments, roles, users, assets, audit log
- Frontend compatibility APIs: devices, patch dashboard/jobs/run, terminal sessions, current-user assets, and user meta options
- Entity-aware access rules for `super_admin`, `it_team`, and `employee`
- Hostname suggestion and transactional hostname sequence allocation for compute assets
- Middleware-driven audit log writes for mutating routes
- Seed data for Zerodha entities, default ZBL locations, roles, permissions, and default super admin
- SaltStack and Wazuh adapter clients, enabled through environment configuration
- Backend-owned inventory sync scheduler and status endpoint for daily asset imports
- Direct machine-to-server inventory ingest endpoint for collector agents

## Local run

1. Copy `.env.example` to `.env`
2. Start PostgreSQL:

```bash
cd backend
bash ../scripts/start-itms-backend.sh
```

3. The script auto-detects `docker compose` vs `docker-compose`, removes a dead backend container if needed, clears stale host-run ITMS backend processes on port `3001`, and waits for `/api/health` before returning.

4. Normal local startup commands that recover automatically on this host:

```bash
cd backend
make run
```

or:

```bash
cd backend
make start
```

5. If you explicitly want the host-run Go server instead of Docker for debugging:

```bash
cd backend
make run-host
```

The API listens on `http://YOUR_SERVER_IP:3001` by default on this host.

## Live Port Layout On This Host

- Frontend UI: `http://YOUR_SERVER_IP/` through nginx
- Primary backend API: `http://YOUR_SERVER_IP/api/*` through nginx
- Backend container listener on host: `http://YOUR_SERVER_IP:3001`
- Secondary backend instance: `http://YOUR_SERVER_IP:3012`
- Salt API: `http://YOUR_SERVER_IP:8000`

For the recommended live deployment, nginx serves the built frontend and proxies `/api` and `/ws` to the backend on port `3001`. The Vite preview server on `4175` is useful for manual preview sessions but should not be treated as the persistent production web server.

## Full Docker run

```bash
cd backend
cp .env.example .env
bash ../scripts/start-itms-backend.sh
```

If Docker is not installed yet on this Ubuntu server, run the one-shot installer from the repo root:

```bash
bash scripts/install-docker-and-start-itms.sh
```

To start the stack in the background instead of attaching to logs:

```bash
bash scripts/install-docker-and-start-itms.sh --detach
```

If you are using legacy `docker-compose` v1 directly on this host and `docker-compose up -d --build backend` fails with `KeyError: 'ContainerConfig'`, remove the stale ITMS service containers first and then recreate them. The named Postgres volume keeps the database data intact:

```bash
docker rm -f zerodha-itms-backend zerodha-itms-postgres || true
cd backend
docker-compose up -d
docker-compose up -d --build backend
```

For normal day-to-day local recovery on this host, prefer `bash ../scripts/start-itms-backend.sh`, `make start`, or `make run`, because those paths already handle stale backend process/container cleanup more safely than invoking legacy `docker-compose` directly.

After startup, verify the stack from the repo root:

```bash
bash scripts/verify-itms-stack.sh --sudo
```

To verify live Salt, Wazuh, ClamAV, and OpenSCAP integration flows from this host:

```bash
bash scripts/verify-itms-security-integrations.sh
```

To install only the recurring host-side OpenSCAP scan runner and timer:

```bash
sudo bash scripts/install-itms-openscap-runner.sh --server-url http://YOUR_SERVER_IP:3001 --prompt-token
```

If passwordless or interactive sudo is not available, you can install a user-level timer instead:

```bash
bash scripts/install-itms-openscap-user-runner.sh --server-url http://YOUR_SERVER_IP:3001 --token-file /path/to/itms-ingest-token
```

To inspect the active OpenSCAP timer state together with the latest ITMS OpenSCAP alert for this host:

```bash
bash scripts/check-itms-openscap-status.sh
bash scripts/check-itms-openscap-status.sh --json
```

To run the full deployment readiness suite in one command:

```bash
bash scripts/check-itms-release-readiness.sh
bash scripts/check-itms-release-readiness.sh --with-live-integrations
```

Before running the readiness suite, make sure `backend/.env` and `backend/.env.secrets` exist. The wrapper now checks those files up front because `backend/docker-compose.yml` requires both.

To acknowledge or resolve the latest unresolved OpenSCAP alert for this host:

```bash
bash scripts/manage-itms-openscap-alert.sh --action acknowledge --dry-run
bash scripts/manage-itms-openscap-alert.sh --action resolve
```

To publish the built frontend behind nginx on this Ubuntu host:

```bash
bash scripts/install-itms-nginx.sh --dry-run YOUR_SERVER_IP
bash scripts/install-itms-nginx.sh YOUR_SERVER_IP
bash scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_IP
```

Equivalent Make targets from the repo root:

```bash
make nginx-deploy-dry-run
make nginx-deploy
make nginx-smoke-test
make nginx-rollout
```

`make nginx-rollout` runs the full preview, live deploy, and post-deploy smoke test sequence in order.

Use `--dry-run` first to preview the frontend build, `/var/www/itms` sync, nginx site install, and service restart steps without changing the host.

After the live rollout, use `scripts/smoke-test-itms-nginx.sh` to verify nginx service state plus the login, proxied API health, and installer endpoints served through nginx.

Then run an authenticated API smoke test with the seeded admin:

```bash
bash scripts/smoke-test-itms-api.sh
```

To validate the live role matrix for the primary portals, run:

```bash
API_BASE_URL=http://YOUR_SERVER_IP \
IT_TEAM_PASSWORD='PortalIT123!' \
AUDITOR_PASSWORD='PortalAU123!' \
EMPLOYEE_PASSWORD='PortalEM123!' \
bash scripts/smoke-test-itms-role-matrix.sh
```

This script verifies the expected allow/deny boundary for `super_admin`, `it_team`, `auditor`, and `employee` against the live API and exits nonzero if any endpoint drifts.

## Default seeded admin

- Email: `DEFAULT_ADMIN_EMAIL` from `.env`
- Password: `DEFAULT_ADMIN_PASSWORD` from `.env.secrets`

Keep non-secret runtime settings in `.env` and store deployment credentials in `.env.secrets`. The defaults in `.env.example` are placeholders and should not be treated as the deployed credential.

If you change `DEFAULT_ADMIN_PASSWORD` in an existing deployment, rotate the stored credential too:

```bash
cd backend
set -a
source .env
source .env.secrets
set +a
GOTOOLCHAIN=local go run ./cmd/sync_default_admin_password
```

## Build validation

```bash
cd backend
GOTOOLCHAIN=local go build ./cmd/server
GOTOOLCHAIN=local go build ./...
```

## Notes

- PostgreSQL is the source of truth for all persistent app data.
- Docker is used to run the backend and Postgres, not to store app records directly.
- Google SSO routes are present; set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URL` to enable the redirect-based flow.
- Set `SALT_API_BASE_URL` and `SALT_API_TOKEN` to send patch runs and install jobs to SaltStack.
- If you are connecting directly to a normal `salt-api` service instead of a bearer-token gateway, set `SALT_API_USERNAME`, `SALT_API_PASSWORD`, and `SALT_API_EAUTH`.
- On this Ubuntu host, the working configuration is `SALT_API_EAUTH=file`.
- If `salt-api` is installed but not listening on port `8000`, run `sudo bash /home/itteam/itms/scripts/repair-salt-api.sh` to repair the exact `contextvars`/service bootstrap issue seen on Ubuntu hosts.
- On this host, `salt-master` and `salt-api` run as the `salt` user, so Salt config files used by the repair flow must remain readable by group `salt`.
- The ITMS patch action expects a Salt state named `patch.run`; sync the repo state tree into the host fileserver with `sudo bash /home/itteam/itms/scripts/sync-itms-salt-fileserver.sh` so `salt://patch/run.sls` exists.
- If the Salt Console shows a long "Loading terminal target..." delay and the backend reports `connected:false` for a known minion, check both Salt key state and the minion's pinned `master_finger`. On this host, `spare.ho-003` failed after the master key changed: the master first logged `public keys did not match`, and after re-accepting the minion key the minion still crash-looped because `/etc/salt/minion` pinned an old `master_finger` value.
- Recovery pattern for that case:

```bash
sudo salt-key -d <minion-id> -y
sudo salt-key -a <minion-id> -y

sudo cp -p /etc/salt/minion /etc/salt/minion.bak.$(date +%Y%m%d%H%M%S)
sudo editor /etc/salt/minion
# update master_finger to the current master public key fingerprint
sudo systemctl restart salt-minion

curl -sS -X POST http://127.0.0.1:8000/run \
	-H 'Accept: application/json' \
	--data-urlencode 'username=itms-salt' \
	--data-urlencode 'password=ChangeMe-Salt-API!' \
	--data-urlencode 'eauth=file' \
	--data-urlencode 'client=local' \
	--data-urlencode 'tgt=<minion-id>' \
	--data-urlencode 'fun=test.ping'
```

- Expected recovery result: Salt returns `{"return":[{"<minion-id>":true}]}` and `GET /api/terminal/targets/<minion-id>` flips back to `connected:true` quickly instead of timing out for about 15 seconds.
- SSH terminal sessions require `SSH_TERMINAL_USERNAME` plus either `SSH_TERMINAL_PRIVATE_KEY_PATH` or `SSH_TERMINAL_PRIVATE_KEY`.
- For certificate-based SSH access, also set `SSH_TERMINAL_CERTIFICATE_PATH` to the matching OpenSSH user certificate; the backend will pair it with the configured signing key.
- `SSH_TERMINAL_USERNAME` can be a comma-separated candidate list, for example `zerodha-admin,itteam`, and the backend will try them in order until one authenticates.
- `SSH_TERMINAL_HOST_OVERRIDES` can also override the username per asset using `hostname=user@address:port`, for example `spare=ubuntu@10.10.60.121:8877`.
- The backend now defaults `SSH_TERMINAL_STRICT_HOST_KEY=true`. Set `SSH_TERMINAL_KNOWN_HOSTS_PATH` to a real known-hosts file and keep strict verification enabled in normal operation.
- Populate the SSH known-hosts file from a trusted network path, for example with `ssh-keyscan -H <target-host> >> ~/.ssh/known_hosts`, then mount that file into the backend container at the same path referenced by `SSH_TERMINAL_KNOWN_HOSTS_PATH`.
- Set `SSH_TERMINAL_STRICT_HOST_KEY=false` only as a temporary lab fallback while you are bootstrapping host keys; the backend will otherwise skip SSH host identity verification.
- When the backend runs in Docker, mount the configured private key, optional certificate, and known-hosts files into the container at the same paths referenced by those env vars.
- The Compose file now falls back to `/dev/null` for those two bind mounts when the SSH env vars are unset, so a clean local startup does not fail just because the SSH terminal feature is not configured yet.
- On hosts that still use legacy `docker-compose` v1.29.x, recreating the backend service can fail with `KeyError: 'ContainerConfig'`. If that happens, remove the stale backend container and start a fresh one manually on `backend_default` using the current `.env` plus the SSH key mounts.
- Manual recovery pattern used on this host:

```bash
cd backend
docker rm -f zerodha-itms-backend >/dev/null 2>&1 || true
docker run -d \
	--name zerodha-itms-backend \
	--restart unless-stopped \
	--network backend_default \
	--env-file .env \
		--env-file .env.secrets \
	-e 'DATABASE_URL=postgres://postgres:postgres@postgres:5432/itms?sslmode=disable' \
	-e 'MIGRATION_DIR=/app/db/postgres_migrations' \
	-e 'BACKEND_ADDR=:3001' \
	-v /home/itteam/.ssh/id_ed25519:/home/itteam/.ssh/id_ed25519:ro \
	-v /home/itteam/.ssh/known_hosts:/home/itteam/.ssh/known_hosts:ro \
	-p 3001:3001 \
	backend_backend:latest
```
- The main install-agent action uses an OS-aware Salt state selection: Ubuntu devices use `SALT_AGENT_INSTALL_UBUNTU_STATE`, Windows devices use `SALT_AGENT_INSTALL_WINDOWS_STATE`, and unknown devices fall back to `SALT_AGENT_INSTALL_STATE`.
- The follow-up inventory refresh is also OS-aware: `SALT_INVENTORY_REFRESH_UBUNTU_STATE`, `SALT_INVENTORY_REFRESH_WINDOWS_STATE`, with `SALT_INVENTORY_REFRESH_STATE` as fallback.
- Set `WAZUH_API_BASE_URL`, `WAZUH_API_USERNAME`, and `WAZUH_API_PASSWORD` to enrich asset alerts with Wazuh data after agent enrollment.
- Set `WAZUH_API_INSECURE_SKIP_VERIFY=true` only when you are connecting to a local Wazuh API with a self-signed certificate and do not yet have a trusted internal CA.
- Set `INVENTORY_SYNC_ENABLED=true` and configure the `INVENTORY_SYNC_*` variables to pull daily inventory data into `assets` and `asset_compute_details`.
- Set `INVENTORY_INGEST_TOKEN` if you want Linux systems to push hardware and OS inventory directly to `/api/inventory-sync/ingest`.
- Inventory sync payload shape and flow are documented in `docs/inventory-sync.md`.
- Example Salt states for Ubuntu and Windows agent install plus inventory refresh are documented in `docs/salt-agent-states.md`.
