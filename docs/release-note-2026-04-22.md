# ITMS Release Note

Date: 2026-04-22

## Summary

This release focused on security hardening, integration credential cleanup, and safer remote access behavior. There are no open hardening blockers from this pass, and the validated frontend, backend, and release-readiness checks are green.

## What Changed

- Replaced insecure default integration credentials with generated secrets and completed live Salt and Wazuh credential rotation.
- Tightened SSH terminal security by removing query-string websocket token auth, removing exposed key metadata from the UI, and blocking public inventory IPs from becoming backend SSH targets.
- Hardened deployment and operator tooling around SSH key installation, Salt API configuration, Teleport enrollment, and file permissions.
- Improved release-readiness checks so integration secret issues are detected earlier and OpenSCAP status handling is more resilient.

## Outcome

- Backend and frontend validation passed after the hardening changes.
- Live Salt and Wazuh authentication succeeded with the rotated credentials.
- Release readiness completed successfully.
- Remote administration flows are now stricter and less permissive by default.

## Reference

For the full technical change list and validation details, see `docs/release-hardening-summary-2026-04-22.md`.