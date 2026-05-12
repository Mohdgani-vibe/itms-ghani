# Auditor Portal Access

This note documents the intended auditor portal surface and the backend enforcement that currently backs it.

## Allowed Auditor Routes

Auditors are limited to the `/audit/*` portal shell and default to `/audit/dashboard`, which redirects to `/audit/alerts`.

- `Users`: directory and user detail views only
- `Devices`: device list and device detail views
- `Stock Inventory`: read-only stock listing
- `Alerts`: entity-scoped alert listing and review
- `Patch`: read-only dashboard and device list
- `Announcements`: read-only announcement feed

## Blocked Auditor Actions

Auditors must not be able to perform the following actions:

- open admin or IT portal routes directly
- access chat or settings through the audit portal
- view user audit logs
- run patch actions or open Salt consoles
- view patch run reports
- acknowledge or resolve alerts
- create announcements
- access terminal or SSH routes

## Frontend Enforcement

- Portal shell redirects are enforced in `frontend/src/App.tsx` through `getPortalAccessRedirect`.
- Standalone role-restricted routes are enforced in `frontend/src/App.tsx` through `getRoleAccessRedirect`.
- Users audit tab is hidden for auditors.
- Patch report panels and report fetches are disabled for auditors.
- Top navigation does not load hidden notification surfaces for auditors.

## Backend Enforcement

- `/api/audit` is restricted to `super_admin` and `it_team`.
- `/api/patch/reports` and `/api/patch/reports/:id` are restricted to `super_admin` and `it_team`.
- `/api/alerts/:id/acknowledge` rejects auditors.
- `/api/alerts/:id/resolve` rejects auditors.
- `/api/announcements` `POST` rejects auditors.
- `/api/chat/*`, terminal, and SSH routes remain non-auditor surfaces.

## Regression Coverage

Frontend regression coverage:

- `frontend/src/lib/portalGuards.test.ts`

Backend regression coverage:

- `backend/internal/api/router_auth_portal_notifications_test.go`
- `backend/internal/api/router_auth_scope_workflows_test.go`

Focused validations used while aligning the portal:

```bash
cd frontend
npm test -- src/lib/portalGuards.test.ts
npm run build

cd ../backend
go test ./internal/api
```