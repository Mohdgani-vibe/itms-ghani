package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/middleware"
)

func TestPatchDevicesCompatUsesAssignedUserDepartmentFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	server := &apiServer{db: db}
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/patch/devices", nil)
	context.Set(middleware.ClaimsKey, &authn.Claims{UserID: "admin-1", Role: "super_admin", EntityID: "entity-1", Email: "admin@example.com", Name: "Admin"})

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.id, a.asset_tag, COALESCE(NULLIF(a.hostname, ''), a.asset_tag), a.category, COALESCE(cd.os_name, ''), COALESCE(cd.last_seen::text, ''), a.status,
			COALESCE(cd.pending_updates, 0), COALESCE(alerts.open_alerts, 0), COALESCE(a.serial_number, ''), COALESCE(a.model, ''),
			COALESCE(a.warranty_until::text, ''), COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''), COALESCE(u.emp_id, ''),
			COALESCE(ad.name, ud.name, ''), COALESCE(l.full_name, ''), COALESCE(a.assigned_to::text, ''), a.entity_id::text
		FROM assets a
		LEFT JOIN asset_compute_details cd ON cd.asset_id = a.id
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN (
			SELECT asset_id, COUNT(*) AS open_alerts
			FROM asset_alerts
			WHERE is_resolved = FALSE
			GROUP BY asset_id
		) alerts ON alerts.asset_id = a.id
		WHERE a.is_compute = TRUE
		ORDER BY a.asset_tag
	`)).WillReturnRows(sqlmock.NewRows([]string{
		"id", "asset_tag", "hostname", "category", "os_name", "last_seen", "status",
		"pending_updates", "open_alerts", "serial_number", "model", "warranty_until", "user_id", "full_name", "email", "emp_id",
		"department_name", "branch_name", "assigned_to", "entity_id",
	}).AddRow(
		"asset-1", "AST-0001", "spare-ho", "laptop", "Ubuntu 24.04", "2026-05-04T03:00:00Z", "active",
		4, 0, "SN-1", "Latitude 7440", "2027-12-31", "user-1", "Idyan Khan", "idyan@example.com", "EMP-1",
		"IT Operations", "Head Office", "user-1", "entity-1",
	))

	server.patchDevicesCompat(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}

	var body []struct {
		Hostname             string   `json:"hostname"`
		PatchStatus          string   `json:"patchStatus"`
		ComplianceScore      int      `json:"complianceScore"`
		Department           *struct {
			Name string `json:"name"`
		} `json:"department"`
		User *struct {
			FullName string `json:"fullName"`
			Email    string `json:"email"`
		} `json:"user"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(body) != 1 {
		t.Fatalf("item count = %d, want 1", len(body))
	}
	if body[0].Hostname != "spare-ho" {
		t.Fatalf("hostname = %q, want %q", body[0].Hostname, "spare-ho")
	}
	if body[0].PatchStatus != "pending" {
		t.Fatalf("patchStatus = %q, want %q", body[0].PatchStatus, "pending")
	}
	if body[0].ComplianceScore != 60 {
		t.Fatalf("complianceScore = %d, want 60", body[0].ComplianceScore)
	}
	if body[0].Department == nil || body[0].Department.Name != "IT Operations" {
		t.Fatalf("department = %#v, want IT Operations", body[0].Department)
	}
	if body[0].User == nil || body[0].User.FullName != "Idyan Khan" || body[0].User.Email != "idyan@example.com" {
		t.Fatalf("user = %#v, want Idyan Khan <idyan@example.com>", body[0].User)
	}
}
