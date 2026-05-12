package api

import (
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRouterAllocateInventoryRejectsOutOfScopeAssignee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/inventory-1/allocate", `{"userId":"assignee-1"}`)
	defer cleanup()

	expectStockItemScopeLookup(mock, "inventory-1", "entity-1", nil)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "employee", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "allocate inventory route")
}

func TestRouterListInventoryAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/inventory", "")
	defer cleanup()

	createdAt := time.Now().UTC()

	expectInventorySummaryQuery(mock, "entity-1", "user-1", 1, 1, 0, 0, 0, 1)
	expectInventoryGroupQuery(mock, "entity-1", "user-1", "Laptop", "ThinkPad T14", 1, 1, 0, 0, 0)
	expectInventoryListQuery(mock, "entity-1", "user-1", "inventory-1", "ITMS-0001", "Laptop", "ThinkPad T14", "SN-1", "16GB RAM", "branch-2", "", "", "85499.00", "inventory", createdAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list inventory route")
}

func TestRouterCreateInventoryRejectsOutOfScopeBranch(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory", `{"category":"Laptop","name":"ThinkPad T14","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"16GB RAM","branchId":"branch-2","warrantyExpiresAt":"2027-01-01","cost":"85499.00"}`)
	defer cleanup()

	expectLocationScope(mock, "branch-2", "entity-2", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create inventory out-of-scope branch")
}

func TestRouterCreateInventoryAllowsDelegatedBranch(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory", `{"category":"Laptop","name":"ThinkPad T14","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"16GB RAM","branchId":"branch-2","warrantyExpiresAt":"2027-01-01","cost":"85499.00"}`)
	defer cleanup()

	expectLocationScope(mock, "branch-2", "entity-2", "user-1", true)
	expectInventoryCreate(mock, "Laptop", "ThinkPad T14", "ITMS-0001", "SN-1", "16GB RAM", "branch-2", "2027-01-01", "85499.00", "", "inventory-1", "ITMS-0001")
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_created", "inventory_item", "inventory-1", `{"category":"Laptop","name":"ThinkPad T14","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"16GB RAM","branchId":"branch-2","warrantyExpiresAt":"2027-01-01","cost":"85499.00","status":""}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "create inventory delegated branch")
}

func TestRouterUpdateInventoryHidesOutOfScopeItem(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPatch, "/api/inventory/inventory-1", `{"category":"Laptop","name":"ThinkPad T14","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"16GB RAM","branchId":"branch-1","warrantyExpiresAt":"2027-01-01","cost":"85499.00"}`)
	defer cleanup()

	expectInventoryScopeDelegated(mock, "inventory-1", "entity-2", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "update inventory out-of-scope item")
}

func TestRouterUpdateStockAllowsDelegatedBranch(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPatch, "/api/inventory/stock-1", `{"category":"Laptop","name":"ThinkPad T14 Gen 2","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"32GB RAM","branchId":"branch-2","warrantyExpiresAt":"2027-06-01","cost":"92499.00"}`)
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", true)
	expectLocationScope(mock, "branch-2", "entity-2", "user-1", true)
	expectInventoryUpdate(mock, "stock-1", "Laptop", "ThinkPad T14 Gen 2", "ITMS-0001", "SN-1", "32GB RAM", "branch-2", "2027-06-01", "92499.00", "", 1)
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_updated", "inventory_item", "stock-1", `{"category":"Laptop","name":"ThinkPad T14 Gen 2","assetTag":"ITMS-0001","serialNumber":"SN-1","specs":"32GB RAM","branchId":"branch-2","warrantyExpiresAt":"2027-06-01","cost":"92499.00","status":""}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "update stock delegated branch")
}

func TestRouterDeleteStockHidesOutOfScopeItem(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/inventory/stock-1", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "delete stock out-of-scope item")
}

func TestRouterDeleteStockAllowsVisibleReturnedItem(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/inventory/stock-1", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", true)
	expectStockStatusLookup(mock, "stock-1", "returned")
	expectStockDelete(mock, "stock-1", 1)
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_deleted", "inventory_item", "stock-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "delete stock visible returned item")
}

func TestRouterAllocateStockAllowsVisibleAssignee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/stock-1/allocate", `{"userId":"assignee-1"}`)
	defer cleanup()

	expectStockItemScopeLookup(mock, "stock-1", "entity-1", nil)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "employee", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE stock_items
		SET assigned_user_id = $2::uuid, status = 'allocated', updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs("stock-1", "assignee-1").WillReturnResult(sqlmock.NewResult(1, 1))
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_allocated", "inventory_item", "stock-1", `{"userId":"assignee-1"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "allocate stock route")
}

func TestRouterReturnStockHidesOutOfScopeItem(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/stock-1/return", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "return stock route")
}

func TestRouterReturnStockAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/stock-1/return", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", true)
	expectStockItemStatusUpdate(mock, "stock-1", "returned")
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_returned", "inventory_item", "stock-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "return stock route")
}

func TestRouterRetireStockHidesOutOfScopeItem(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/stock-1/retire", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "retire stock route")
}

func TestRouterRetireStockAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/stock-1/retire", "")
	defer cleanup()

	expectInventoryScopeDelegated(mock, "stock-1", "entity-2", "user-1", true)
	expectStockItemStatusUpdate(mock, "stock-1", "retired")
	expectAuditInsert(mock, "user-1", "entity-1", "inventory_item_retired", "inventory_item", "stock-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "retire stock route")
}