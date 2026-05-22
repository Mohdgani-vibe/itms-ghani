# Live Validation - 2026-05-13

## Scope

Validated the local ITMS stack on this host after recent backend and frontend changes.

## Environment state

- Backend API was already up on `http://localhost:3001`
- Frontend preview was started on `http://localhost:4175`
- Docker health check passed for `zerodha-itms-backend` and Postgres

## Executable validation completed

- Backend API package tests passed:
  - `cd /home/itteam/itms/backend && GOTOOLCHAIN=local go test ./internal/api/...`
- Full backend Go suite passed:
  - `cd /home/itteam/itms/backend && GOTOOLCHAIN=local go test ./...`
- Frontend tests passed:
  - `cd /home/itteam/itms/frontend && npm test`
- Frontend production build passed:
  - `cd /home/itteam/itms/frontend && npm run build`
- Repo smoke test passed after admin credential repair:
  - `make -C /home/itteam/itms smoke-test`
- Stack verification passed:
  - `bash /home/itteam/itms/scripts/verify-itms-stack.sh`

## Live issue found and fixed

The authenticated Inventory route rendered a `404 page not found` error inside the page even though the route shell loaded.

Root cause:

- The frontend inventory API wrapper called backend routes that do not exist:
  - `/api/inventory/entities`
  - `/api/inventory/module/audit`
- The live backend exposes the generic routes instead:
  - `/api/entities`
  - `/api/audit?module=inventory`

Fix applied:

- Updated [frontend/src/lib/inventoryApi.ts](/home/itteam/itms/frontend/src/lib/inventoryApi.ts)
- Updated focused test in [frontend/src/lib/inventoryApi.test.ts](/home/itteam/itms/frontend/src/lib/inventoryApi.test.ts)

Focused post-fix validation:

- `cd /home/itteam/itms/frontend && npm test -- src/lib/inventoryApi.test.ts`
- `cd /home/itteam/itms/frontend && npm run build`
- Reloaded `/admin/inventory` in the browser and confirmed the 404 banner disappeared

## Live credential repair performed

The initial backend smoke test failed because the live admin password hash in the database had drifted from the current env files.

Repair performed:

- `cd /home/itteam/itms/backend && set -a && source .env && source .env.secrets && set +a && GOTOOLCHAIN=local go run ./cmd/sync_default_admin_password`

Result:

- Admin login succeeded afterward
- Repo smoke test passed end to end

## Authenticated browser route sweep

Logged in with the configured super admin and verified these routes render successfully:

- `/admin/dashboard`
- `/admin/inventory`
- `/admin/alerts`
- `/admin/requests`
- `/admin/gatepass`
- `/admin/chat`
- `/admin/announcements`
- `/admin/settings`

## Current outcome

- Local stack is healthy
- Authenticated admin portal routes listed above render successfully
- The only runtime issue found during the sweep was the Inventory API route mismatch, and it is fixed