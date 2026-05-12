# Deployment Handoff

Current validated branch and commit:

- Branch: `main`
- Commit: `1a4e0b9ca4646b4f8304d57eefb808e8ba96acb6`
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
