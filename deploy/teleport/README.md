# Teleport + Salt Enterprise Access

This bundle replaces a classic bastion model with a tighter access plane:

- Teleport provides SSH identity, MFA, RBAC, access requests, session recording, and audit.
- `salt-minion` stays installed on all 2000 managed servers.
- `salt-master` and `salt-api` stay on a private network.
- `salt-api` is exposed only through Teleport Application Access.
- Teleport app labels should stay environment-specific so staging, monitoring, and production operators do not all land on the same Salt app surface.
- PAM on the salt-api host is used as the final execution boundary for approved operator groups.

## Architecture

### Core components

- `postgres`: Teleport backend for HA auth/proxy nodes.
- `teleport-1..3`: Teleport auth, proxy, and app access nodes running active-active.
- `nginx`: TLS 1.3-only reverse proxy for the web UI and TCP stream load balancing for SSH and reverse tunnels.
- `salt-master` / `salt-api`: remain private and are not exposed directly to operators.

### Security model

- All human access is certificate-based through Teleport.
- TOTP MFA is enforced for every user and per-session MFA is required.
- Production SSH access is granted only through an access request with dual approval.
- `salt-api` is reachable only via Teleport App Access.
- PAM groups on the salt-api host limit which Salt functions each operator class can run.
- Session recordings go to S3 by default; NFS backup is the fallback path.

## Deployment notes

1. Copy `.env.example` to `.env` and replace every `replace-*` placeholder.
2. Update the rendered values in `.env` for your public addresses, session storage, Salt API endpoint, and Salt API bind/TLS paths.
  Set `SALT_APP_ENVIRONMENT` to the real environment served by this Teleport deployment, for example `staging`, `monitoring`, or `production`.
3. Place your TLS certificate and key where `.env` points Nginx.
4. If you want a machine-readable checklist of missing required values, run:

```bash
cd deploy/teleport
bash scripts/list-unresolved-env-keys.sh
```

This prints only unresolved required env keys, one per line.
5. If you want a stricter local preflight before the first deploy, run:

```bash
make teleport-env-check
```

This checks unresolved required env keys plus local files used on the Teleport admin host, including `TLS_CERT_PATH`, `TLS_KEY_PATH`, and `TELEPORT_LICENSE_PATH` when set.

If you want the local preflight and the Teleport sync dry-run in one command, run:

```bash
make teleport-ready
```

This stops on the first failing prerequisite, so you can use it as a quick readiness gate.
If you want to generate fresh random values for the local secret placeholders before your first real deploy, run:

```bash
make teleport-generate-secrets
```

This updates `POSTGRES_PASSWORD`, `TELEPORT_AUTH_TOKEN`, `SESSION_STORAGE_ACCESS_KEY`, and `SESSION_STORAGE_SECRET_KEY` in `.env`, and creates a timestamped backup before writing. It intentionally does not change `TELEPORT_CA_PIN`, `SESSION_STORAGE_URI`, `BACKUP_S3_URI`, or any file paths.
The Teleport containers read `SESSION_STORAGE_ACCESS_KEY`, `SESSION_STORAGE_SECRET_KEY`, `SESSION_STORAGE_REGION`, and optional `SESSION_STORAGE_ENDPOINT` as S3 client credentials and endpoint settings at runtime.
If you want a concise summary of the remaining manual operator actions from the current environment, run:

```bash
make teleport-manual-steps
```

If you want to trigger the Teleport CLI login flow from the repo root or from `backend/`, run:

```bash
make teleport-login
```

If you want a compact readiness snapshot with the next recommended command, run:

```bash
make teleport-status
```

If you want the standardized real Salt config sync command from the repository root, run:

```bash
make teleport-sync
```
6. Render the environment-specific runtime files:

  The HA Teleport services use their own container hostnames for node identity; there is no shared `TELEPORT_NODENAME` override to maintain.

```bash
cd deploy/teleport
bash scripts/render-configs.sh
```

7. Start the stack:

```bash
cd deploy/teleport
docker compose up -d
```

If the host only has legacy `docker-compose` instead of the Compose plugin, use:

```bash
cd deploy/teleport
docker-compose up -d
```

You can also do the same flow with the helper script:

```bash
cd deploy/teleport
bash scripts/deploy-teleport.sh --init-env
```

The helper auto-detects `docker compose` versus `docker-compose`, so it is the safer default on mixed or older Ubuntu hosts.

The helper now performs preflight checks before it starts anything:

- it refuses to continue if `.env` still contains `replace-*` placeholder values
- it verifies the Nginx TLS certificate and key paths from `.env`
- it verifies that rendered runtime files do not contain unresolved template placeholders

Add `--bootstrap-admin` if you want the initial Teleport roles and admin user created right after the stack comes up.

If you run the helper on the private Salt API host, you can also install the rendered CherryPy config directly into the Salt master path:

```bash
cd deploy/teleport
bash scripts/deploy-teleport.sh --render-only --install-salt-config
```

Add `--restart-salt-api` to restart `SALT_API_SERVICE_NAME` after the install, and `--check-salt-api` to run the configured health check URL after restart.

The install target defaults to `SALT_API_CONFIG_TARGET=/etc/salt/master.d/rest_cherrypy.conf` and the helper will validate `SALT_API_TLS_CERT_PATH` and `SALT_API_TLS_KEY_PATH` before it copies the file.

If you want to push the rendered Salt config from the Teleport admin host to the private Salt API node, use the SSH sync helper:

```bash
cd deploy/teleport
bash scripts/sync-salt-config.sh --restart-salt-api --check-salt-api
```

Add `--dry-run` to preview the SSH target, upload path, install path, and post-install actions without touching the remote host.

For a shortcut from the repository root, run:

```bash
make teleport-sync-dry-run
```

Use `make teleport-sync` for the real remote install, restart, and health-check once the readiness checks pass.

The sync helper supports two transports:

- `SALT_API_SSH_TRANSPORT=direct`: uses `ssh` and `scp` with `SALT_API_SSH_HOST`, `SALT_API_SSH_PORT`, `SALT_API_SSH_USER`, and optional `SALT_API_SSH_OPTIONS`. This is the right mode for direct port `22` access to the private Salt API host.
- `SALT_API_SSH_TRANSPORT=teleport`: uses `tsh ssh` and `tsh scp` with `SALT_API_TELEPORT_PROXY`, optional `SALT_API_TELEPORT_CLUSTER`, optional `SALT_API_TELEPORT_NODE`, and optional `SALT_API_TELEPORT_OPTIONS`. Use this when the Salt API host is only reachable through the Teleport access plane instead of direct SSH.

For `SALT_API_SSH_TRANSPORT=direct`, the remote SSH user still needs enough privilege to install `runtime/rest_cherrypy.conf` to `SALT_API_CONFIG_TARGET`, restart `SALT_API_SERVICE_NAME`, and run the optional health and diagnostic commands. In practice that means either:

- `SALT_API_SSH_USER=root`, with working SSH access, or
- a non-root SSH user with passwordless `sudo` for `install`, `rm`, `systemctl`, `journalctl`, and `curl` on the Salt API host.

Before a non-dry-run sync with `SALT_API_SSH_TRANSPORT=teleport`, log in with `tsh` on the admin host:

```bash
make teleport-login
```

If your deployment uses a named Teleport root cluster, set `SALT_API_TELEPORT_CLUSTER` in `.env` and `make teleport-login` will include it automatically.

In either mode, the sync helper runs a remote preflight probe before upload, uploads `runtime/rest_cherrypy.conf`, installs it to `SALT_API_CONFIG_TARGET`, and can restart and health-check the remote Salt API service. Before overwrite, it creates a timestamped backup of the existing remote config and automatically restores it if restart or health verification fails. On failure, it also prints remote `systemctl status` output and the last `SALT_API_JOURNAL_LINES` lines from `journalctl -u SALT_API_SERVICE_NAME`.

8. Bootstrap roles and the initial admin:

```bash
bash scripts/bootstrap-teleport.sh
```

9. Enroll Linux servers with Teleport and label them by environment. Pass a trusted SHA-256 for the fetched Teleport installer, either as argument 5 or through `TELEPORT_INSTALL_SHA256`:

```bash
sudo bash scripts/enroll-openssh-node.sh teleport.zerodha.internal <ca-pin> <join-token> production <install-script-sha256>
```

## Salt execution flow

1. User authenticates to Teleport with MFA.
2. User opens the protected `salt-api` application through Teleport.
3. Teleport records the application access and SSH session metadata.
4. Salt API authenticates the mapped PAM account.
5. The PAM account is restricted by `external_auth` to approved Salt job inspection and specific package or service functions.

## Example Salt jobs

### Upgrade all staging nodes

```bash
curl -k -sS https://salt-api.teleport.zerodha.internal/run \
  -H 'Content-Type: application/json' \
  -d '{"client":"local","tgt":"G@environment:staging","expr_form":"compound","fun":"pkg.upgrade"}'
```

### Install a package on monitoring nodes

```bash
curl -k -sS https://salt-api.teleport.zerodha.internal/run \
  -H 'Content-Type: application/json' \
  -d '{"client":"local","tgt":"G@environment:monitoring","expr_form":"compound","fun":"pkg.install","arg":["htop"]}'
```

### Restart nginx on one production host

```bash
curl -k -sS https://salt-api.teleport.zerodha.internal/run \
  -H 'Content-Type: application/json' \
  -d '{"client":"local","tgt":"prod-web-001","fun":"service.restart","arg":["nginx"]}'
```

## Operational guidance

- For 2000 servers, keep Teleport auth/proxy nodes on dedicated VMs or bare metal behind an L4/L7 load balancer.
- Use node labels such as `environment`, `team`, and `criticality` so RBAC stays simple and auditable.
- Keep `salt-api` private; only Teleport should be routable from operator networks.
- Ship Teleport service logs and access events into your SIEM from the Teleport nodes or from the S3 audit bucket.
- A renderable rsyslog forwarder template is included at `monitoring/rsyslog-teleport.conf.tmpl`; render it with `scripts/render-configs.sh` before deploying it to your log forwarder.
- The Salt API bind config is also templated at `salt/master.d/rest_cherrypy.conf.tmpl`; the rendered output is written to `runtime/rest_cherrypy.conf` and can be installed to the Salt host path with `scripts/deploy-teleport.sh --install-salt-config`.
- For remote Salt API hosts, `scripts/sync-salt-config.sh` handles upload, install, optional restart, and optional health verification over SSH.
- For Teleport-routed rollouts, set `SALT_API_SSH_TRANSPORT=teleport` and point `SALT_API_TELEPORT_PROXY` at the Teleport proxy endpoint that your `tsh` client uses.
- The remote sync flow probes TLS paths, target directory access, and required remote commands before upload starts, then rolls back to the previous config automatically if the new config fails restart or health verification.
- Use separate PAM groups on the salt-api host for production and non-production operators.

## Backups

- Run `scripts/backup-teleport.sh` manually or install the included cron entry with `scripts/install-backup-cron.sh`.
- PostgreSQL is dumped in custom format for fast restore.
- Local file-backed Teleport audit events are exported from each running `teleport-*` node into `teleport-audit-events.tgz` so node-local audit history is included in the backup workflow.
- The config archive excludes live `.env` and `runtime/teleport.yaml` by default so database passwords, Teleport auth tokens, and other live secrets are not copied into NFS or S3 backups. Set `INCLUDE_SECRETS_IN_BACKUP=true` only if you explicitly want a full secret-bearing archive.
- Non-secret stack config and safe rendered runtime files are archived with the backup so role, proxy, and Salt settings remain recoverable.
- Backups can be copied to NFS and S3 in the same run.
