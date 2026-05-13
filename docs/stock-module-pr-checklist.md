# Inventory Module PR Checklist

## Scope

* Add `cost` support for inventory items end to end.
* Keep existing inventory allocation as the employee laptop assignment flow.
* Surface assigned inventory `cost` in admin and employee asset views.

## Included Files

* `backend/db/migrations/003_stock.sql`
* `backend/db/postgres_migrations/024_stock_item_cost.sql`
* `backend/internal/api/modules.go`
* `backend/internal/api/router.go`
* `frontend/src/pages/Inventory.tsx`
* `frontend/src/components/inventory/InventoryItemForm.tsx`
* `frontend/src/components/inventory/InventoryRegistry.tsx`
* `frontend/src/components/inventory/InventoryItemDetailDrawer.tsx`
* `frontend/src/components/inventory/InventoryRegistry.test.tsx`
* `frontend/src/components/inventory/InventoryItemDetailDrawer.test.tsx`
* `frontend/src/pages/live/MyAssetsPage.tsx`
* `frontend/src/pages/live/UsersPage.tsx`
* `frontend/src/pages/live/UserProfilePage.tsx`
* `frontend/src/components/users/UserAssignedAssetsPanel.tsx`
* `frontend/src/components/users/UserAssignedAssetsPanel.test.tsx`
* `frontend/src/components/users/userDisplayUtils.ts`
* `frontend/src/lib/portalGuards.ts`
* `frontend/src/lib/portalGuards.test.ts`

## Reviewer Checks

* Confirm `inventory_items.cost` is added for postgres deployments.
* Confirm inventory create, update, and list APIs accept and return `cost`.
* Confirm assigned-assets APIs include inventory `cost`.
* Confirm inventory UI shows `cost`, `warranty`, and assignee details.
* Confirm employee-facing asset screens show inventory `cost` when applicable.
* Confirm inventory allocation remains the assignment path.

## Validation

* Apply migration `024_stock_item_cost.sql`.
* Run backend tests for touched API paths.
* Run frontend tests including inventory and portal guard coverage.
* Verify create inventory item -> allocate to employee -> view from admin and employee screens -> return/delete cleanup.

## Artifacts

* Stock-only patch: `docs/stock-module-stock-only.patch`
