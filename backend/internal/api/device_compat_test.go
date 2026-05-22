package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRouterGetDeviceCompatIncludesSaltMinionIDAlias(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "super_admin", "user-1", "entity-1", http.MethodGet, "/api/devices/asset-1", "")
	defer cleanup()

	expectAssetLookup(mock, "asset-1", "AST-001", "Spare Laptop", "spare-ho", "laptop", true, "entity-1", "spare.ho-003", "wazuh-1", "in_use", "good")
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(processor, ''), COALESCE(ram, ''), COALESCE(storage, ''), COALESCE(gpu, ''), COALESCE(display, ''), COALESCE(bios_version, ''), COALESCE(mac_address, ''),
			COALESCE(os_name, ''), COALESCE(os_version, ''), COALESCE(kernel, ''), COALESCE(architecture, ''), COALESCE(os_build, ''), last_boot, last_seen, pending_updates,
			COALESCE(anydesk_id, ''), COALESCE(rustdesk_id, ''), COALESCE(disk_layout, ''), volumes_json, logged_in_users_json
		FROM asset_compute_details WHERE asset_id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{
		"processor", "ram", "storage", "gpu", "display", "bios_version", "mac_address",
		"os_name", "os_version", "kernel", "architecture", "os_build", "last_boot", "last_seen", "pending_updates",
		"anydesk_id", "rustdesk_id", "disk_layout", "volumes_json", "logged_in_users_json",
	}).AddRow("", "", "", "", "", "", "", "Ubuntu 24.04", "24.04", "", "x86_64", "", nil, nil, 0, "", "", "", []byte(`[]`), []byte(`[]`)))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(wired_ip::text, ''), COALESCE(wireless_ip::text, ''), COALESCE(netbird_ip::text, ''), COALESCE(dns, ''), COALESCE(gateway::text, ''), interface_stats FROM asset_network_snapshots WHERE asset_id = $1::uuid`)).
		WithArgs("asset-1").
		WillReturnRows(sqlmock.NewRows([]string{"wired_ip", "wireless_ip", "netbird_ip", "dns", "gateway", "interface_stats"}).AddRow("", "", "", "", "", []byte(`{}`)))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name, COALESCE(version, ''), COALESCE(install_date::text, ''), COALESCE(source, '') FROM asset_software_inventory WHERE asset_id = $1::uuid ORDER BY name`)).
		WithArgs("asset-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "version", "install_date", "source"}))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(d.name, ''), COALESCE(l.full_name, '')
		FROM assets a
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments d ON d.id = a.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		WHERE a.id = $1::uuid
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"full_name", "email", "emp_id", "name", "full_name"}).AddRow("", "", "", "", ""))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, source, severity, title, COALESCE(detail, ''), is_resolved, created_at
		FROM asset_alerts
		WHERE asset_id = $1::uuid AND created_at >= NOW() - INTERVAL '7 days'
		ORDER BY created_at DESC
	`)).WithArgs("asset-1").WillReturnRows(sqlmock.NewRows([]string{"id", "source", "severity", "title", "detail", "is_resolved", "created_at"}))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "get device compat includes salt minion alias")

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body["saltMinionId"] != "spare.ho-003" {
		t.Fatalf("saltMinionId = %v, want spare.ho-003", body["saltMinionId"])
	}
	if body["salt_minion_id"] != "spare.ho-003" {
		t.Fatalf("salt_minion_id = %v, want spare.ho-003", body["salt_minion_id"])
	}
	if body["hostname"] != "spare-ho" {
		t.Fatalf("hostname = %v, want spare-ho", body["hostname"])
	}
}