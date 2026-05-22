package api

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/middleware"
)

func newTestServer(t *testing.T) (*apiServer, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	return &apiServer{db: db}, mock, func() { _ = db.Close() }
}

func newTestContext(method string, target string, claims *authn.Claims) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(method, target, nil)
	context.Request = request
	if claims != nil {
		context.Set(middleware.ClaimsKey, claims)
	}
	return context, recorder
}

func newTestClaims(role string, userID string, entityID string) *authn.Claims {
	return &authn.Claims{
		UserID:   userID,
		Role:     role,
		EntityID: entityID,
		Email:    role + "@example.com",
		Name:     role,
	}
}

func expectEntityAccessCheck(mock sqlmock.Sqlmock, userID string, entityID string, allowed bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT EXISTS(SELECT 1 FROM user_entity_access WHERE user_id = $1::uuid AND entity_id = $2::uuid)`)).
		WithArgs(userID, entityID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(allowed))
}

func expectRequestScopeLookup(mock sqlmock.Sqlmock, requestID string, entityID string, requestType string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT requester.entity_id::text, r.type
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		WHERE r.id = $1::uuid
	`)).WithArgs(requestID).WillReturnRows(sqlmock.NewRows([]string{"entity_id", "type"}).AddRow(entityID, requestType))
}

func expectGatepassScopeLookup(mock sqlmock.Sqlmock, gatepassID string, requesterID string, entityID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT requester.id::text, requester.entity_id::text
		FROM gatepasses g
		JOIN users requester ON requester.id = g.requester_id
		WHERE g.id = $1::uuid
	`)).WithArgs(gatepassID).WillReturnRows(sqlmock.NewRows([]string{"requester_id", "entity_id"}).AddRow(requesterID, entityID))
}

func expectInventoryItemScopeLookup(mock sqlmock.Sqlmock, inventoryItemID string, branchEntityID any, assignedEntityID any) {
       mock.ExpectQuery(regexp.QuoteMeta(`
	       SELECT l.entity_id::text, u.entity_id::text
	       FROM stock_items s
	       LEFT JOIN locations l ON l.id = s.branch_id
	       LEFT JOIN users u ON u.id = s.assigned_user_id
	       WHERE s.id = $1::uuid
       `)).WithArgs(inventoryItemID).WillReturnRows(sqlmock.NewRows([]string{"branch_entity_id", "assigned_entity_id"}).AddRow(branchEntityID, assignedEntityID))
}

func expectAlertScopeLookup(mock sqlmock.Sqlmock, alertID string, assetEntityID any, userEntityID any, alertUserID any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.entity_id::text, u.entity_id::text, al.user_id::text
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		WHERE al.id = $1::uuid
	`)).WithArgs(alertID).WillReturnRows(sqlmock.NewRows([]string{"asset_entity_id", "user_entity_id", "user_id"}).AddRow(assetEntityID, userEntityID, alertUserID))
}

func expectUserByIDLookup(mock sqlmock.Sqlmock, userID string, empID string, fullName string, email string, entityID any, role string, active bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT u.id, u.emp_id, u.full_name, u.email, u.entity_id::text, u.dept_id::text, u.location_id::text, r.name, u.password_hash, u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.id = $1::uuid
	`)).WithArgs(userID).WillReturnRows(sqlmock.NewRows([]string{"id", "emp_id", "full_name", "email", "entity_id", "dept_id", "location_id", "role", "password_hash", "is_active"}).AddRow(userID, empID, fullName, email, entityID, nil, nil, role, nil, active))
}

func expectWorkflowSettingsLookup(mock sqlmock.Sqlmock, raw string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT value, updated_at FROM settings WHERE key = $1`)).
		WithArgs("workflow_settings").
		WillReturnRows(sqlmock.NewRows([]string{"value", "updated_at"}).AddRow(raw, time.Now().UTC()))
}

func expectActiveWorkflowUserLookup(mock sqlmock.Sqlmock, userID string, role string, active bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT r.name, u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.id = $1::uuid
	`)).WithArgs(userID).WillReturnRows(sqlmock.NewRows([]string{"name", "is_active"}).AddRow(role, active))
}

func TestRequestScopeReturnsTypeForAllowedEntity(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/requests/request-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectRequestScopeLookup(mock, "request-1", "entity-1", "support_chat")

	requestType, err := server.requestScope(context, "request-1")
	if err != nil {
		t.Fatalf("requestScope error: %v", err)
	}
	if requestType != "support_chat" {
		t.Fatalf("requestScope type = %q, want support_chat", requestType)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequestScopeReturnsNotFoundForForbiddenEntity(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/requests/request-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectRequestScopeLookup(mock, "request-1", "entity-2", "support_chat")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	_, err := server.requestScope(context, "request-1")
	if err == nil || err != sql.ErrNoRows {
		t.Fatalf("requestScope error = %v, want sql.ErrNoRows", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGatepassScopeRejectsOtherEmployeesGatepass(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/gatepass/gatepass-1", newTestClaims("employee", "employee-1", "entity-1"))

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-1")

	allowed, err := server.gatepassScope(context, "gatepass-1")
	if err != nil {
		t.Fatalf("gatepassScope error: %v", err)
	}
	if allowed {
		t.Fatal("gatepassScope allowed gatepass outside employee ownership")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGatepassScopeAllowsITDelegatedEntityAccess(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/gatepass/gatepass-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)

	allowed, err := server.gatepassScope(context, "gatepass-1")
	if err != nil {
		t.Fatalf("gatepassScope error: %v", err)
	}
	if !allowed {
		t.Fatal("gatepassScope denied gatepass in delegated entity")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestInventoryItemScopeAllowsAssignedEntityDelegation(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/inventory/inventory-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectInventoryItemScopeLookup(mock, "inventory-1", "entity-3", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-3", false)
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)

	allowed, err := server.inventoryItemScope(context, "inventory-1")
	if err != nil {
		t.Fatalf("stockItemScope error: %v", err)
	}
	       if !allowed {
		       t.Fatal("inventoryItemScope denied inventory item linked through delegated assignee entity")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestInventoryItemScopeRejectsOutOfScopeItem(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/inventory/inventory-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectInventoryItemScopeLookup(mock, "inventory-1", "entity-3", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-3", false)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	allowed, err := server.inventoryItemScope(context, "inventory-1")
	if err != nil {
		t.Fatalf("stockItemScope error: %v", err)
	}
	       if allowed {
		       t.Fatal("inventoryItemScope allowed inventory item outside visible entities")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAllocateInventoryItemRejectsOutOfScopeAssignee(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPost, "/inventory/inventory-1/allocate", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "inventory-1"}}
	context.Request = httptest.NewRequest(http.MethodPost, "/inventory/inventory-1/allocate", strings.NewReader(`{"userId":"assignee-1"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	expectInventoryItemScopeLookup(mock, "inventory-1", "entity-1", nil)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "employee", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.allocateInventoryItem(context)

	       if recorder.Code != http.StatusBadRequest {
		       t.Fatalf("allocateInventoryItem status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAssignRequestRejectsOutOfScopeAssignee(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPost, "/requests/request-1/assign", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "request-1"}}
	context.Request = httptest.NewRequest(http.MethodPost, "/requests/request-1/assign", strings.NewReader(`{"assigneeId":"assignee-1"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	expectRequestScopeLookup(mock, "request-1", "entity-1", "support_chat")
	expectWorkflowSettingsLookup(mock, `{"ticketAssigneeIds":["assignee-1"]}`)
	expectActiveWorkflowUserLookup(mock, "assignee-1", "it_team", true)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "it_team", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.assignRequest(context)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("assignRequest status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAcknowledgeAlertHidesOutOfScopeAlert(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPost, "/alerts/alert-1/acknowledge", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "alert-1"}}

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.acknowledgeAlert(context)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("acknowledgeAlert status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAcknowledgeAlertAllowsEmployeeOwnedAlert(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPost, "/alerts/alert-1/acknowledge", newTestClaims("employee", "employee-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "alert-1"}}

	expectAlertScopeLookup(mock, "alert-1", nil, "entity-1", "employee-1")
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE alerts SET acknowledged = TRUE WHERE id = $1::uuid AND user_id = $2::uuid RETURNING title, user_id`)).WithArgs("alert-1", "employee-1").WillReturnRows(sqlmock.NewRows([]string{"title", "user_id"}).AddRow("Disk encryption disabled", "employee-1"))

	server.acknowledgeAlert(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("acknowledgeAlert status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestDecideGatepassHidesOutOfScopeGatepass(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPut, "/gatepass/gatepass-1/approve", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "gatepass-1"}}

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.decideGatepass(context, "approved")

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("decideGatepass status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestResolveAlertHidesOutOfScopeAlert(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodPost, "/alerts/alert-1/resolve", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "alert-1"}}

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.resolveAlert(context)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("resolveAlert status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAlertScopeAllowsDelegatedEntityAccess(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, _ := newTestContext(http.MethodGet, "/alerts/alert-1", newTestClaims("it_team", "user-1", "entity-1"))

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)

	allowed, err := server.alertScope(context, "alert-1")
	if err != nil {
		t.Fatalf("alertScope error: %v", err)
	}
	if !allowed {
		t.Fatal("alertScope denied alert in delegated entity")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListAuditRejectsOutOfScopeEntityFilter(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodGet, "/audit?entity=entity-2", newTestClaims("it_team", "user-1", "entity-1"))

	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.listAudit(context)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("listAudit status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetAuditHidesOutOfScopeRow(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()
	context, recorder := newTestContext(http.MethodGet, "/audit/audit-1", newTestClaims("it_team", "user-1", "entity-1"))
	context.Params = gin.Params{{Key: "id", Value: "audit-1"}}

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(actor_id::text, ''), COALESCE(entity_id::text, ''), action, COALESCE(target_type, ''), COALESCE(target_id::text, ''), detail, created_at
		FROM audit_log WHERE id = $1::uuid
	`)).WithArgs("audit-1").WillReturnRows(sqlmock.NewRows([]string{"actor_id", "entity_id", "action", "target_type", "target_id", "detail", "created_at"}).AddRow("actor-1", "entity-2", "request_status_changed", "request", "request-1", []byte(`{"ok":true}`), time.Now().UTC()))
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	server.getAudit(context)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("getAudit status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}