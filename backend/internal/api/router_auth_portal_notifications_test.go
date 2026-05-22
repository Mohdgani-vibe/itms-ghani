package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"itms/backend/internal/app"
	"itms/backend/internal/platform/authn"
)

func TestRouterLoginReturnsGenericFailureForInactiveUser(t *testing.T) {
	passwordHash, err := authn.HashPassword("ValidPass#2026")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	_, mock, recorder, router, cleanup := newRouterTestHarness(t)
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT u.id, u.emp_id, u.full_name, u.email, u.entity_id::text, u.dept_id::text, u.location_id::text, r.name, u.password_hash, u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE lower(u.email) = lower($1)
	`)).WithArgs("inactive@zerodha.com").WillReturnRows(
		sqlmock.NewRows([]string{"id", "emp_id", "full_name", "email", "entity_id", "dept_id", "location_id", "role", "password_hash", "is_active"}).
			AddRow("user-1", "EMP-1", "Inactive User", "inactive@zerodha.com", "entity-1", nil, nil, "employee", passwordHash, false),
	)

	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"inactive@zerodha.com","password":"ValidPass#2026"}`))
	request.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(recorder, request)

	assertRouteResult(t, mock, recorder, http.StatusUnauthorized, "login inactive user generic failure")
	var body map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["error"] != "authentication failed" {
		t.Fatalf("error = %q, want %q", body["error"], "authentication failed")
	}
}

func TestRouterUserAuthPayloadSetsAuditorPortal(t *testing.T) {
	server := &apiServer{}
	user := dbUser{
		ID:       "auditor-1",
		EmpID:    "EMP-1",
		FullName: "Auditor User",
		Email:    "auditor@example.com",
		EntityID: "entity-1",
		Role:     "auditor",
	}

	payload := server.userAuthPayload(user)

	if payload["default_portal"] != "/audit/dashboard" {
		t.Fatalf("default_portal = %v, want %q", payload["default_portal"], "/audit/dashboard")
	}
	portals, ok := payload["portals"].([]string)
	if !ok {
		t.Fatalf("portals type = %T, want []string", payload["portals"])
	}
	if !reflect.DeepEqual(portals, []string{"auditor"}) {
		t.Fatalf("portals = %v, want %v", portals, []string{"auditor"})
	}
	if payload["role"] != "auditor" {
		t.Fatalf("role = %v, want %q", payload["role"], "auditor")
	}
	if payload["dept_id"] != nil {
		t.Fatalf("dept_id = %v, want nil", payload["dept_id"])
	}
	if payload["location_id"] != nil {
		t.Fatalf("location_id = %v, want nil", payload["location_id"])
	}
}

func TestRouterMattermostStatusReturnsResolvedTeam(t *testing.T) {
	mattermostServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v4/teams/name/it-ops" {
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		if authorization := request.Header.Get("Authorization"); authorization != "Bearer mm-token" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"id":"team-1","name":"it-ops","display_name":"IT Operations"}`))
	}))
	defer mattermostServer.Close()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	config := app.Config{
		FrontendOrigin:           "http://localhost:5173",
		JWTSecret:                "test-secret-with-sufficient-length-123",
		JWTTTL:                   time.Hour,
		MattermostEnabled:        true,
		MattermostBaseURL:        mattermostServer.URL,
		MattermostToken:          "mm-token",
		MattermostTeam:           "it-ops",
		MattermostCreateChannels: true,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	token := issueRouterTestToken(t, manager, "super_admin", "user-1", "entity-1")
	recorder := httptest.NewRecorder()
	request := newAuthorizedRequest(http.MethodGet, "/api/integrations/mattermost/status", token, "")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "mattermost status route")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if teamResolved, ok := body["teamResolved"].(bool); !ok || !teamResolved {
		t.Fatalf("teamResolved = %v, want true", body["teamResolved"])
	}
	resolvedTeam, ok := body["resolvedTeam"].(map[string]any)
	if !ok {
		t.Fatalf("resolvedTeam type = %T, want map[string]any", body["resolvedTeam"])
	}
	if resolvedTeam["name"] != "it-ops" {
		t.Fatalf("resolvedTeam.name = %v, want it-ops", resolvedTeam["name"])
	}
}

func TestRouterListAlertsReturnsClamAVTrendSummary(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/alerts?page=1&page_size=20&source=clamav", "")
	defer cleanup()

	createdAt := time.Now().UTC()
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT al.id,
			COALESCE(a.id::text, ''), COALESCE(a.asset_tag, ''), COALESCE(a.name, ''), COALESCE(a.hostname, ''),
			COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''),
			COALESCE(NULLIF(ad.name, ''), NULLIF(ud.name, ''), 'Unassigned'),
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END AS source_key,
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'Patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'OpenSCAP Hardening'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'ClamScan'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'Terminal'
		ELSE initcap(replace(lower(al.source), '_', ' '))
	END AS source_label,
			COALESCE(al.source, ''), al.severity, al.title, COALESCE(al.detail, ''), al.acknowledged, al.resolved, al.created_at
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE 1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = $3
		ORDER BY al.created_at DESC LIMIT $4 OFFSET $5`)).
		WithArgs("entity-1", "auditor-1", "clamav", 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "asset_id", "asset_tag", "asset_name", "hostname", "user_id", "user_name", "user_email", "department", "source_key", "source_label", "raw_source", "severity", "title", "detail", "acknowledged", "resolved", "created_at"}).
			AddRow("alert-1", "asset-1", "AST-001", "Laptop 1", "host-1", "user-1", "User One", "user1@example.com", "Security", "clamav", "ClamScan", "clamav", "critical", "Malware detected in downloads", "Trojan signature found in a downloaded archive", true, false, createdAt).
			AddRow("alert-2", "asset-2", "AST-002", "Laptop 2", "host-2", "user-2", "User Two", "user2@example.com", "Security", "clamav", "ClamScan", "clamav", "info", "ClamScan scan clean", "No infected files were found", true, true, createdAt.Add(-2*time.Hour)))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(*),
			COUNT(*) FILTER (WHERE NOT al.resolved),
			COUNT(*) FILTER (WHERE al.acknowledged),
			COUNT(*) FILTER (WHERE al.resolved)
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE 1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = $3`)).
		WithArgs("entity-1", "auditor-1", "clamav").
		WillReturnRows(sqlmock.NewRows([]string{"count", "open", "acknowledged", "resolved"}).AddRow(2, 1, 2, 1))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT source_name, source_label, source_count
		FROM (
			SELECT CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END AS source_name, CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'Patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'OpenSCAP Hardening'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'ClamScan'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'Terminal'
		ELSE initcap(replace(lower(al.source), '_', ' '))
	END AS source_label, COUNT(*) AS source_count
			FROM alerts al
			LEFT JOIN assets a ON a.id = al.device_id
			LEFT JOIN users u ON u.id = al.user_id
			LEFT JOIN departments ad ON ad.id = a.dept_id
			LEFT JOIN departments ud ON ud.id = u.dept_id
			WHERE 1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = $3
			GROUP BY source_name, source_label
		) source_counts
		ORDER BY source_count DESC, source_label ASC
	`)).
		WithArgs("entity-1", "auditor-1", "clamav").
		WillReturnRows(sqlmock.NewRows([]string{"source_name", "source_label", "source_count"}).AddRow("clamav", "ClamScan", 2))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '24 hours'),
			COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '30 days')
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE 1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = $3 AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = 'clamav'`)).
		WithArgs("entity-1", "auditor-1", "clamav").
		WillReturnRows(sqlmock.NewRows([]string{"last_24_hours", "last_7_days", "last_30_days"}).AddRow(2, 4, 9))
	mock.ExpectQuery(regexp.QuoteMeta(`
		WITH days AS (
			SELECT generate_series(
				date_trunc('day', NOW()) - INTERVAL '6 days',
				date_trunc('day', NOW()),
				INTERVAL '1 day'
			) AS bucket_start
		)
		SELECT to_char(days.bucket_start, 'YYYY-MM-DD') AS bucket_date,
			COALESCE(COUNT(al.id), 0) AS bucket_count
		FROM days
		LEFT JOIN alerts al
			ON al.created_at >= days.bucket_start
			AND al.created_at < days.bucket_start + INTERVAL '1 day'
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE al.id IS NULL OR (1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = $3 AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END = 'clamav' AND al.created_at >= NOW() - INTERVAL '7 days')
		GROUP BY days.bucket_start
		ORDER BY days.bucket_start ASC
	`)).
		WithArgs("entity-1", "auditor-1", "clamav").
		WillReturnRows(sqlmock.NewRows([]string{"bucket_date", "bucket_count"}).
			AddRow("2026-04-21", 0).
			AddRow("2026-04-22", 1).
			AddRow("2026-04-23", 0).
			AddRow("2026-04-24", 2).
			AddRow("2026-04-25", 0).
			AddRow("2026-04-26", 1).
			AddRow("2026-04-27", 0))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list alerts clamav trend route")

	var body struct {
		Summary struct {
			ClamAVTrend struct {
				Last24Hours  int `json:"last24Hours"`
				Last7Days    int `json:"last7Days"`
				Last30Days   int `json:"last30Days"`
				DailyBuckets []struct {
					Date  string `json:"date"`
					Count int    `json:"count"`
				} `json:"dailyBuckets"`
			} `json:"clamavTrend"`
		} `json:"summary"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Summary.ClamAVTrend.Last24Hours != 2 || body.Summary.ClamAVTrend.Last7Days != 4 || body.Summary.ClamAVTrend.Last30Days != 9 {
		t.Fatalf("clamavTrend totals = %+v, want 2/4/9", body.Summary.ClamAVTrend)
	}
	if len(body.Summary.ClamAVTrend.DailyBuckets) != 7 {
		t.Fatalf("daily bucket count = %d, want 7", len(body.Summary.ClamAVTrend.DailyBuckets))
	}
	if body.Summary.ClamAVTrend.DailyBuckets[1].Date != "2026-04-22" || body.Summary.ClamAVTrend.DailyBuckets[1].Count != 1 {
		t.Fatalf("daily bucket[1] = %+v, want 2026-04-22/1", body.Summary.ClamAVTrend.DailyBuckets[1])
	}
	if body.Summary.ClamAVTrend.DailyBuckets[3].Date != "2026-04-24" || body.Summary.ClamAVTrend.DailyBuckets[3].Count != 2 {
		t.Fatalf("daily bucket[3] = %+v, want 2026-04-24/2", body.Summary.ClamAVTrend.DailyBuckets[3])
	}
}

func TestRouterAlertsDashboardRoute(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/alerts/dashboard?source=clamav", "")
	defer cleanup()

	createdAt := time.Now().UTC()
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT al.id,
			COALESCE(a.id::text, ''), COALESCE(a.asset_tag, ''), COALESCE(a.name, ''), COALESCE(a.hostname, ''),
			COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''),
			COALESCE(NULLIF(ad.name, ''), NULLIF(ud.name, ''), 'Unassigned'),
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END AS source_key,
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'Patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'OpenSCAP Hardening'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'ClamScan'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'Terminal'
		ELSE initcap(replace(lower(al.source), '_', ' '))
	END AS source_label,
			COALESCE(al.source, ''), al.severity, al.title, COALESCE(al.detail, ''), al.acknowledged, al.resolved, al.created_at
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE 1 = 1 AND (COALESCE(a.entity_id, u.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id))) AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END IN ('wazuh', 'openscap', 'clamav')
		ORDER BY al.created_at DESC
	`)).WithArgs("entity-1", "user-1").WillReturnRows(sqlmock.NewRows([]string{"id", "asset_id", "asset_tag", "asset_name", "hostname", "user_id", "user_name", "user_email", "department", "source_key", "source_label", "raw_source", "severity", "title", "detail", "acknowledged", "resolved", "created_at"}).
		AddRow("alert-1", "asset-1", "AST-001", "Laptop 1", "host-1", "user-1", "User One", "user1@example.com", "Security", "clamav", "ClamScan", "clamav", "critical", "Malware detected", "Trojan signature found", true, false, createdAt))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "alerts dashboard route")

	var body struct {
		Source      string `json:"source"`
		SourceLabel string `json:"sourceLabel"`
		Systems     []struct {
			Hostname   string `json:"hostname"`
			Status     string `json:"status"`
			ErrorCount int    `json:"errorCount"`
		} `json:"systems"`
		Departments []struct {
			Name       string `json:"name"`
			ErrorCount int    `json:"errorCount"`
		} `json:"departments"`
		ModuleCards []struct {
			Source             string `json:"source"`
			TotalSystemsScanned int   `json:"totalSystemsScanned"`
			ErrorSystemsCount  int    `json:"errorSystemsCount"`
			StatusColor        string `json:"statusColor"`
		} `json:"moduleCards"`
		Report struct {
			Module string `json:"module"`
		} `json:"report"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Source != "clamav" || body.SourceLabel != "ClamScan" {
		t.Fatalf("source = %q/%q, want clamav/ClamScan", body.Source, body.SourceLabel)
	}
	if len(body.Systems) != 1 || body.Systems[0].Hostname != "host-1" || body.Systems[0].Status != "error" || body.Systems[0].ErrorCount != 1 {
		t.Fatalf("systems = %+v, want single error system for host-1", body.Systems)
	}
	if len(body.Departments) != 1 || body.Departments[0].Name != "Security" || body.Departments[0].ErrorCount != 1 {
		t.Fatalf("departments = %+v, want Security error summary", body.Departments)
	}
	var clamavCardFound bool
	for _, card := range body.ModuleCards {
		if card.Source == "clamav" {
			clamavCardFound = true
			if card.TotalSystemsScanned != 1 || card.ErrorSystemsCount != 1 || card.StatusColor != "red" {
				t.Fatalf("clamav module card = %+v, want scanned=1 errors=1 statusColor=red", card)
			}
		}
	}
	if !clamavCardFound {
		t.Fatal("expected clamav module card in dashboard response")
	}
	if body.Report.Module != "clamav" {
		t.Fatalf("report.module = %q, want clamav", body.Report.Module)
	}
}

func TestRouterMyAlertsDashboardRestrictsToCurrentUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/me/alerts/dashboard?source=wazuh", "")
	defer cleanup()

	createdAt := time.Now().UTC()
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT al.id,
			COALESCE(a.id::text, ''), COALESCE(a.asset_tag, ''), COALESCE(a.name, ''), COALESCE(a.hostname, ''),
			COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''),
			COALESCE(NULLIF(ad.name, ''), NULLIF(ud.name, ''), 'Unassigned'),
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END AS source_key,
			CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'Patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'OpenSCAP Hardening'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'ClamScan'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'Terminal'
		ELSE initcap(replace(lower(al.source), '_', ' '))
	END AS source_label,
			COALESCE(al.source, ''), al.severity, al.title, COALESCE(al.detail, ''), al.acknowledged, al.resolved, al.created_at
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		WHERE 1 = 1 AND al.user_id = $1::uuid AND CASE
		WHEN lower(al.source) IN ('salt', 'salt_patch', 'patch') THEN 'patch'
		WHEN lower(al.source) IN ('openscap', 'open_scap', 'hardening') THEN 'openscap'
		WHEN lower(al.source) IN ('clamav', 'clam', 'clamwin', 'clamscan') THEN 'clamav'
		WHEN lower(al.source) IN ('terminal', 'terminal_session') THEN 'terminal'
		ELSE lower(al.source)
	END IN ('wazuh', 'openscap', 'clamav')
		ORDER BY al.created_at DESC
	`)).WithArgs("employee-1").WillReturnRows(sqlmock.NewRows([]string{"id", "asset_id", "asset_tag", "asset_name", "hostname", "user_id", "user_name", "user_email", "department", "source_key", "source_label", "raw_source", "severity", "title", "detail", "acknowledged", "resolved", "created_at"}).
		AddRow("alert-1", "asset-1", "AST-001", "Laptop 1", "host-1", "employee-1", "Employee One", "employee1@example.com", "Finance", "wazuh", "Wazuh", "wazuh", "high", "Endpoint drift detected", "Policy mismatch", true, false, createdAt))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "my alerts dashboard route")

	var body struct {
		Source  string `json:"source"`
		Systems []struct {
			Hostname string `json:"hostname"`
			Username string `json:"username"`
			Status   string `json:"status"`
		} `json:"systems"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Source != "wazuh" {
		t.Fatalf("source = %q, want wazuh", body.Source)
	}
	if len(body.Systems) != 1 || body.Systems[0].Hostname != "host-1" || body.Systems[0].Username != "Employee One" || body.Systems[0].Status != "error" {
		t.Fatalf("systems = %+v, want single user-scoped wazuh system", body.Systems)
	}
}

func TestRouterListAnnouncementsAllowsEmployee(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/announcements", "")
	defer cleanup()

	now := time.Now().UTC()

	expectAnnouncementCountForAudiences(mock, []string{"All Employees"}, 1)
	expectAnnouncementListQueryForAudiences(mock, []string{"All Employees"}, "announcement-1", "Scheduled Maintenance", "VPN update tonight", "All Employees", false, now, "Admin User")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list announcements route")
}

func TestRouterListAnnouncementsRejectsEmployeeRestrictedAudienceFilter(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/announcements?audience=IT+Team", "")
	defer cleanup()

	expectAnnouncementEmptyCount(mock)
	expectAnnouncementEmptyListQuery(mock)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list announcements employee restricted audience filter")
	if strings.TrimSpace(recorder.Body.String()) != `[]` {
		t.Fatalf("unexpected response body: %s", recorder.Body.String())
	}
}

func TestRouterListAnnouncementsRejectsAuditorRestrictedAudienceFilter(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/announcements?audience=Super+Admin", "")
	defer cleanup()

	expectAnnouncementEmptyCount(mock)
	expectAnnouncementEmptyListQuery(mock)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list announcements auditor restricted audience filter")
	if strings.TrimSpace(recorder.Body.String()) != `[]` {
		t.Fatalf("unexpected response body: %s", recorder.Body.String())
	}
}

func TestRouterCreateAnnouncementRejectsEmployeeRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/announcements", `{"title":"Scheduled Maintenance","body":"VPN update tonight","audience":"All Employees","urgent":false}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create announcement employee role")
}

func TestRouterCreateAnnouncementAllowsITTeam(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/announcements", `{"title":"Scheduled Maintenance","body":"VPN update tonight","audience":"All Employees","urgent":true}`)
	defer cleanup()

	expectAnnouncementCreate(mock, "user-1", "Scheduled Maintenance", "VPN update tonight", "All Employees", true, "announcement-1")
	expectAuditInsert(mock, "user-1", "entity-1", "announcement_published", "announcement", "announcement-1", `{"title":"Scheduled Maintenance","body":"VPN update tonight","audience":"All Employees","urgent":true}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "create announcement it team")
}

func TestRouterListChatChannelsAllowsEmployeeMember(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	latestAt := time.Now().UTC()

	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCount(mock, "employee-1", 1)
	expectChatChannelListQuery(mock, "employee-1", "channel-1", "Support - Employee One", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "open", nil, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-1", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-1", 1)
	expectChatLatestMessageLookup(mock, "channel-1", "Need help with VPN", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels employee member")
}

func TestRouterListChatChannelsRejectsAuditorRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "auditor", "auditor-1", "entity-1", http.MethodGet, "/api/chat/channels", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list chat channels auditor role")
}

func TestRouterListChatChannelsPaginatesResults(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels?paginate=1&page=2&page_size=1", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	latestAt := time.Now().UTC()

	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCount(mock, "employee-1", 2)
	expectChatChannelListPagedQuery(mock, "employee-1", 1, 1, "channel-2", "Support - Employee One", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "open", nil, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-2", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-2", 1)
	expectChatLatestMessageLookup(mock, "channel-2", "Need help with VPN", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels pagination")
}

func TestRouterListChatChannelsFiltersByKind(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels?kind=support", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	latestAt := time.Now().UTC()

	clause := "m.user_id = $1::uuid AND c.kind = $2"
	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCountWithClause(mock, clause, []any{"employee-1", "support"}, 1)
	expectChatChannelListQueryWithClause(mock, clause, []any{"employee-1", "support"}, "channel-1", "Support - Employee One", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "open", nil, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-1", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-1", 1)
	expectChatLatestMessageLookup(mock, "channel-1", "Need help with VPN", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels kind filter")
}

func TestRouterListChatChannelsFiltersBySearch(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels?search=vpn", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	latestAt := time.Now().UTC()

	clause := "m.user_id = $1::uuid AND (\n\t\t\tlower(c.name) LIKE $2\n\t\t\tOR EXISTS (\n\t\t\t\tSELECT 1\n\t\t\t\tFROM chat_members cm_search\n\t\t\t\tJOIN users u_search ON u_search.id = cm_search.user_id\n\t\t\t\tWHERE cm_search.channel_id = c.id AND lower(u_search.full_name) LIKE $2\n\t\t\t)\n\t\t\tOR EXISTS (\n\t\t\t\tSELECT 1\n\t\t\t\tFROM chat_messages msg_search\n\t\t\t\tWHERE msg_search.channel_id = c.id AND lower(msg_search.body) LIKE $2\n\t\t\t)\n\t\t)"
	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCountWithClause(mock, clause, []any{"employee-1", "%vpn%"}, 1)
	expectChatChannelListQueryWithClause(mock, clause, []any{"employee-1", "%vpn%"}, "channel-1", "VPN Support", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "open", nil, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-1", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-1", 1)
	expectChatLatestMessageLookup(mock, "channel-1", "Need help with VPN", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels search filter")
}

func TestRouterListChatChannelsFiltersByMemberNameSearch(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels?search=owner", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-time.Hour)
	latestAt := time.Now().UTC()

	clause := "m.user_id = $1::uuid AND (\n\t\t\tlower(c.name) LIKE $2\n\t\t\tOR EXISTS (\n\t\t\t\tSELECT 1\n\t\t\t\tFROM chat_members cm_search\n\t\t\t\tJOIN users u_search ON u_search.id = cm_search.user_id\n\t\t\t\tWHERE cm_search.channel_id = c.id AND lower(u_search.full_name) LIKE $2\n\t\t\t)\n\t\t\tOR EXISTS (\n\t\t\t\tSELECT 1\n\t\t\t\tFROM chat_messages msg_search\n\t\t\t\tWHERE msg_search.channel_id = c.id AND lower(msg_search.body) LIKE $2\n\t\t\t)\n\t\t)"
	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCountWithClause(mock, clause, []any{"employee-1", "%owner%"}, 1)
	expectChatChannelListQueryWithClause(mock, clause, []any{"employee-1", "%owner%"}, "channel-1", "Support Queue", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "open", nil, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-1", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-1", 1)
	expectChatLatestMessageLookup(mock, "channel-1", "Need help with VPN", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels member-name search filter")
}

func TestRouterListChatChannelsFiltersByStatus(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels?status=closed", "")
	defer cleanup()

	createdAt := time.Now().UTC().Add(-24 * time.Hour)
	closedAt := time.Now().UTC().Add(-2 * time.Hour)
	latestAt := time.Now().UTC().Add(-time.Hour)

	clause := "m.user_id = $1::uuid AND c.status = $2"
	expectChatUserMembershipExists(mock, "employee-1", true)
	expectChatChannelListCountWithClause(mock, clause, []any{"employee-1", "closed"}, 1)
	expectChatChannelListQueryWithClause(mock, clause, []any{"employee-1", "closed"}, "channel-1", "Closed VPN Support", "support", createdAt, "employee-1", "Employee One", "owner-1", "Owner One", nil, "", "closed", closedAt, nil, "", "")
	expectChatChannelMembersQuery(mock, "channel-1", "employee-1", "Employee One", "employee")
	expectChatMessageCount(mock, "channel-1", 3)
	expectChatLatestMessageLookup(mock, "channel-1", "Thanks, resolved now", latestAt, "Employee One")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat channels status filter")
}

func TestRouterCreateChatChannelRejectsEmployeeWhenAutoCreateDisabled(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/chat/channels", `{"name":"Need help","initialMessage":"VPN issue"}`)
	defer cleanup()

	expectWorkflowSettingsLookup(mock, `{"chatAutoCreateEnabled":false}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "create chat channel employee disabled")
}

func TestRouterCreateChatChannelAllowsEmployeeWhenAutoCreateEnabled(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/chat/channels", `{"name":"VPN Support","initialMessage":"Cannot connect to VPN"}`)
	defer cleanup()

	expectWorkflowSettingsLookup(mock, `{"chatAutoCreateEnabled":true}`)
	expectWorkflowSettingsLookup(mock, `{"chatAutoRouteEnabled":true,"chatFallbackAssigneeId":"owner-1","chatMemberIds":["owner-1"]}`)
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["owner-1"]}`)
	expectActiveWorkflowUserLookup(mock, "owner-1", "it_team", true)
	mock.ExpectBegin()
	expectChatChannelCreate(mock, "VPN Support", "support", "employee-1", "owner-1", "channel-2")
	expectChatMemberInsert(mock, "channel-2", "employee-1", 1)
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["owner-1"]}`)
	expectActiveWorkflowUserLookup(mock, "owner-1", "it_team", true)
	expectChatMemberInsert(mock, "channel-2", "owner-1", 1)
	expectChatInitialMessageInsert(mock, "channel-2", "employee-1", "Cannot connect to VPN")
	mock.ExpectCommit()
	expectAuditInsert(mock, "employee-1", "entity-1", "chat_channel_created", "chat_channel", "channel-2", `{"initialMessage":"Cannot connect to VPN","kind":"support","memberIds":null,"name":"VPN Support","primaryOwnerId":"owner-1","routedMemberId":"owner-1"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "create chat channel employee enabled")
}

func TestRouterCreateChatChannelAllowsITTeam(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/chat/channels", `{"name":"Printer Queue","kind":"operations","initialMessage":"Investigating print spooler"}`)
	defer cleanup()

	expectWorkflowSettingsLookup(mock, `{"chatAutoRouteEnabled":false}`)
	mock.ExpectBegin()
	expectChatChannelCreate(mock, "Printer Queue", "operations", "user-1", "user-1", "channel-1")
	expectChatMemberInsert(mock, "channel-1", "user-1", 1)
	expectChatInitialMessageInsert(mock, "channel-1", "user-1", "Investigating print spooler")
	mock.ExpectCommit()
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_created", "chat_channel", "channel-1", `{"initialMessage":"Investigating print spooler","kind":"operations","memberIds":null,"name":"Printer Queue","primaryOwnerId":"user-1","routedMemberId":""}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "create chat channel it team")
}

func TestRouterMarkAnnouncementReadTracksAuthenticatedUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPost, "/api/announcements/announcement-1/read", "")
	defer cleanup()

	expectAnnouncementRead(mock, "announcement-1", "employee-1")
	expectAuditInsert(mock, "employee-1", "entity-1", "announcement_read", "announcement", "announcement-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusCreated, "mark announcement read route")
}
