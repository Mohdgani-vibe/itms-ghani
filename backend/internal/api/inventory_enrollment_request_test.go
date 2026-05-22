package api

import (
	"context"
	"database/sql"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"itms/backend/internal/inventorysync"
)

func TestInventoryIngestAssignedAssetCreatesAndCompletesEnrollmentRequest(t *testing.T) {
	server, mock, cleanup := newTestServer(t)
	defer cleanup()

	asset := inventorysync.Asset{
		AssetTag:        "SPAREHO-56DDF4B0",
		Hostname:        "spare-ho",
		AssignedToName:  "idyan khan",
		AssignedToEmail: "idyan.khan@zerodha.com",
		EmployeeCode:    "Z3662",
		DepartmentName:  "IT Operations",
		Category:        "laptop",
		Model:           "21JKS1E900",
	}

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT u.id::text
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'super_admin'
		ORDER BY u.created_at ASC
		LIMIT 1
	`)).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("super-admin-1"))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.emp_id, '')
		FROM assets a
		JOIN users u ON u.id = a.assigned_to
		WHERE ($1 <> '' AND a.source_fingerprint = $1)
		   OR ($2 <> '' AND a.asset_tag = $2)
		   OR ($3 <> '' AND a.hostname = $3)
		   OR ($4 <> '' AND a.name = $4)
		ORDER BY
			CASE
				WHEN $1 <> '' AND a.source_fingerprint = $1 THEN 0
				WHEN $2 <> '' AND a.asset_tag = $2 THEN 1
				WHEN $3 <> '' AND a.hostname = $3 THEN 2
				WHEN $4 <> '' AND a.name = $4 THEN 3
				ELSE 4
			END,
			a.updated_at DESC,
			a.created_at DESC
		LIMIT 1
	`)).WithArgs("", "SPAREHO-56DDF4B0", "spare-ho", "").WillReturnError(sql.ErrNoRows)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id::text, status
		FROM requests
		WHERE requester_id = $1::uuid
		  AND type = 'device_enrollment'
		  AND (
				(NULLIF($2, '') IS NOT NULL AND reference_key = $2)
				OR title = $3
		  )
		ORDER BY updated_at DESC, created_at DESC, id DESC
		LIMIT 1
	`)).WithArgs("super-admin-1", "device_enrollment:SPAREHO-56DDF4B0", "Device enrollment review for SPAREHO-56DDF4B0").WillReturnError(sql.ErrNoRows)

	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO requests (id, requester_id, type, title, description, status, notes, reference_key, created_at, updated_at)
		VALUES (gen_random_uuid(), $1::uuid, 'device_enrollment', $2, $3, 'pending', $4, NULLIF($5, ''), NOW(), NOW())
	`)).WithArgs(
		"super-admin-1",
		"Device enrollment review for SPAREHO-56DDF4B0",
		sqlmock.AnyArg(),
		"Awaiting superadmin/IT review before endpoint onboarding is acknowledged for SPAREHO-56DDF4B0.",
		"device_enrollment:SPAREHO-56DDF4B0",
	).WillReturnResult(sqlmock.NewResult(1, 1))

	if err := server.ensureInventoryEnrollmentRequest(context.Background(), asset); err != nil {
		t.Fatalf("ensureInventoryEnrollmentRequest error: %v", err)
	}

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT u.id::text
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'super_admin'
		ORDER BY u.created_at ASC
		LIMIT 1
	`)).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("super-admin-1"))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id::text, status
		FROM requests
		WHERE requester_id = $1::uuid
		  AND type = 'device_enrollment'
		  AND (
				(NULLIF($2, '') IS NOT NULL AND reference_key = $2)
				OR title = $3
		  )
		ORDER BY updated_at DESC, created_at DESC, id DESC
		LIMIT 1
	`)).WithArgs("super-admin-1", "device_enrollment:SPAREHO-56DDF4B0", "Device enrollment review for SPAREHO-56DDF4B0").WillReturnRows(sqlmock.NewRows([]string{"id", "status"}).AddRow("request-1", "pending"))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.emp_id, '')
		FROM assets a
		JOIN users u ON u.id = a.assigned_to
		WHERE ($1 <> '' AND a.source_fingerprint = $1)
		   OR ($2 <> '' AND a.asset_tag = $2)
		   OR ($3 <> '' AND a.hostname = $3)
		   OR ($4 <> '' AND a.name = $4)
		ORDER BY
			CASE
				WHEN $1 <> '' AND a.source_fingerprint = $1 THEN 0
				WHEN $2 <> '' AND a.asset_tag = $2 THEN 1
				WHEN $3 <> '' AND a.hostname = $3 THEN 2
				WHEN $4 <> '' AND a.name = $4 THEN 3
				ELSE 4
			END,
			a.updated_at DESC,
			a.created_at DESC
		LIMIT 1
	`)).WithArgs("", "SPAREHO-56DDF4B0", "spare-ho", "").WillReturnRows(sqlmock.NewRows([]string{"full_name", "emp_id"}).AddRow("idyan khan", "Z3662"))

	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE requests
		SET status = 'resolved',
			notes = $2,
			updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs("request-1", "Enrollment review auto-completed after inventory ingest onboarded SPAREHO-56DDF4B0 and assigned it to idyan khan (Z3662).").WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO request_comments (id, request_id, author_id, note, created_at)
		VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, NOW())
	`)).WithArgs("request-1", "super-admin-1", "Enrollment review auto-completed after inventory ingest onboarded SPAREHO-56DDF4B0 and assigned it to idyan khan (Z3662).").WillReturnResult(sqlmock.NewResult(1, 1))

	if err := server.completeInventoryEnrollmentRequest(context.Background(), asset); err != nil {
		t.Fatalf("completeInventoryEnrollmentRequest error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}