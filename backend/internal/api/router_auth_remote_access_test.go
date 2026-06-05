package api

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"itms/backend/internal/app"
	"itms/backend/internal/platform/authn"
)

func mustGenerateRouterTestPrivateKey(t *testing.T) string {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	encoded := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)})
	if len(encoded) == 0 {
		t.Fatal("failed to encode test private key")
	}
	return string(encoded)
}

func TestRouterCreatePatchRunReportRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPost, "/api/patch/reports", `{"scopeLabel":"Finance wave","requestedAt":"2026-05-08T09:00:00Z","completedAt":"2026-05-08T09:01:00Z","rows":[{"deviceId":"asset-1","hostname":"host-1","status":"success","patchStatus":"completed","target":"host-1","action":"system-update","message":"ok","updatedItems":[]}]}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create patch report auditor role")
}

func TestRouterGetSSHTargetRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/ssh/assets/asset-1", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "get ssh target auditor role")
}

func TestRouterUpdateSaltWorkspaceTemplatesRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPut, "/api/salt/workspace/templates", `{"templates":[{"id":"sls-1","kind":"sls","name":"Patch baseline","description":"Baseline state","stateName":"patch.run","content":"pkg_uptodate:\n  pkg.uptodate: []","updatedAt":"2026-06-04T08:00:00Z"}]}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "update salt workspace templates auditor role")
}

func TestRouterGetSaltWorkspaceTemplatesAllowsAuditorRole(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "auditor", "auditor-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/salt/workspace/templates", token, "")

	updatedAt := time.Date(2026, time.June, 4, 8, 30, 0, 0, time.UTC)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT value, updated_at FROM settings WHERE key = $1`)).
		WithArgs("salt_workspace_templates").
		WillReturnRows(sqlmock.NewRows([]string{"value", "updated_at"}).AddRow(`[
			{"id":"sls-1","kind":"sls","name":"patch-baseline","description":"Baseline state","stateName":"patch.run","content":"pkg_uptodate:\n  pkg.uptodate: []","updatedAt":"2026-06-04T08:00:00Z"}
		]`, updatedAt))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get salt workspace templates auditor role")

	if !strings.Contains(recorder.Body.String(), "patch-baseline") {
		t.Fatalf("response body = %s, want stored template for auditor", recorder.Body.String())
	}
}

func TestRouterGetSSHTargetAllowsInScopeITTeam(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	defer listener.Close()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin:           "http://localhost:5173",
		JWTSecret:                "test-secret-with-sufficient-length-123",
		JWTTTL:                   time.Hour,
		SSHTerminalUsername:      "opsuser",
		SSHTerminalPrivateKey:    mustGenerateRouterTestPrivateKey(t),
		SSHTerminalStrictHostKey: false,
		SSHTerminalPort:          listener.Addr().(*net.TCPAddr).Port,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/ssh/assets/asset-1", token, "")

	expectAssetLookup(mock, "asset-1", "AST-SSH-1", "Admin Laptop", "127.0.0.1", "laptop", true, "entity-1", "", "", "active", "good")
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(logged_in_users_json, '[]'::jsonb)
		FROM asset_compute_details
		WHERE asset_id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"logged_in_users_json"}).AddRow([]byte(`["opsuser"]`)))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(netbird_ip::text, ''), COALESCE(wired_ip::text, ''), COALESCE(wireless_ip::text, '')
		FROM asset_network_snapshots
		WHERE asset_id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"netbird_ip", "wired_ip", "wireless_ip"}))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get ssh target in-scope it team")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["assetId"] != "asset-1" {
		t.Fatalf("assetId = %v, want asset-1", body["assetId"])
	}
	if body["address"] != "127.0.0.1" {
		t.Fatalf("address = %v, want 127.0.0.1", body["address"])
	}
	if body["username"] != "opsuser" {
		t.Fatalf("username = %v, want opsuser", body["username"])
	}
	if reachable, ok := body["reachable"].(bool); !ok || !reachable {
		t.Fatalf("reachable = %v, want true", body["reachable"])
	}
	if strings.TrimSpace(body["keyFingerprint"].(string)) == "" {
		t.Fatal("keyFingerprint should not be empty")
	}
	usernames, ok := body["usernames"].([]any)
	if !ok || len(usernames) != 1 || usernames[0] != "opsuser" {
		t.Fatalf("usernames = %v, want [opsuser]", body["usernames"])
	}
}

func TestRouterGetSSHTargetReturnsNotFoundForMissingAsset(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/ssh/assets/asset-missing", "")
	defer cleanup()

	expectAssetLookupNotFound(mock, "asset-missing")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "get ssh target missing asset")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "asset not found") {
		t.Fatalf("response body = %q, want asset not found", body)
	}
}

func TestRouterCreateSSHSessionRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodPost, "/api/ssh/session", `{"deviceId":"asset-1"}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create ssh session auditor role")
}

func TestRouterCreateSSHSessionAllowsInScopeITTeam(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	defer listener.Close()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin:           "http://localhost:5173",
		JWTSecret:                "test-secret-with-sufficient-length-123",
		JWTTTL:                   time.Hour,
		SSHTerminalUsername:      "opsuser",
		SSHTerminalPrivateKey:    mustGenerateRouterTestPrivateKey(t),
		SSHTerminalStrictHostKey: false,
		SSHTerminalPort:          listener.Addr().(*net.TCPAddr).Port,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/ssh/session", token, `{"deviceId":"asset-1"}`)

	expectAssetLookup(mock, "asset-1", "AST-SSH-1", "Admin Laptop", "127.0.0.1", "laptop", true, "entity-1", "", "", "active", "good")
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(logged_in_users_json, '[]'::jsonb)
		FROM asset_compute_details
		WHERE asset_id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"logged_in_users_json"}).AddRow([]byte(`["opsuser"]`)))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(netbird_ip::text, ''), COALESCE(wired_ip::text, ''), COALESCE(wireless_ip::text, '')
		FROM asset_network_snapshots
		WHERE asset_id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"netbird_ip", "wired_ip", "wireless_ip"}))
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO asset_history (asset_id, actor_id, action, detail) VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4::jsonb) RETURNING id`)).
		WithArgs("asset-1", "user-1", "terminal_session", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("history-1"))
	mock.ExpectExec(regexp.QuoteMeta(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`)).
		WithArgs("user-1", "entity-1", "terminal_session", "asset", "asset-1", sqlmock.AnyArg(), "192.0.2.1", "").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "create ssh session in-scope it team")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["id"] != "asset-1" {
		t.Fatalf("id = %v, want asset-1", body["id"])
	}
	if body["deviceId"] != "asset-1" {
		t.Fatalf("deviceId = %v, want asset-1", body["deviceId"])
	}
}

func TestRouterCreateSSHSessionReturnsNotFoundForMissingAsset(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/ssh/session", `{"deviceId":"asset-missing"}`)
	defer cleanup()

	expectAssetLookupNotFound(mock, "asset-missing")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "create ssh session missing asset")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "asset not found") {
		t.Fatalf("response body = %q, want asset not found", body)
	}
}

func TestRouterGetTerminalTargetReturnsNotFoundForMissingTarget(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/terminal/targets/missing-target", "")
	defer cleanup()

	expectTerminalTargetLookupNotFound(mock, "missing-target")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusNotFound, "get terminal target missing target")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "terminal target not found") {
		t.Fatalf("response body = %q, want terminal target not found", body)
	}
}

func TestRouterGetTerminalTargetAllowsInScopeITTeam(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/terminal/targets/minion-1", token, "")

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets
		WHERE is_compute = TRUE AND (hostname = $1 OR salt_minion_id = $1 OR asset_tag = $1)
		LIMIT 1
	`)).WithArgs("minion-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "asset_tag", "name", "hostname", "category", "is_compute", "serial_number", "manufacturer", "model", "entity_id",
		"assigned_to", "dept_id", "location_id", "purchase_date", "cost", "warranty_until", "status", "condition", "glpi_id", "salt_minion_id", "wazuh_agent_id", "notes",
	}).AddRow("asset-1", "AST-TERM-1", "Admin Laptop", "workstation-01", "laptop", true, "", "", "", "entity-1", "", "dept-1", "loc-1", "", "", "", "active", "good", 0, "minion-1", "", ""))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(name, '') FROM departments WHERE id = $1::uuid`)).
		WithArgs("dept-1").
		WillReturnRows(sqlmock.NewRows([]string{"name"}).AddRow("IT Operations"))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(full_name, '') FROM locations WHERE id = $1::uuid`)).
		WithArgs("loc-1").
		WillReturnRows(sqlmock.NewRows([]string{"full_name"}).AddRow("Bangalore HQ"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get terminal target in-scope it team")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["assetId"] != "asset-1" {
		t.Fatalf("assetId = %v, want asset-1", body["assetId"])
	}
	if body["hostname"] != "workstation-01" {
		t.Fatalf("hostname = %v, want workstation-01", body["hostname"])
	}
	if body["assetTag"] != "AST-TERM-1" {
		t.Fatalf("assetTag = %v, want AST-TERM-1", body["assetTag"])
	}
	if body["assetName"] != "Admin Laptop" {
		t.Fatalf("assetName = %v, want Admin Laptop", body["assetName"])
	}
	if body["departmentName"] != "IT Operations" {
		t.Fatalf("departmentName = %v, want IT Operations", body["departmentName"])
	}
	if body["locationName"] != "Bangalore HQ" {
		t.Fatalf("locationName = %v, want Bangalore HQ", body["locationName"])
	}
	if body["minionId"] != "minion-1" {
		t.Fatalf("minionId = %v, want minion-1", body["minionId"])
	}
	if connected, ok := body["connected"].(bool); !ok || connected {
		t.Fatalf("connected = %v, want false", body["connected"])
	}
	policy, ok := body["policy"].(map[string]any)
	if !ok {
		t.Fatalf("policy = %T, want object", body["policy"])
	}
	if _, ok := policy["allowedCommands"]; !ok {
		t.Fatal("policy.allowedCommands should be present")
	}
	if _, ok := policy["restrictions"]; !ok {
		t.Fatal("policy.restrictions should be present")
	}
}

func TestRouterSaltWorkspaceReturnsWorkspacePayload(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/salt/workspace?limit=5", token, "")

	mock.ExpectQuery(`SELECT a\.id,\s*COALESCE\(a\.asset_tag, ''\),\s*COALESCE\(NULLIF\(a\.hostname, ''\), a\.asset_tag\)`).
		WithArgs("entity-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "asset_tag", "hostname", "name", "category", "os_name", "last_seen", "status", "cost", "salt_minion_id", "owner_name", "department_name", "location_name", "open_alerts", "pending_updates",
		}).AddRow("asset-1", "AST-SALT-1", "workstation-01", "Admin Laptop", "laptop", "Ubuntu 24.04", "2026-05-15T09:00:00Z", "active", "50000", "minion-1", "Alex Kumar", "IT Operations", "Bangalore HQ", 3, 5))
	mock.ExpectQuery(`(?s)SELECT h\.id, COALESCE\(a\.hostname, a\.asset_tag\), h\.detail, h\.created_at.*LIMIT 5`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "scope", "detail", "created_at"}).AddRow("job-1", "workstation-01", []byte(`{"status":"queued"}`), time.Date(2026, 5, 15, 9, 5, 0, 0, time.UTC)))
	mock.ExpectQuery(`(?s)SELECT r\.id::text, r\.scope_label, r\.requested_at, r\.completed_at, r\.success_count, r\.failed_count, r\.row_count, COALESCE\(u\.full_name, ''\).*LIMIT 5`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "scope_label", "requested_at", "completed_at", "success_count", "failed_count", "row_count", "requested_by"}).AddRow("report-1", "Finance rollout", time.Date(2026, 5, 15, 8, 55, 0, 0, time.UTC), time.Date(2026, 5, 15, 9, 1, 0, 0, time.UTC), 8, 1, 9, "Alex Kumar"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "salt workspace payload")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	assets, ok := body["assets"].([]any)
	if !ok || len(assets) != 1 {
		t.Fatalf("assets = %v, want one asset", body["assets"])
	}
	summary, ok := body["summary"].(map[string]any)
	if !ok {
		t.Fatalf("summary = %T, want object", body["summary"])
	}
	if summary["totalAssets"] != float64(1) {
		t.Fatalf("summary.totalAssets = %v, want 1", summary["totalAssets"])
	}
	if _, ok := body["executionPolicy"].(map[string]any); !ok {
		t.Fatalf("executionPolicy = %T, want object", body["executionPolicy"])
	}
	if _, ok := body["presets"].([]any); !ok {
		t.Fatalf("presets = %T, want array", body["presets"])
	}
}

func TestRouterGetSaltWorkspaceTemplatesReturnsStoredTemplates(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/salt/workspace/templates", token, "")

	updatedAt := time.Date(2026, time.June, 4, 8, 30, 0, 0, time.UTC)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT value, updated_at FROM settings WHERE key = $1`)).
		WithArgs("salt_workspace_templates").
		WillReturnRows(sqlmock.NewRows([]string{"value", "updated_at"}).AddRow(`[
			{"id":"sls-1","kind":"sls","name":"patch-baseline","description":"Baseline state","stateName":"patch.run","content":"pkg_uptodate:\n  pkg.uptodate: []","updatedAt":"2026-06-04T08:00:00Z"},
			{"id":"shell-1","kind":"shell","name":"restart-salt","description":"Restart minion","stateName":"","content":"#!/bin/sh\nsystemctl restart salt-minion","updatedAt":"2026-06-04T08:05:00Z"}
		]`, updatedAt))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get salt workspace templates")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	templates, ok := body["templates"].([]any)
	if !ok || len(templates) != 2 {
		t.Fatalf("templates = %v, want 2 items", body["templates"])
	}
	if body["updatedAt"] != updatedAt.Format(time.RFC3339) {
		t.Fatalf("updatedAt = %v, want %s", body["updatedAt"], updatedAt.Format(time.RFC3339))
	}
}

func TestRouterGetSaltWorkspaceTemplatesNormalizesStoredTemplates(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/salt/workspace/templates", token, "")

	updatedAt := time.Date(2026, time.June, 4, 8, 45, 0, 0, time.UTC)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT value, updated_at FROM settings WHERE key = $1`)).
		WithArgs("salt_workspace_templates").
		WillReturnRows(sqlmock.NewRows([]string{"value", "updated_at"}).AddRow(`[
			{"id":" shell-1 ","kind":" SHELL ","name":" Restart Salt ","description":" Restart minion ","stateName":"should-clear","content":"#!/bin/sh\nsystemctl restart salt-minion","updatedAt":"bad-time"},
			{"id":"shell-1","kind":"shell","name":"duplicate","description":"duplicate","stateName":"","content":"echo duplicate","updatedAt":"2026-06-04T08:10:00Z"},
			{"id":"bad-kind","kind":"manual","name":"invalid","description":"invalid","stateName":"","content":"echo invalid","updatedAt":"2026-06-04T08:11:00Z"},
			{"id":"missing-content","kind":"sls","name":"missing","description":"missing","stateName":"patch.run","content":"","updatedAt":"2026-06-04T08:12:00Z"}
		]`, updatedAt))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get salt workspace templates normalized")

	var body struct {
		Templates []map[string]any `json:"templates"`
		UpdatedAt string           `json:"updatedAt"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(body.Templates) != 1 {
		t.Fatalf("templates = %v, want 1 normalized item", body.Templates)
	}
	if got := body.Templates[0]["id"]; got != "shell-1" {
		t.Fatalf("id = %v, want shell-1", got)
	}
	if got := body.Templates[0]["kind"]; got != "shell" {
		t.Fatalf("kind = %v, want shell", got)
	}
	if got := body.Templates[0]["name"]; got != "Restart Salt" {
		t.Fatalf("name = %v, want Restart Salt", got)
	}
	if got := body.Templates[0]["stateName"]; got != "" {
		t.Fatalf("stateName = %v, want empty string", got)
	}
	if got := body.Templates[0]["updatedAt"]; got == "bad-time" || strings.TrimSpace(got.(string)) == "" {
		t.Fatalf("updatedAt = %v, want normalized RFC3339 timestamp", got)
	}
	if body.UpdatedAt != updatedAt.Format(time.RFC3339) {
		t.Fatalf("updatedAt = %v, want %s", body.UpdatedAt, updatedAt.Format(time.RFC3339))
	}
}

func TestRouterUpdateSaltWorkspaceTemplatesPersistsNormalizedTemplates(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPut, "/api/salt/workspace/templates", token, `{"templates":[{"id":" sls-1 ","kind":" SLS ","name":" Patch baseline ","description":" Baseline state ","stateName":" patch.run ","content":" pkg_uptodate:\n  pkg.uptodate: [] ","updatedAt":"2026-06-04T08:00:00Z"},{"id":"shell-1","kind":"shell","name":"restart-salt","description":"Restart minion","stateName":"ignored","content":"#!/bin/sh\nsystemctl restart salt-minion","updatedAt":"bad-time"}]}`)

	updatedAt := time.Date(2026, time.June, 4, 9, 0, 0, 0, time.UTC)

	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		RETURNING updated_at
	`)).
		WithArgs("salt_workspace_templates", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"updated_at"}).AddRow(updatedAt))
	mock.ExpectExec(regexp.QuoteMeta(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`)).
		WithArgs("user-1", "entity-1", "settings_changed", "settings", saltWorkspaceTemplatesKey, sqlmock.AnyArg(), "192.0.2.1", "").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "update salt workspace templates")

	if !strings.Contains(recorder.Body.String(), "Patch baseline") {
		t.Fatalf("response body = %s, want normalized template name", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), updatedAt.Format(time.RFC3339)) {
		t.Fatalf("response body = %s, want updatedAt %s", recorder.Body.String(), updatedAt.Format(time.RFC3339))
	}
	if !strings.Contains(recorder.Body.String(), "\"stateName\":\"\"") {
		t.Fatalf("response body = %s, want shell template stateName cleared", recorder.Body.String())
	}
}

func TestRouterUpdateSaltWorkspaceTemplatesRejectsInvalidTemplate(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPut, "/api/salt/workspace/templates", token, `{"templates":[{"id":"sls-1","kind":"sls","name":"Patch baseline","description":"Missing state name","stateName":"","content":"pkg_uptodate:\n  pkg.uptodate: []","updatedAt":"2026-06-04T08:00:00Z"}]}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update salt workspace templates invalid template")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "template 1 must include a state name") {
		t.Fatalf("response body = %q, want state name validation error", body)
	}
}

func TestRouterSaltWorkspaceExecuteDepartmentStateApplyTestMode(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	requestBodies := make([]string, 0, 2)
	saltServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/run" {
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		body, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatalf("io.ReadAll: %v", readErr)
		}
		requestBodies = append(requestBodies, string(body))
		writer.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), `"fun":"test.ping"`) {
			_, _ = writer.Write([]byte(`{"return":[{"minion-1":true}]}`))
			return
		}
		_, _ = writer.Write([]byte(`{"return":[{"minion-1":{"pkg_|-vim_|-vim_|-installed":{"name":"vim","result":true,"comment":"up-to-date","changes":{}},"pkg_|-openssl_|-openssl_|-installed":{"name":"openssl","result":true,"comment":"updated","changes":{"openssl":{"old":"1.0","new":"1.1"}}}}}]}`))
	}))
	defer saltServer.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: saltServer.URL,
		SaltAPIToken:   "test-token",
		SaltTargetType: "glob",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/salt/workspace/execute", token, `{"client":"local","function":"state.apply","arguments":["patch.run"],"targetMode":"department","departmentName":"IT Operations","label":"IT Operations","test":true}`)

	mock.ExpectQuery(`SELECT a\.id,\s*COALESCE\(a\.asset_tag, ''\),\s*COALESCE\(NULLIF\(a\.hostname, ''\), a\.asset_tag\),\s*COALESCE\(cd\.os_name, ''\),\s*COALESCE\(d\.name, ''\),\s*COALESCE\(a\.salt_minion_id, ''\),\s*a\.entity_id::text`).
		WithArgs("IT Operations").
		WillReturnRows(sqlmock.NewRows([]string{"id", "asset_tag", "hostname", "os_name", "department_name", "salt_minion_id", "entity_id"}).
			AddRow("asset-1", "AST-SALT-1", "workstation-01", "Ubuntu 24.04", "IT Operations", "minion-1", "entity-1"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "salt workspace execute department state apply test mode")

	if len(requestBodies) != 2 {
		t.Fatalf("salt request count = %d, want 2", len(requestBodies))
	}
	if !strings.Contains(requestBodies[1], `"kwarg":{"test":true}`) {
		t.Fatalf("state.apply request body = %s, want kwarg.test=true", requestBodies[1])
	}
	if !strings.Contains(requestBodies[1], `"arg":["patch.run"]`) {
		t.Fatalf("state.apply request body = %s, want patch.run arg", requestBodies[1])
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["scopeLabel"] != "IT Operations" {
		t.Fatalf("scopeLabel = %v, want IT Operations", body["scopeLabel"])
	}
	if body["successCount"] != float64(1) {
		t.Fatalf("successCount = %v, want 1", body["successCount"])
	}
	rows, ok := body["rows"].([]any)
	if !ok || len(rows) != 1 {
		t.Fatalf("rows = %v, want one row", body["rows"])
	}
	firstRow, ok := rows[0].(map[string]any)
	if !ok {
		t.Fatalf("rows[0] = %T, want object", rows[0])
	}
	if firstRow["hostname"] != "workstation-01" {
		t.Fatalf("rows[0].hostname = %v, want workstation-01", firstRow["hostname"])
	}
	if firstRow["status"] != "success" {
		t.Fatalf("rows[0].status = %v, want success", firstRow["status"])
	}
	updatedItems, ok := firstRow["updatedItems"].([]any)
	if !ok || len(updatedItems) != 1 || updatedItems[0] != "openssl" {
		t.Fatalf("rows[0].updatedItems = %v, want [openssl]", firstRow["updatedItems"])
	}
	alreadyLatest, ok := firstRow["alreadyLatest"].([]any)
	if !ok || len(alreadyLatest) != 1 || alreadyLatest[0] != "vim" {
		t.Fatalf("rows[0].alreadyLatest = %v, want [vim]", firstRow["alreadyLatest"])
	}
}

func TestRouterSaltWorkspaceExecuteCmdScriptUsesGuardedCommandPath(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	requestBodies := make([]string, 0, 2)
	saltServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/run" {
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		body, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatalf("io.ReadAll: %v", readErr)
		}
		requestBodies = append(requestBodies, string(body))
		writer.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), `"fun":"test.ping"`) {
			_, _ = writer.Write([]byte(`{"return":[{"minion-1":true}]}`))
			return
		}
		_, _ = writer.Write([]byte(`{"return":[{"retcode":0,"stdout":"script executed","stderr":""}]}`))
	}))
	defer saltServer.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: saltServer.URL,
		SaltAPIToken:   "test-token",
		SaltTargetType: "glob",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/salt/workspace/execute", token, `{"client":"local","function":"cmd.script","arguments":["hostname"],"targetMode":"single","target":"minion-1","label":"minion-1"}`)

	mock.ExpectQuery(`SELECT a\.id,\s*COALESCE\(a\.asset_tag, ''\),\s*COALESCE\(NULLIF\(a\.hostname, ''\), a\.asset_tag\),\s*COALESCE\(cd\.os_name, ''\),\s*COALESCE\(d\.name, ''\),\s*COALESCE\(a\.salt_minion_id, ''\),\s*a\.entity_id::text`).
		WithArgs("minion-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "asset_tag", "hostname", "os_name", "department_name", "salt_minion_id", "entity_id"}).
			AddRow("asset-1", "AST-SALT-1", "workstation-01", "Ubuntu 24.04", "IT Operations", "minion-1", "entity-1"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "salt workspace execute cmd.script preserves function")

	if len(requestBodies) != 2 {
		t.Fatalf("salt request count = %d, want 2", len(requestBodies))
	}
	if !strings.Contains(requestBodies[1], `"fun":"cmd.run_all"`) {
		t.Fatalf("cmd.script request body = %s, want guarded fun=cmd.run_all", requestBodies[1])
	}
	if strings.Contains(requestBodies[1], `"fun":"cmd.script"`) {
		t.Fatalf("cmd.script request body = %s, did not expect fun=cmd.script", requestBodies[1])
	}
	if !strings.Contains(requestBodies[1], `"arg":["hostname"]`) {
		t.Fatalf("cmd.script request body = %s, want guarded command arg", requestBodies[1])
	}
}

func TestRouterSaltWorkspaceExecuteCmdScriptBlocksMultilineCommands(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	saltServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	defer saltServer.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: saltServer.URL,
		SaltAPIToken:   "test-token",
		SaltTargetType: "glob",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	request := newAuthorizedRequest(http.MethodPost, "/api/salt/workspace/execute", token, `{"client":"local","function":"cmd.script","arguments":["hostname\nuname -a"],"targetMode":"single","target":"minion-1","label":"minion-1"}`)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "salt workspace execute cmd.script blocks multiline command")
	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "command must be a single line") {
		t.Fatalf("unexpected response body: %s", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestRouterSaltWorkspaceExecuteStateSLSPreservesRequestedFunction(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	requestBodies := make([]string, 0, 2)
	saltServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/run" {
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		body, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatalf("io.ReadAll: %v", readErr)
		}
		requestBodies = append(requestBodies, string(body))
		writer.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), `"fun":"test.ping"`) {
			_, _ = writer.Write([]byte(`{"return":[{"minion-1":true}]}`))
			return
		}
		_, _ = writer.Write([]byte(`{"return":[{"minion-1":{"pkg_|-vim_|-vim_|-installed":{"name":"vim","result":true,"comment":"up-to-date","changes":{}}}}]}`))
	}))
	defer saltServer.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: saltServer.URL,
		SaltAPIToken:   "test-token",
		SaltTargetType: "glob",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/salt/workspace/execute", token, `{"client":"local","function":"state.sls","arguments":["patch.run"],"targetMode":"single","target":"minion-1","label":"minion-1","test":true}`)

	mock.ExpectQuery(`SELECT a\.id,\s*COALESCE\(a\.asset_tag, ''\),\s*COALESCE\(NULLIF\(a\.hostname, ''\), a\.asset_tag\),\s*COALESCE\(cd\.os_name, ''\),\s*COALESCE\(d\.name, ''\),\s*COALESCE\(a\.salt_minion_id, ''\),\s*a\.entity_id::text`).
		WithArgs("minion-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "asset_tag", "hostname", "os_name", "department_name", "salt_minion_id", "entity_id"}).
			AddRow("asset-1", "AST-SALT-1", "workstation-01", "Ubuntu 24.04", "IT Operations", "minion-1", "entity-1"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "salt workspace execute state.sls preserves function")

	if len(requestBodies) != 2 {
		t.Fatalf("salt request count = %d, want 2", len(requestBodies))
	}
	if !strings.Contains(requestBodies[1], `"fun":"state.sls"`) {
		t.Fatalf("state.sls request body = %s, want fun=state.sls", requestBodies[1])
	}
	if strings.Contains(requestBodies[1], `"fun":"state.apply"`) {
		t.Fatalf("state.sls request body = %s, did not expect fun=state.apply", requestBodies[1])
	}
	if !strings.Contains(requestBodies[1], `"kwarg":{"test":true}`) {
		t.Fatalf("state.sls request body = %s, want kwarg.test=true", requestBodies[1])
	}
}

func TestRouterExecuteTerminalStateSLSPreservesRequestedFunction(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	requestBodies := make([]string, 0, 2)
	saltServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/run" {
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		body, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatalf("io.ReadAll: %v", readErr)
		}
		requestBodies = append(requestBodies, string(body))
		writer.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), `"fun":"test.ping"`) {
			_, _ = writer.Write([]byte(`{"return":[{"minion-1":true}]}`))
			return
		}
		_, _ = writer.Write([]byte(`{"return":[{"minion-1":{"pkg_|-vim_|-vim_|-installed":{"name":"vim","result":true,"comment":"up-to-date","changes":{}}}}]}`))
	}))
	defer saltServer.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: saltServer.URL,
		SaltAPIToken:   "test-token",
		SaltTargetType: "glob",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/terminal/targets/minion-1/function", token, `{"function":"state.sls","arguments":["patch.run"]}`)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets
		WHERE is_compute = TRUE AND (hostname = $1 OR salt_minion_id = $1 OR asset_tag = $1)
		LIMIT 1
	`)).WithArgs("minion-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "asset_tag", "name", "hostname", "category", "is_compute", "serial_number", "manufacturer", "model", "entity_id",
		"assigned_to", "dept_id", "location_id", "purchase_date", "cost", "warranty_until", "status", "condition", "glpi_id", "salt_minion_id", "wazuh_agent_id", "notes",
	}).AddRow("asset-1", "AST-TERM-1", "Admin Laptop", "workstation-01", "laptop", true, "", "", "", "entity-1", "", "", "", "", "", "", "active", "good", 0, "minion-1", "", ""))
	mock.ExpectExec(regexp.QuoteMeta(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`)).
		WithArgs("user-1", "entity-1", "terminal_function_executed", "asset", "asset-1", sqlmock.AnyArg(), "192.0.2.1", "").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "execute terminal state.sls preserves function")

	if len(requestBodies) != 2 {
		t.Fatalf("salt request count = %d, want 2", len(requestBodies))
	}
	if !strings.Contains(requestBodies[1], `"fun":"state.sls"`) {
		t.Fatalf("terminal state.sls request body = %s, want fun=state.sls", requestBodies[1])
	}
	if strings.Contains(requestBodies[1], `"fun":"state.apply"`) {
		t.Fatalf("terminal state.sls request body = %s, did not expect fun=state.apply", requestBodies[1])
	}
}

func TestRouterExecuteTerminalCommandBlocksShellPipeline(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
		SaltAPIBaseURL: "http://salt.example",
		SaltAPIToken:   "test-token",
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "it_team", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodPost, "/api/terminal/targets/minion-1/execute", token, `{"command":"ps aux | grep salt"}`)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets
		WHERE is_compute = TRUE AND (hostname = $1 OR salt_minion_id = $1 OR asset_tag = $1)
		LIMIT 1
	`)).WithArgs("minion-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "asset_tag", "name", "hostname", "category", "is_compute", "serial_number", "manufacturer", "model", "entity_id",
		"assigned_to", "dept_id", "location_id", "purchase_date", "cost", "warranty_until", "status", "condition", "glpi_id", "salt_minion_id", "wazuh_agent_id", "notes",
	}).AddRow("asset-1", "AST-TERM-1", "Admin Laptop", "workstation-01", "laptop", true, "", "", "", "entity-1", "", "", "", "", "", "", "active", "good", 0, "minion-1", "", ""))
	mock.ExpectExec(regexp.QuoteMeta(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`)).
		WithArgs("user-1", "entity-1", "terminal_command_blocked", "asset", "asset-1", sqlmock.AnyArg(), "192.0.2.1", "").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO asset_history (asset_id, actor_id, action, detail) VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4::jsonb) RETURNING id`)).
		WithArgs("asset-1", "user-1", "terminal_command_blocked", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("history-1"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "execute terminal command blocked shell pipeline")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "command contains a blocked shell pattern") {
		t.Fatalf("response body = %q, want blocked shell pattern error", body)
	}
}