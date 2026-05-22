package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRouterListMyRequestsAllowsEmployee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/me/requests", "")
	defer cleanup()

	now := time.Now().UTC()

	expectRequestLoad(mock, ` WHERE r.requester_id = $1::uuid`, []any{"employee-1"}, "request-1", "hardware", "Battery replacement", "Laptop battery issue", "pending", "", now, now, "employee-1", "Employee One", "owner-1", "IT Owner")
	expectRequestCommentsLookup(mock, "request-1")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list my requests route")
}

func TestRouterGetMyRequestHidesOtherUsersRequest(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/me/requests/request-1", "")
	defer cleanup()

	expectRequestLoadEmpty(mock, ` WHERE r.id = $1::uuid AND r.requester_id = $2::uuid`, []any{"request-1", "employee-1"})

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "get my request hidden route")
}

func TestRouterCreateMyRequestAllowsEmployee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/me/requests", `{"type":"hardware","title":"Battery replacement","description":"Laptop battery issue"}`)
	defer cleanup()

	expectWorkflowSettingsLookup(mock, `{"requestAutoAssignEnabled":true,"requestFallbackAssigneeId":"owner-1"}`)
	expectRequestCreate(mock, "employee-1", "owner-1", "hardware", "Battery replacement", "Laptop battery issue", "request-1")
	expectAuditInsert(mock, "employee-1", "entity-1", "request_created", "request", "request-1", `{"assigneeId":"owner-1","description":"Laptop battery issue","title":"Battery replacement","type":"hardware"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "create my request route")
}

func TestRouterCommentMyRequestRejectsOtherUsersRequest(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/me/requests/request-1/comment", `{"note":"Need update"}`)
	defer cleanup()

	expectRequestCommentOwnership(mock, "request-1", "employee-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "comment my request hidden route")
}

func TestRouterCommentMyRequestAllowsOwner(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/me/requests/request-1/comment", `{"note":"Need update"}`)
	defer cleanup()

	expectRequestCommentOwnership(mock, "request-1", "employee-1", true)
	expectRequestCommentInsert(mock, "request-1", "employee-1", "Need update")
	expectAuditInsert(mock, "employee-1", "entity-1", "request_commented", "request", "request-1", `{"note":"Need update"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "comment my request route")
}

func TestRouterListRequestsRejectsEmployeeRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/requests", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list requests employee role")
}

func TestRouterListUsersScopesEmployeeToSelf(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/users", "")
	defer cleanup()

	mock.ExpectQuery(`SELECT u\.id::text, .*COALESCE\(l\.full_name, ''\), .*AS asset_count, COUNT\(\*\) OVER\(\) FROM users u LEFT JOIN roles r ON r\.id = u\.role_id LEFT JOIN departments d ON d\.id = u\.dept_id LEFT JOIN locations l ON l\.id = u\.location_id WHERE 1 = 1 AND u\.id = \$1::uuid AND lower\(u\.full_name\) NOT LIKE '%probe%' AND lower\(u\.full_name\) NOT LIKE '%smoke%' AND lower\(COALESCE\(u\.email, ''\)\) NOT LIKE '%probe%' AND lower\(COALESCE\(u\.email, ''\)\) NOT LIKE '%smoke%' AND lower\(COALESCE\(u\.emp_id, ''\)\) NOT LIKE '%probe%' AND lower\(COALESCE\(u\.emp_id, ''\)\) NOT LIKE '%smoke%' ORDER BY COALESCE\(u\.full_name, ''\), COALESCE\(u\.email, ''\), u\.id`).WithArgs("employee-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "full_name", "email", "emp_id", "status", "entity_id", "dept_id", "location_id", "role", "department_name", "location_name", "asset_count", "count",
	}).AddRow("employee-1", "Portal Employee", "employee@example.com", "EMP-1", "active", "entity-1", "dept-1", "loc-1", "employee", "Engineering", "Bengaluru", 1, 1))
	mock.ExpectQuery(`SELECT department_label, COUNT\(\*\) FROM \( SELECT COALESCE\(NULLIF\(d\.name, ''\), NULLIF\(l\.full_name, ''\), 'Unassigned'\) AS department_label FROM users u LEFT JOIN roles r ON r\.id = u\.role_id LEFT JOIN departments d ON d\.id = u\.dept_id LEFT JOIN locations l ON l\.id = u\.location_id WHERE 1 = 1 AND u\.id = \$1::uuid AND lower\(u\.full_name\) NOT LIKE '%probe%' AND lower\(u\.full_name\) NOT LIKE '%smoke%' AND lower\(COALESCE\(u\.email, ''\)\) NOT LIKE '%probe%' AND lower\(COALESCE\(u\.email, ''\)\) NOT LIKE '%smoke%' AND lower\(COALESCE\(u\.emp_id, ''\)\) NOT LIKE '%probe%' AND lower\(COALESCE\(u\.emp_id, ''\)\) NOT LIKE '%smoke%' \) summary_users GROUP BY department_label ORDER BY COUNT\(\*\) DESC, department_label ASC`).WithArgs("employee-1").WillReturnRows(sqlmock.NewRows([]string{"department_label", "count"}).AddRow("Engineering", 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list users employee role")

	var body struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Total != 1 {
		t.Fatalf("total = %d, want 1", body.Total)
	}
	if len(body.Items) != 1 || body.Items[0].ID != "employee-1" {
		t.Fatalf("items = %+v, want single employee self row", body.Items)
	}
}

func TestRouterGetUserAssetsRejectsOutOfScopeUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/users/user-2/assets", "")
	defer cleanup()

	expectUserByIDLookup(mock, "user-2", "EMP-2", "Scoped User", "user-2@example.com", "entity-2", "employee", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "get user assets out-of-scope route")
}

func TestRouterUserMetaOptionsScopesDepartmentsAndBranches(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/users/meta/options", "")
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name FROM roles ORDER BY name`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("role-1", "employee"))
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT d.id, d.name
			FROM departments d
			WHERE d.entity_id = $1::uuid
			   OR EXISTS (
			       SELECT 1 FROM user_entity_access uea
			       WHERE uea.user_id = $2::uuid AND uea.entity_id = d.entity_id
			   )
			ORDER BY d.name`)).
		WithArgs("entity-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("dept-1", "Finance"))
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT l.id, l.full_name AS name
			FROM locations l
			WHERE l.entity_id = $1::uuid
			   OR EXISTS (
			       SELECT 1 FROM user_entity_access uea
			       WHERE uea.user_id = $2::uuid AND uea.entity_id = l.entity_id
			   )
			ORDER BY l.full_name`)).
		WithArgs("entity-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("branch-1", "HQ"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "user meta options scoped route")

	var body struct {
		Roles []struct {
			ID string `json:"id"`
		} `json:"roles"`
		Departments []struct {
			ID string `json:"id"`
		} `json:"departments"`
		Branches []struct {
			ID string `json:"id"`
		} `json:"branches"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(body.Roles) != 1 || body.Roles[0].ID != "role-1" {
		t.Fatalf("roles = %+v, want roles payload", body.Roles)
	}
	if len(body.Departments) != 1 || body.Departments[0].ID != "dept-1" {
		t.Fatalf("departments = %+v, want scoped department payload", body.Departments)
	}
	if len(body.Branches) != 1 || body.Branches[0].ID != "branch-1" {
		t.Fatalf("branches = %+v, want scoped branch payload", body.Branches)
	}
}

func TestRouterListRequestsAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-2 * time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	expectRequestListSummaryQuery(mock, "entity-1", "user-1", 1, 1, 0, 0, 0, 0)
	expectRequestLoad(mock, `
		WHERE 1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected'`, []any{"entity-1", "user-1"}, "request-1", "support_chat", "VPN issue", "Needs access", "pending", "", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-1", "comment-1", "Assignee User", "Investigating", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests delegated entity route")
}

func TestRouterListRequestsPaginatesResults(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests?paginate=1&page=2&page_size=1", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-2 * time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	expectRequestListSummaryQuery(mock, "entity-1", "user-1", 2, 1, 1, 0, 0, 0)
	expectRequestLoadPaged(mock, `
		WHERE 1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected'`, []any{"entity-1", "user-1", 1, 1}, "request-2", "support_chat", "VPN issue", "Needs access", "in_progress", "", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-2", "comment-2", "Assignee User", "Investigating", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests pagination")
}

func TestRouterListRequestsFiltersByStatus(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests?status=resolved", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	clause := "1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status = $3"
	expectRequestListSummaryWithClause(mock, clause, []any{"entity-1", "user-1", "resolved"}, 1, 0, 0, 1, 0, 0)
	expectRequestLoad(mock, `
		WHERE `+clause, []any{"entity-1", "user-1", "resolved"}, "request-3", "support_chat", "Closed VPN issue", "Resolved access request", "resolved", "done", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-3", "comment-3", "Assignee User", "Resolved", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests status filter")
}

func TestRouterListRequestsFiltersByOtherType(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests?type=other", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	clause := "1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected' AND r.type <> $3"
	expectRequestListSummaryWithClause(mock, clause, []any{"entity-1", "user-1", "device_enrollment"}, 1, 1, 0, 0, 0, 0)
	expectRequestLoad(mock, `
		WHERE `+clause, []any{"entity-1", "user-1", "device_enrollment"}, "request-4", "hardware", "Battery replacement", "Laptop battery issue", "pending", "", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-4", "comment-4", "Assignee User", "Investigating", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests type other filter")
}

func TestRouterListRequestsFiltersByDeviceEnrollmentType(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests?type=device_enrollment", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	clause := "1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected' AND r.type = $3"
	expectRequestListSummaryWithClause(mock, clause, []any{"entity-1", "user-1", "device_enrollment"}, 1, 1, 0, 0, 1, 1)
	expectRequestLoad(mock, `
		WHERE `+clause, []any{"entity-1", "user-1", "device_enrollment"}, "request-6", "device_enrollment", "Enroll new laptop", "Provision device for onboarding", "pending", "", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-6", "comment-6", "Assignee User", "Queued", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests device enrollment filter")
}

func TestRouterListRequestsFiltersBySearchAndLookup(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/requests?search=vpn&lookup=host-77", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := time.Now().UTC()
	commentedAt := updatedAt.Add(5 * time.Minute)

	clause := "1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected' AND (lower(COALESCE(r.description, '')) LIKE $3) AND lower(concat_ws(' ', r.title, r.type, COALESCE(r.description, ''), requester.full_name, COALESCE(assignee.full_name, ''), r.id::text)) LIKE $4"
	expectRequestListSummaryWithClause(mock, clause, []any{"entity-1", "user-1", "%asset tag / host: host-77%", "%vpn%"}, 1, 1, 0, 0, 0, 0)
	expectRequestLoad(mock, `
		WHERE `+clause, []any{"entity-1", "user-1", "%asset tag / host: host-77%", "%vpn%"}, "request-5", "support_chat", "VPN issue", "Asset tag / host: host-77 cannot reach VPN gateway", "pending", "", createdAt, updatedAt, "requester-1", "Requester User", "assignee-1", "Assignee User")
	expectRequestCommentBatchLookup(mock, "request-5", "comment-5", "Assignee User", "Investigating", commentedAt)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list requests search lookup filters")
}

func TestRouterAcknowledgeAlertHidesOutOfScopeAlert(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/acknowledge", "")
	defer cleanup()

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "acknowledge alert route")
}

func TestRouterAcknowledgeAlertAllowsEmployeeOwnedAlert(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/acknowledge", "")
	defer cleanup()

	expectAlertScopeLookup(mock, "alert-1", nil, "entity-1", "employee-1")
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE alerts SET acknowledged = TRUE WHERE id = $1::uuid AND user_id = $2::uuid RETURNING title, user_id`)).
		WithArgs("alert-1", "employee-1").
		WillReturnRows(sqlmock.NewRows([]string{"title", "user_id"}).AddRow("Disk encryption disabled", "employee-1"))
	expectAuditInsert(mock, "employee-1", "entity-1", "alert_acknowledged", "alert", "alert-1", `{"title":"Disk encryption disabled","user_id":"employee-1"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "acknowledge alert route")
}

func TestRouterAcknowledgeAlertRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/acknowledge", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "acknowledge alert auditor role")
}

func TestRouterResolveAlertHidesOutOfScopeAlert(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/resolve", "")
	defer cleanup()

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "resolve alert route")
}

func TestRouterResolveAlertAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/resolve", "")
	defer cleanup()

	expectAlertScopeLookup(mock, "alert-1", "entity-2", nil, "alert-user")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE alerts SET resolved = TRUE, acknowledged = TRUE WHERE id = $1::uuid RETURNING title, user_id`)).
		WithArgs("alert-1").
		WillReturnRows(sqlmock.NewRows([]string{"title", "user_id"}).AddRow("Disk encryption disabled", "alert-user"))
	expectAuditInsert(mock, "user-1", "entity-1", "alert_resolved", "alert", "alert-1", `{"title":"Disk encryption disabled","user_id":"alert-user"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "resolve alert route")
}

func TestRouterResolveAlertRejectsEmployeeRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/resolve", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "resolve alert employee role")
}

func TestRouterResolveAlertRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPut, "/api/alerts/alert-1/resolve", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "resolve alert auditor role")
}

func TestRouterCreateGatepassRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPost, "/api/gatepass", `{"assetRef":"ASSET-1","assetDescription":"Laptop","purpose":"WFH","originBranch":"Bangalore","recipientBranch":"Mumbai","issueDate":"2026-04-27","employeeName":"Auditor QA","employeeCode":"EMP-1","departmentName":"Audit","approverName":"Manager","contactNumber":"9999999999"}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create gatepass auditor role")
}

func TestRouterApproveGatepassHidesOutOfScopeGatepass(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/gatepass/gatepass-1/approve", "")
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "approve gatepass route")
}

func TestRouterApproveGatepassAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/gatepass/gatepass-1/approve", "")
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectGatepassDecisionUpdate(mock, "gatepass-1", "approved", "user-1", "employee-2")
	expectAuditInsert(mock, "user-1", "entity-1", "gatepass_approved", "gatepass", "gatepass-1", `{"requester_id":"employee-2"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "approve gatepass route")
}

func TestRouterRejectGatepassHidesOutOfScopeGatepass(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/gatepass/gatepass-1/reject", "")
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "reject gatepass route")
}

func TestRouterRejectGatepassAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/gatepass/gatepass-1/reject", "")
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectGatepassDecisionUpdate(mock, "gatepass-1", "rejected", "user-1", "employee-2")
	expectAuditInsert(mock, "user-1", "entity-1", "gatepass_rejected", "gatepass", "gatepass-1", `{"requester_id":"employee-2"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "reject gatepass route")
}

func TestRouterCompleteGatepassHidesOutOfScopeGatepass(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/gatepass/gatepass-1/complete", `{"receiverSignedName":"Receiver User","securitySignedName":"Security User"}`)
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "complete gatepass route")
}

func TestRouterCompleteGatepassAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/gatepass/gatepass-1/complete", `{"receiverSignedName":"Receiver User","securitySignedName":"Security User"}`)
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectGatepassCompleteUpdate(mock, "gatepass-1", "Receiver User", "Security User")
	expectAuditInsert(mock, "user-1", "entity-1", "gatepass_completed", "gatepass", "gatepass-1", `{"receiverSignedName":"Receiver User","securitySignedName":"Security User"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "complete gatepass route")
}

func TestRouterUploadReceiverSignedGatepassHidesOutOfScopeGatepass(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleMultipartRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/gatepass/gatepass-1/receiver-upload", "Receiver User", "signed.pdf", "application/pdf", []byte("pdf"))
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "upload receiver gatepass route")
}

func TestRouterUploadReceiverSignedGatepassAllowsDelegatedEntityAccess(t *testing.T) {
	fileContent := []byte("pdf")
	verificationNotes := "Uploaded document stored, but automatic verification could not confidently match the generated gatepass markers."
	mock, recorder, router, request, cleanup := newRoleMultipartRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/gatepass/gatepass-1/receiver-upload", "Receiver User", "signed.pdf", "application/pdf", fileContent)
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectGatepassUploadMetadataLookup(mock, "gatepass-1", "GP-1", "ASSET-1", "EMP-1")
	expectGatepassReceiverUploadUpdate(mock, "gatepass-1", "Receiver User", "signed.pdf", "application/pdf", fileContent, "user-1", "review", verificationNotes)
	expectAuditInsert(mock, "user-1", "entity-1", "gatepass_receiver_upload", "gatepass", "gatepass-1", `{"fileName":"signed.pdf","receiverSignedName":"Receiver User","verificationNotes":"Uploaded document stored, but automatic verification could not confidently match the generated gatepass markers.","verificationStatus":"review"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "upload receiver gatepass route")
}

func TestRouterDownloadReceiverSignedGatepassRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/gatepass/gatepass-1/receiver-upload?download=1", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "download receiver gatepass auditor role")
}

func TestRouterDownloadReceiverSignedGatepassHidesOutOfScopeGatepass(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/gatepass/gatepass-1/receiver-upload", "")
	defer cleanup()

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "download receiver gatepass route")
}

func TestRouterDownloadReceiverSignedGatepassAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/gatepass/gatepass-1/receiver-upload?download=1", "")
	defer cleanup()

	fileContent := []byte("pdf")

	expectGatepassScopeLookup(mock, "gatepass-1", "employee-2", "entity-2")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectGatepassReceiverDownloadLookup(mock, "gatepass-1", "signed.pdf", "application/pdf", fileContent)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "download receiver gatepass route")
}

func TestRouterListAuditRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/audit", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list audit auditor role")
}

func TestRouterListPatchRunReportsRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/patch/reports", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list patch reports auditor role")
}

func TestRouterGetPatchRunReportRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/patch/reports/report-1", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "get patch report auditor role")
}

func TestRouterPatchDashboardRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/patch/dashboard", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "patch dashboard auditor role")
}

func TestRouterPatchDevicesRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/patch/devices", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "patch devices auditor role")
}

func TestRouterListAuditRejectsOutOfScopeEntityFilter(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/audit?entity=entity-2", "")
	defer cleanup()

	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list audit out-of-scope filter")
}

func TestRouterGetAuditHidesOutOfScopeRow(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/audit/audit-1", "")
	defer cleanup()

	now := time.Now().UTC()

	expectAuditDetailLookup(mock, "audit-1", "actor-1", "entity-2", "request_status_changed", "request", "request-1", []byte(`{"ok":true}`), now)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "get audit out-of-scope row")
}

func TestRouterListAuditAllowsSuperAdmin(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "super_admin", "admin-1", "entity-1", http.MethodGet, "/api/audit", "")
	defer cleanup()

	now := time.Now().UTC()

	expectAuditListQuery(mock, "Actor One", "EMP-1", "ENT", "request_status_changed", "request", "request-1", []byte(`{"ok":true}`), now)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list audit super admin")
}

func TestRouterGetAuditAllowsSuperAdmin(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "super_admin", "admin-1", "entity-1", http.MethodGet, "/api/audit/audit-1", "")
	defer cleanup()

	now := time.Now().UTC()

	expectAuditDetailLookup(mock, "audit-1", "actor-1", "entity-2", "request_status_changed", "request", "request-1", []byte(`{"ok":true}`), now)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get audit super admin")
}

func TestRouterUpdateRequestStatusHidesOutOfScopeRequest(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/requests/request-1/status", `{"status":"resolved","notes":"done"}`)
	defer cleanup()

	expectRequestScopeLookup(mock, "request-1", "entity-2", "support_chat")
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "update request status route")
}

func TestRouterUpdateRequestStatusAllowsDelegatedEntityAccess(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/requests/request-1/status", `{"status":"resolved","notes":"done"}`)
	defer cleanup()

	expectRequestScopeLookup(mock, "request-1", "entity-2", "support_chat")
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	expectRequestStatusUpdate(mock, "request-1", "resolved", "done")
	expectAuditInsert(mock, "user-1", "entity-1", "request_status_changed", "request", "request-1", `{"status":"resolved","notes":"done"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "update request status route")
}

func TestRouterAssignRequestRejectsOutOfScopeAssignee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/requests/request-1/assign", `{"assigneeId":"assignee-1"}`)
	defer cleanup()

	expectRequestScopeLookup(mock, "request-1", "entity-1", "support_chat")
	expectWorkflowSettingsLookup(mock, `{"ticketAssigneeIds":["assignee-1"]}`)
	expectActiveWorkflowUserLookup(mock, "assignee-1", "it_team", true)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "it_team", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "assign request route")
}

func TestRouterAssignRequestAllowsVisibleAssignee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/requests/request-1/assign", `{"assigneeId":"assignee-1"}`)
	defer cleanup()

	expectRequestScopeLookup(mock, "request-1", "entity-1", "support_chat")
	expectWorkflowSettingsLookup(mock, `{"ticketAssigneeIds":["assignee-1"]}`)
	expectActiveWorkflowUserLookup(mock, "assignee-1", "it_team", true)
	expectUserByIDLookup(mock, "assignee-1", "EMP-2", "Assignee User", "assignee@example.com", "entity-2", "it_team", true)
	expectEntityAccessCheck(mock, "user-1", "entity-2", true)
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE requests SET assignee_id = $2::uuid, updated_at = NOW() WHERE id = $1::uuid
	`)).WithArgs("request-1", "assignee-1").WillReturnResult(sqlmock.NewResult(1, 1))
	expectAuditInsert(mock, "user-1", "entity-1", "request_assigned", "request", "request-1", `{"assigneeId":"assignee-1"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "assign request route")
}

func TestRouterAssetSSHWebsocketKeepsClaimsForEntityScope(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleWebSocketRouteRequest(t, "it_team", "user-1", "entity-1", "/ws/ssh/assets/asset-1")
	defer cleanup()

	expectAssetLookup(mock, "asset-1", "ASSET-1", "Asset One", "asset-one", "Laptop", false, "entity-1", "", "", "in_service", "good")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "asset ssh websocket scope auth")
}
