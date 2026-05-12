# Fleet SSH and Salt Security Design

Date: 2026-05-07

## Goal

Run SSH access and Salt-based patching for up to 1500 mixed-OS systems with strong security, stable identity, and complete operator audit trails.

## Core Model

- Salt is the fleet control plane.
- SSH is the interactive operator access plane.
- Every asset keeps separate identities for database records, user-facing names, and management access.

Each system should have:

- an immutable ITMS asset ID
- a user-facing asset tag or display name
- a stable Salt minion ID
- a resolved SSH address and approved admin username

Do not rely on hostname alone for asset identity, Salt targeting, or SSH resolution.

## Security Requirements

### SSH

- Use certificate-based SSH for operator access.
- Keep `SSH_TERMINAL_STRICT_HOST_KEY=true`.
- Set `SSH_TERMINAL_KNOWN_HOSTS_PATH` to a managed known-hosts file or move to a trusted host CA workflow.
- Disable password-based admin access on managed endpoints.
- Use short-lived user certificates signed by a central SSH CA.
- Restrict SSH access to approved admin principals such as `zerodha-admin` or `itteam`.
- Limit inbound SSH to private network paths or approved jump hosts.

### Salt

- Use a unique, stable Salt minion ID per endpoint.
- Point every minion at the Salt master by private IP or internal DNS.
- Accept minion keys through an approval workflow, not blanket auto-accept.
- Restrict Salt API credentials and external auth permissions to the minimum command set needed by ITMS.
- Run patching and remote actions through Salt, not through direct SSH loops.

### ITMS backend

- Keep terminal and patch actions limited to `super_admin` and `it_team` roles.
- Keep bearer-token websocket auth only.
- Keep SSH host-key verification enabled.
- Mount SSH private key, SSH certificate, and known-hosts files read-only into the backend container.
- Rotate Salt API and SSH CA material on a schedule.

## Identity Standard

For large fleets, use this split:

- Asset ID: immutable ITMS UUID
- Display name: human-readable label shown in the UI
- Asset tag: inventory or finance label
- Hostname: collected OS attribute only
- Salt minion ID: stable management identity
- SSH target: private IP or internal DNS plus approved username

Recommended minion ID sources, in order:

1. centrally assigned immutable asset tag
2. hardware serial if stable and globally unique
3. generated enrollment ID stored locally on the endpoint

Do not derive the minion ID from a short hostname that can collide, truncate, or change during reimaging.

## OS Strategy

### Linux

- Install Salt minion on every managed endpoint.
- Enable SSH for operator access.
- Use SSH certificates or centrally managed public keys only.
- Collect distro, release, kernel, and patch metadata through inventory.

### Windows

- Install Salt minion on every managed endpoint.
- Use Salt for inventory, patch orchestration, and scripted actions.
- Enable OpenSSH only where interactive shell access is actually required.
- Keep OS-specific patching and package discovery inside Windows-aware Salt states and collectors.

## Scale Pattern For 1500 Systems

- Do not patch all systems at once.
- Use departments, sites, OS families, and patch rings for targeting.
- Run inventory refresh with staggered schedules and jitter.
- Run patch jobs in batches, for example 50 to 100 endpoints per batch.
- Keep servers and critical devices in smaller controlled rings.

Recommended rings:

1. IT test devices
2. pilot users
3. standard user fleet
4. critical or special-purpose systems

## Logging And Audit Requirements

Every SSH and Salt action should be attributable to one user, one asset, one time window, and one outcome.

Required audit fields:

- actor user ID
- actor role
- asset ID
- asset tag
- hostname
- Salt minion ID when applicable
- SSH target address when applicable
- action type
- normalized command or patch action
- request time and completion time
- success or failure result
- stdout and stderr size or output summary
- change summary for patch reports

Current repo support already records:

- terminal session audit events
- terminal command executed and blocked events
- asset history for terminal actions
- patch run audit events
- patch run reports with per-device rows

## Required Operational Controls

- Separate SSH certificates for humans and automation.
- Short certificate validity windows.
- Forced periodic rotation of Salt API credentials.
- Alert on disconnected minions, repeated patch failures, and blocked terminal commands.
- Keep an exportable audit log for compliance review.
- Require approval for bulk patch runs outside approved maintenance windows.

## Recommended ITMS Operating Rules

- Use Salt as the default remote action path.
- Use SSH only for interactive terminal sessions and incident response.
- Never target production-wide patch jobs by raw hostname patterns.
- Prefer department, site, OS, and ring metadata for selection.
- Show both display name and minion ID in operator views to avoid ambiguity.

## Existing Repo Alignment

The current codebase already aligns with this design in several places:

- `backend/internal/api/router.go` records audit events for terminal sessions, terminal commands, and patch runs.
- `backend/internal/api/ssh_terminal.go` supports certificate-based SSH signers.
- `backend/internal/app/config.go` validates SSH terminal and host-key settings.
- `backend/README.md` documents strict host-key verification and SSH certificate wiring.
- `scripts/install-itms-agent.sh` and `scripts/salt/itms_agent/ubuntu/init.sls` support Salt master bootstrapping by hostname or IP.

## Minimum Rollout Checklist

1. Define the stable minion ID convention.
2. Enforce private-address SSH resolution only.
3. Deploy SSH CA trust on all endpoints that need interactive shell access.
4. Issue short-lived SSH user certificates for ITMS operators.
5. Configure `SSH_TERMINAL_CERTIFICATE_PATH`, private key, and known-hosts on the backend.
6. Enroll Salt minions by master IP or internal DNS and approve keys explicitly.
7. Define patch rings by department, site, OS, and criticality.
8. Retain patch reports and audit logs for compliance review.
9. Alert on missing inventory, disconnected minions, and repeated patch failures.

## Decision

For a 1500-system mixed-OS fleet, the secure default is:

- SSH on every system only where operator terminal access is required, using certificate-based auth and strict host verification.
- Salt on every managed system for inventory, orchestration, and patch execution.
- ITMS audit logs and patch reports retained as the system of record for who accessed what and what changed.