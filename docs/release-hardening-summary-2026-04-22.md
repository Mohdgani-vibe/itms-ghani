# ITMS Hardening Summary

Date: 2026-04-22

## Scope

This summary captures the security and operational hardening completed across the ITMS backend, frontend, deployment scripts, and integration tooling during the April 2026 hardening pass.

## Security Changes

- Replaced fixed Salt and Wazuh API password defaults with runtime-generated secrets in the server integration and Salt repair scripts.
- Added backend config validation to warn or fail when placeholder integration secrets are still present.
- Added a rotation utility for live Salt and Wazuh API secrets and verified the rotated credentials against both services.
- Removed websocket query-string token fallback for SSH sessions. Websocket auth now uses bearer token subprotocols only.
- Removed SSH authorized key material and key-source metadata from API payloads and the frontend SSH terminal UI.
- Tightened SSH target resolution so inventory-derived SSH candidates only accept private, loopback, or link-local IP addresses. Public IPs and invalid host values from network snapshots are ignored.
- Reduced SSH reachability error detail to avoid reflecting selected host and port values back to the client.
- Restored SSH host-key verification in the inventory refresh workflow.
- Removed the hardcoded default public key from the SSH key installer and now require explicit key input.
- Hardened Teleport OpenSSH enrollment by downloading the installer to a temporary file and requiring SHA-256 verification before execution.
- Narrowed Teleport Salt external auth permissions by removing broad runner, wheel, and unrestricted command grants.
- Tightened Salt config installation permissions from world-readable to group-restricted modes where deployment scripts manage those files.

## Operational Changes

- Added integration secret auditing to the release-readiness script.
- Updated the OpenSCAP status check so release readiness no longer fails when the current host is not represented as an inventoried asset.
- Completed live Salt and Wazuh credential rotation successfully on the target host.
- Verified backend connectivity to the rotated Salt and Wazuh APIs after restart.

## Validation

The following validation steps completed successfully after the hardening changes:

```bash
cd frontend && npm run lint && npm run build
cd backend && GOTOOLCHAIN=local go build ./... && GOTOOLCHAIN=local go test ./...
cd backend && GOTOOLCHAIN=local go test ./internal/api -run 'TestSanitizeSSHInventoryAddress|TestExtractWebSocketBearerToken|TestRouterAssetSSHWebsocketKeepsClaimsForEntityScope'
bash scripts/check-itms-release-readiness.sh
```

Live operational validation also confirmed:

- Salt API login succeeds with the rotated backend credential.
- Wazuh API authentication succeeds with the rotated backend credential.
- Backend health checks return OK after restart.

## Release Impact

- No open hardening blocker remains from this pass.
- Existing frontend and backend build/test gates are green.
- SSH terminal behavior is stricter by design: query-token auth is gone, key material is no longer exposed to the UI, and public inventory IPs are no longer eligible SSH dial targets.

## Follow-Up

- If more release documentation is needed, this file can be distilled into user-facing release notes or an internal deployment handoff summary.