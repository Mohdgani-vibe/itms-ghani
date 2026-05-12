# Fleet Rollout Checklist

Date: 2026-05-08

## Goal

Roll out ITMS, Salt patching, and SSH terminal access to a mixed Linux and Windows fleet with strong security, stable device identity, and complete audit coverage.

This checklist assumes:

- Salt is the default remote execution and patching plane
- SSH is used for operator terminal access
- every managed system has a unique Salt minion ID
- every interactive terminal action must be attributable to a user and asset

## 1. Control Plane Preparation

Complete these items before onboarding endpoints.

### ITMS backend

- Configure `SSH_TERMINAL_USERNAME` with approved admin usernames.
- Configure `SSH_TERMINAL_PRIVATE_KEY_PATH` or `SSH_TERMINAL_PRIVATE_KEY`.
- Configure `SSH_TERMINAL_CERTIFICATE_PATH` if using SSH certificates.
- Configure `SSH_TERMINAL_KNOWN_HOSTS_PATH`.
- Keep `SSH_TERMINAL_STRICT_HOST_KEY=true`.
- Verify the backend container mounts SSH key, certificate, and known-hosts files read-only.
- Configure Salt API credentials in the backend and verify they are not placeholders.

### Salt master

- Decide the stable minion ID convention before deployment.
- Disable blanket key auto-accept unless the environment is an isolated lab.
- Limit Salt API external auth to the smallest command set needed by ITMS.
- Confirm the Salt master is reachable by private IP or internal DNS from all target networks.

### SSH trust

- Choose one SSH trust model for the fleet: SSH user certificates preferred, managed public keys acceptable.
- If using SSH certificates, deploy `TrustedUserCAKeys` on endpoints that allow operator access.
- If using known-hosts files, populate them from trusted scans and keep them mounted into the backend.
- Disable password-based admin SSH access on managed Linux endpoints where practical.

## 2. Identity Standard

Every endpoint must have these identities separated:

- ITMS asset ID: immutable database identity
- display name or asset tag: user-facing identity
- Salt minion ID: management identity
- SSH target: private IP or internal DNS plus approved username

Checklist:

- Do not rely on hostname alone for uniqueness.
- Do not derive minion IDs from short hostnames that may truncate or collide.
- Store or generate a stable enrollment identity for reimaging scenarios.
- Keep hostname as collected metadata, not the only remote-control key.

## 3. Linux Onboarding

Use [scripts/install-itms-agent.sh](/home/itteam/itms/scripts/install-itms-agent.sh) for Linux enrollment.

### Required inputs

- `--server-url`
- `--token`

### Recommended inputs

- `--salt-master <private-ip-or-dns>`
- `--assigned-to-email`
- `--assigned-to-name`
- `--employee-code`
- `--department-name`
- `--asset-tag`
- `--name`
- `--wazuh-manager` if used
- `--require-salt` for managed fleet installs

### Linux checklist

- Run the installer with sudo.
- Pass the Salt master private IP or internal DNS with `--salt-master`.
- Verify `/etc/itms-agent.env` exists and contains the right server and Salt values.
- Verify `/etc/salt/minion.d/itms.conf` contains the correct `master:` value.
- Verify `salt-minion` is installed and running.
- Verify the device inventory timer and service are installed.
- Verify the endpoint appears in ITMS with the correct asset tag, user, and department.
- Verify the Salt key appears on the master and is explicitly accepted.
- Verify `test.ping` succeeds for the new minion.

### Linux post-checks

- Run one inventory refresh and confirm the asset record updates.
- Confirm SSH access works with the approved admin username.
- Confirm host key verification succeeds.
- Confirm terminal sessions and patch runs create audit records in ITMS.

## 4. Windows Onboarding

Use [scripts/install-itms-agent.ps1](/home/itteam/itms/scripts/install-itms-agent.ps1) for Windows enrollment.

### Required inputs

- `-ServerUrl`
- `-Token`

### Recommended inputs

- `-SaltMaster <private-ip-or-dns>`
- `-AssignedToEmail`
- `-AssignedToName`
- `-EmployeeCode`
- `-DepartmentName`
- `-AssetTag`
- `-Name`
- `-WazuhManager` if used

### Windows checklist

- Run the installer from an elevated PowerShell session.
- Pass the Salt master private IP or internal DNS with `-SaltMaster`.
- Verify `C:\ProgramData\ITMS\itms-agent.env` exists and has the right values.
- Verify `C:\salt\conf\minion.d\itms.conf` contains the correct `master:` value.
- Verify the `salt-minion` service is installed and running.
- Verify the collector script exists under `C:\ProgramData\ITMS`.
- Verify the endpoint appears in ITMS with the correct user and department.
- Verify the Salt key appears on the master and is explicitly accepted.
- Verify `test.ping` succeeds for the Windows minion.

### Windows post-checks

- Run one inventory refresh and confirm the asset record updates.
- Use Salt, not SSH, as the default remote execution path.
- Enable OpenSSH only for systems that truly require interactive terminal access.
- Confirm terminal sessions and patch runs create audit records in ITMS where enabled.

## 5. SSH Access Rollout

Use SSH only for endpoints that need interactive operator access.

### Preferred model

- use SSH certificates signed by a central SSH CA
- keep certificate validity short
- restrict principals to approved admin accounts
- keep host verification enabled

### SSH checklist

- Install the approved public key or enable SSH CA trust on the endpoint.
- Ensure the endpoint exposes SSH only on private addresses or approved jump paths.
- Confirm the backend knows the correct username via `SSH_TERMINAL_USERNAME` or host overrides.
- Confirm the endpoint host key is present in the known-hosts file used by the backend.
- If using certificates, place the signed user certificate on the backend host and set `SSH_TERMINAL_CERTIFICATE_PATH`.
- Verify an SSH terminal session opens from ITMS for one Linux test asset.
- Verify the session records both asset history and audit log entries.

Use [scripts/install-itms-ssh-key.sh](/home/itteam/itms/scripts/install-itms-ssh-key.sh) when a managed public-key install is required instead of certificates.

## 6. Salt Patch Rollout

Use Salt as the default patch plane for the fleet.

### Patch checklist

- Define patch rings before enabling large-scale execution.
- Group by department, site, OS family, and criticality.
- Start with IT test systems.
- Run pilot batches before broad rollout.
- Keep servers and special-purpose devices in smaller controlled rings.
- Do not patch all devices at once.

### Recommended batch pattern

- workstations: 50 to 100 systems per batch
- pilot ring: 10 to 25 systems per batch
- servers or critical assets: smaller manual windows

### Patch validation

- Confirm the target minions are connected before each batch.
- Confirm the Salt API is reachable from the backend.
- Confirm a patch run produces a per-device report in ITMS.
- Confirm failed runs create actionable audit and alert signals.

## 7. Logging And Audit

The rollout is not complete unless logging is verified.

### Required checks

- terminal sessions create audit records
- terminal commands create audit or blocked-command records
- patch runs create audit records
- patch reports retain per-device outcomes
- asset history shows terminal activity for the selected asset

The current repo already records these paths in the backend router and terminal flows. Validate them during pilot rollout, not after full deployment.

## 8. Security Review Before Scale-Up

Before moving from pilot to broad rollout:

- rotate Salt API credentials if any temporary credentials were used
- verify no placeholder secrets remain in backend env files
- verify SSH strict host key checking remains enabled
- verify no endpoint still depends on password SSH for admin access
- verify minion acceptance is controlled and documented
- verify audit export works for terminal and patch actions

## 9. Pilot Exit Criteria

Move from pilot to larger rings only when all of these are true:

- Linux enrollment succeeds end-to-end
- Windows enrollment succeeds end-to-end
- Salt `test.ping` works for pilot devices
- SSH terminal access works for the approved SSH subset
- patch reports show correct per-device outcomes
- audit logs show who opened terminals and who ran patch actions
- device identity is stable across refreshes and reboots

## 10. Fleet Operations Rules

- Salt is the default action path for patching and scripted execution.
- SSH is reserved for interactive troubleshooting and investigation.
- Do not target fleet actions by raw hostname pattern alone.
- Prefer department, site, OS, and ring metadata for selection.
- Keep onboarding staggered to avoid inventory and Salt storms.

## Example Commands

### Linux bootstrap

```bash
sudo ./scripts/install-itms-agent.sh \
  --server-url http://itms.example.com \
  --token <inventory_ingest_token> \
  --salt-master YOUR_SERVER_IP \
  --assigned-to-name "Employee Name" \
  --assigned-to-email employee@example.com \
  --employee-code EMP-1001 \
  --department-name "IT Operations" \
  --require-salt
```

### Windows bootstrap

```powershell
.\scripts\install-itms-agent.ps1 `
  -ServerUrl http://itms.example.com `
  -Token <inventory_ingest_token> `
  -SaltMaster YOUR_SERVER_IP `
  -AssignedToName "Employee Name" `
  -AssignedToEmail employee@example.com `
  -EmployeeCode EMP-1001 `
  -DepartmentName "IT Operations"
```

## Decision

For a secure rollout across 1500 mixed-OS systems:

- install Salt on every managed endpoint
- enable SSH only where interactive access is actually needed
- use SSH certificates or managed keys, never shared passwords
- keep strict host verification and explicit Salt key approval
- validate audit logs during pilot, not after full deployment