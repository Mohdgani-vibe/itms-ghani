package api

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
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