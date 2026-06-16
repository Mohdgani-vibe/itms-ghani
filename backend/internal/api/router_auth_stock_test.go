package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func newRoleFileUploadRouteRequest(t *testing.T, role string, userID string, entityID string, method string, target string, fieldName string, fileName string, fileContent []byte) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	manager, mock, recorder, router, cleanup := newRouterTestHarness(t)
	token := issueRouterTestToken(t, manager, role, userID, entityID)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := part.Write(fileContent); err != nil {
		t.Fatalf("part.Write: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close: %v", err)
	}
	request := httptest.NewRequest(method, target, body)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return mock, recorder, router, request, cleanup
}

func TestRouterInventoryImportTemplateIncludesCategoryColumn(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/inventory/import-template", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import template route")

	body := strings.TrimSpace(recorder.Body.String())
	if !strings.Contains(body, "Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status") {
		t.Fatalf("template body = %q, want category-aware header row", body)
	}
	if !strings.Contains(body, "ITEM001,Laptop,Laptop,ASSET001,SN123456") {
		t.Fatalf("template body = %q, want example row aligned with category column", body)
	}
}

func TestRouterExportInventoryIncludesCategoryColumn(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/inventory/export", "")
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT item_code, category, name, COALESCE(asset_tag, ''), COALESCE(serial_number, ''), COALESCE(specs, ''), COALESCE(branch_id::text, ''), COALESCE(assigned_user_id::text, ''), COALESCE(warranty_expires_at::text, ''), COALESCE(cost::text, ''), status FROM stock_items ORDER BY item_code`)).
		WillReturnRows(sqlmock.NewRows([]string{"item_code", "category", "name", "asset_tag", "serial_number", "specs", "branch_id", "assigned_user_id", "warranty_expires_at", "cost", "status"}).
			AddRow("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory export route")

	body := strings.TrimSpace(recorder.Body.String())
	if !strings.Contains(body, "Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status") {
		t.Fatalf("export body = %q, want category-aware header row", body)
	}
	if !strings.Contains(body, "ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory") {
		t.Fatalf("export body = %q, want exported row with category column", body)
	}
}

func TestRouterImportInventoryItemsAcceptsTemplateHeaders(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO stock_items (item_code, category, name, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, status, created_at) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, '')::uuid, NULLIF($8, '')::uuid, NULLIF($9, '')::date, NULLIF($10, '')::numeric(12,2), COALESCE(NULLIF($11, ''), 'inventory'), NOW())`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import route")

	var body struct {
		Created int              `json:"created"`
		Updated int              `json:"updated"`
		Errors  []map[string]any `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 1 || body.Updated != 0 || len(body.Errors) != 0 {
		t.Fatalf("import response = %+v, want created=1 updated=0 no errors", body)
	}
}

func TestRouterImportInventoryItemsUpdatesExistingItemCode(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14 Gen 2,ASSET001,SN123456,32GB RAM,branch-2,,2028-01-01,65000,allocated",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14 Gen 2", "ASSET001", "SN123456", "32GB RAM", "branch-2", "", "2028-01-01", "65000", "allocated").
		WillReturnResult(sqlmock.NewResult(0, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import update existing item code")

	var body struct {
		Created int              `json:"created"`
		Updated int              `json:"updated"`
		Errors  []map[string]any `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 0 || body.Updated != 1 || len(body.Errors) != 0 {
		t.Fatalf("import response = %+v, want created=0 updated=1 no errors", body)
	}
}

func TestRouterImportInventoryItemsSkipsBlankRows(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		",,,,,,,,,,",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		" , , , , , , , , , , ",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO stock_items (item_code, category, name, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, status, created_at) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, '')::uuid, NULLIF($8, '')::uuid, NULLIF($9, '')::date, NULLIF($10, '')::numeric(12,2), COALESCE(NULLIF($11, ''), 'inventory'), NOW())`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import skips blank rows")

	var body struct {
		Created int              `json:"created"`
		Updated int              `json:"updated"`
		Errors  []map[string]any `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 1 || body.Updated != 0 || len(body.Errors) != 0 {
		t.Fatalf("import response = %+v, want only the non-blank row imported", body)
	}
}

func TestRouterImportInventoryItemsRejectsMissingCategoryHeader(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "inventory import missing category header")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "csv must include category column") {
		t.Fatalf("response body = %q, want missing category error", body)
	}
}

func TestRouterImportInventoryItemsRejectsMissingItemCodeHeader(t *testing.T) {
	csvBody := strings.Join([]string{
		"Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "inventory import missing item_code header")

	if body := strings.TrimSpace(recorder.Body.String()); !strings.Contains(body, "csv must include item_code column") {
		t.Fatalf("response body = %q, want missing item_code error", body)
	}
}

func TestRouterImportInventoryItemsReportsDuplicateRowsInFile(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM002,Laptop,ThinkPad T14 Gen 2,ASSET001,SN654321,32GB RAM,branch-1,,2027-06-01,65000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO stock_items (item_code, category, name, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, status, created_at) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, '')::uuid, NULLIF($8, '')::uuid, NULLIF($9, '')::date, NULLIF($10, '')::numeric(12,2), COALESCE(NULLIF($11, ''), 'inventory'), NOW())`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import duplicate rows in file")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 1 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want first row created only", body)
	}
	if len(body.Errors) != 1 || body.Errors[0].Row != 3 || body.Errors[0].Message != "duplicate asset_tag in file" {
		t.Fatalf("errors = %+v, want duplicate asset_tag error on row 3", body.Errors)
	}
}

func TestRouterImportInventoryItemsReportsExistingDatabaseDuplicates(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import existing database duplicate")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 0 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want no rows imported", body)
	}
	if len(body.Errors) != 1 || body.Errors[0].Row != 2 || body.Errors[0].Message != "asset_tag or serial_number already exists in database" {
		t.Fatalf("errors = %+v, want database duplicate error on row 2", body.Errors)
	}
}

func TestRouterImportInventoryItemsReportsInvalidWarrantyFormat(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027/01/01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import invalid warranty format")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 0 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want no rows imported", body)
	}
	if len(body.Errors) != 1 || body.Errors[0].Row != 2 || body.Errors[0].Message != "invalid warranty_expires_at format (use DD/MM/YYYY or YYYY-MM-DD)" {
		t.Fatalf("errors = %+v, want invalid warranty format error on row 2", body.Errors)
	}
}

func TestRouterImportInventoryItemsReportsInvalidCostFormat(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,not-a-number,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import invalid cost format")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 0 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want no rows imported", body)
	}
	if len(body.Errors) != 1 || body.Errors[0].Row != 2 || body.Errors[0].Message != "invalid cost format" {
		t.Fatalf("errors = %+v, want invalid cost format error on row 2", body.Errors)
	}
}

func TestRouterImportInventoryItemsReportsMissingRequiredRowFields(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		",Laptop,ThinkPad T14 Base,ASSET000,SN123455,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM001,,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM002,Laptop,,ASSET002,SN123457,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM003,Laptop,ThinkPad T14 Gen 2,,SN123458,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM004,Laptop,ThinkPad T14 Gen 3,ASSET004,,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM005,Laptop,ThinkPad T14 Gen 4,ASSET005,SN123460,16GB RAM,,,2027-01-01,50000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import missing required row fields")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 0 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want no rows imported", body)
	}
	want := []struct {
		row     int
		message string
	}{
		{row: 2, message: "item_code is required"},
		{row: 3, message: "category is required"},
		{row: 4, message: "name is required"},
		{row: 5, message: "asset_tag is required"},
		{row: 6, message: "serial_number is required"},
		{row: 7, message: "branch_id is required"},
	}
	if len(body.Errors) != len(want) {
		t.Fatalf("errors = %+v, want %d validation errors", body.Errors, len(want))
	}
	for index, expected := range want {
		if body.Errors[index].Row != expected.row || body.Errors[index].Message != expected.message {
			t.Fatalf("errors[%d] = %+v, want row=%d message=%q", index, body.Errors[index], expected.row, expected.message)
		}
	}
}

func TestRouterImportInventoryItemsReportsDuplicateSerialNumbersInFile(t *testing.T) {
	csvBody := strings.Join([]string{
		"Item Code,Category,Name,Asset Tag,Serial Number,Specs,Branch ID,Assigned User ID,Warranty Expires At,Cost,Status",
		"ITEM001,Laptop,ThinkPad T14,ASSET001,SN123456,16GB RAM,branch-1,,2027-01-01,50000,inventory",
		"ITEM002,Laptop,ThinkPad T14 Gen 2,ASSET002,SN123456,32GB RAM,branch-1,,2027-06-01,65000,inventory",
	}, "\n")
	mock, recorder, router, request, cleanup := newRoleFileUploadRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/inventory/import", "file", "inventory.csv", []byte(csvBody))
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`)).
		WithArgs("ASSET001", "SN123456").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO stock_items (item_code, category, name, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, status, created_at) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, '')::uuid, NULLIF($8, '')::uuid, NULLIF($9, '')::date, NULLIF($10, '')::numeric(12,2), COALESCE(NULLIF($11, ''), 'inventory'), NOW())`)).
		WithArgs("ITEM001", "Laptop", "ThinkPad T14", "ASSET001", "SN123456", "16GB RAM", "branch-1", "", "2027-01-01", "50000", "inventory").
		WillReturnResult(sqlmock.NewResult(1, 1))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory import duplicate serial numbers in file")

	var body struct {
		Created int `json:"created"`
		Updated int `json:"updated"`
		Errors  []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if body.Created != 1 || body.Updated != 0 {
		t.Fatalf("import response = %+v, want first row created only", body)
	}
	if len(body.Errors) != 1 || body.Errors[0].Row != 3 || body.Errors[0].Message != "duplicate serial_number in file" {
		t.Fatalf("errors = %+v, want duplicate serial_number error on row 3", body.Errors)
	}
}

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

func TestRouterInventoryModuleOptionsScopesBranches(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/inventory/module/options", "")
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name FROM items ORDER BY name`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("item-1", "Laptop"))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name FROM suppliers ORDER BY name`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("supplier-1", "Dell"))
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
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT si.id, si.item_id::text, si.name, si.item_code, COALESCE(si.company_name, ''), COALESCE(si.supplier_id::text, ''), COALESCE(si.operating_system, ''), COALESCE(si.asset_type, 'non_critical'), COALESCE(si.specs_remarks, '')
		FROM sub_items si
		ORDER BY si.name
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "item_id", "name", "item_code", "company_name", "supplier_id", "operating_system", "asset_type", "specs_remarks"}))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(full_name, '') FROM entities WHERE id = $1::uuid`)).
		WithArgs("entity-1").
		WillReturnRows(sqlmock.NewRows([]string{"full_name"}).AddRow("Entity One"))
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT u.id, u.full_name, COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(l.full_name, '')
			FROM users u
			LEFT JOIN locations l ON l.id = u.location_id
			WHERE u.is_active = TRUE
			  AND (
			      u.entity_id = $1::uuid
			      OR EXISTS (
			          SELECT 1 FROM user_entity_access uea
			          WHERE uea.user_id = $2::uuid AND uea.entity_id = u.entity_id
			      )
			  )
			ORDER BY u.full_name
		`)).
		WithArgs("entity-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "email", "emp_id", "full_name"}))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory module options scoped branches")

	var body struct {
		Branches []struct {
			ID string `json:"id"`
		} `json:"branches"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(body.Branches) != 1 || body.Branches[0].ID != "branch-1" {
		t.Fatalf("branches = %+v, want scoped branch payload", body.Branches)
	}
}

func TestRouterInventoryModuleOptionsScopesEmployees(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/inventory/module/options", "")
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name FROM items ORDER BY name`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name FROM suppliers ORDER BY name`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}))
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
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT si.id, si.item_id::text, si.name, si.item_code, COALESCE(si.company_name, ''), COALESCE(si.supplier_id::text, ''), COALESCE(si.operating_system, ''), COALESCE(si.asset_type, 'non_critical'), COALESCE(si.specs_remarks, '')
		FROM sub_items si
		ORDER BY si.name
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "item_id", "name", "item_code", "company_name", "supplier_id", "operating_system", "asset_type", "specs_remarks"}))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(full_name, '') FROM entities WHERE id = $1::uuid`)).
		WithArgs("entity-1").
		WillReturnRows(sqlmock.NewRows([]string{"full_name"}).AddRow("Entity One"))
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT u.id, u.full_name, COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(l.full_name, '')
			FROM users u
			LEFT JOIN locations l ON l.id = u.location_id
			WHERE u.is_active = TRUE
			  AND (
			      u.entity_id = $1::uuid
			      OR EXISTS (
			          SELECT 1 FROM user_entity_access uea
			          WHERE uea.user_id = $2::uuid AND uea.entity_id = u.entity_id
			      )
			  )
			ORDER BY u.full_name
		`)).
		WithArgs("entity-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "email", "emp_id", "full_name"}).AddRow("employee-1", "Visible User", "visible@example.com", "EMP-1", "HQ"))

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "inventory module options scoped employees")

	var body struct {
		Employees []struct {
			ID string `json:"id"`
		} `json:"employees"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(body.Employees) != 1 || body.Employees[0].ID != "employee-1" {
		t.Fatalf("employees = %+v, want scoped employee payload", body.Employees)
	}
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
