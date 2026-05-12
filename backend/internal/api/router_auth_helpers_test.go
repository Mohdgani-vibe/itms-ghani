package api

import (
	"bytes"
	"database/sql/driver"
	"encoding/base64"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"itms/backend/internal/app"
	"itms/backend/internal/platform/authn"
)

func newRouterTestHarness(t *testing.T) (*authn.Manager, sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	config := app.Config{
		FrontendOrigin: "http://localhost:5173",
		JWTSecret:      "test-secret-with-sufficient-length-123",
		JWTTTL:         time.Hour,
	}
	router := NewRouter(db, config, nil)
	manager := authn.NewManager(config.JWTSecret, config.JWTTTL)
	return manager, mock, httptest.NewRecorder(), router, func() { _ = db.Close() }
}

func issueRouterTestToken(t *testing.T, manager *authn.Manager, role string, userID string, entityID string) string {
	t.Helper()
	token, err := manager.IssueToken(authn.UserTokenInput{
		UserID:   userID,
		EmpID:    "EMP-1",
		Email:    role + "@example.com",
		Role:     role,
		EntityID: entityID,
		Name:     role,
	})
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	return token
}

func newAuthorizedRequest(method string, target string, token string, body string) *http.Request {
	var request *http.Request
	if body == "" {
		request = httptest.NewRequest(method, target, nil)
	} else {
		request = httptest.NewRequest(method, target, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("Authorization", "Bearer "+token)
	return request
}

func newAuthorizedMultipartRequest(t *testing.T, method string, target string, token string, receiverName string, fileName string, fileContentType string, fileContent []byte) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("receiverSignedName", receiverName); err != nil {
		t.Fatalf("WriteField: %v", err)
	}
	headers := textproto.MIMEHeader{}
	headers.Set("Content-Disposition", `form-data; name="file"; filename="`+fileName+`"`)
	headers.Set("Content-Type", fileContentType)
	part, err := writer.CreatePart(headers)
	if err != nil {
		t.Fatalf("CreatePart: %v", err)
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
	return request
}

func newRoleRouteRequest(t *testing.T, role string, userID string, entityID string, method string, target string, body string) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	manager, mock, recorder, router, cleanup := newRouterTestHarness(t)
	token := issueRouterTestToken(t, manager, role, userID, entityID)
	request := newAuthorizedRequest(method, target, token, body)
	return mock, recorder, router, request, cleanup
}

func newRoleMultipartRouteRequest(t *testing.T, role string, userID string, entityID string, method string, target string, receiverName string, fileName string, fileContentType string, fileContent []byte) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	manager, mock, recorder, router, cleanup := newRouterTestHarness(t)
	token := issueRouterTestToken(t, manager, role, userID, entityID)
	request := newAuthorizedMultipartRequest(t, method, target, token, receiverName, fileName, fileContentType, fileContent)
	return mock, recorder, router, request, cleanup
}

func newAnonymousRouteRequest(t *testing.T, method string, target string) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	_, mock, recorder, router, cleanup := newRouterTestHarness(t)
	request := httptest.NewRequest(method, target, nil)
	return mock, recorder, router, request, cleanup
}

func newInvalidBearerRouteRequest(t *testing.T, method string, target string) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	_, mock, recorder, router, cleanup := newRouterTestHarness(t)
	request := httptest.NewRequest(method, target, nil)
	request.Header.Set("Authorization", "Bearer not-a-valid-jwt")
	return mock, recorder, router, request, cleanup
}

func newRoleWebSocketRouteRequest(t *testing.T, role string, userID string, entityID string, target string) (sqlmock.Sqlmock, *httptest.ResponseRecorder, http.Handler, *http.Request, func()) {
	t.Helper()
	manager, mock, recorder, router, cleanup := newRouterTestHarness(t)
	token := issueRouterTestToken(t, manager, role, userID, entityID)
	encodedToken := base64.RawURLEncoding.EncodeToString([]byte(token))
	request := httptest.NewRequest(http.MethodGet, target, nil)
	request.Header.Set("Origin", "http://localhost:5173")
	request.Header.Set("Sec-WebSocket-Protocol", "itms.ssh.v1, bearer."+encodedToken)
	return mock, recorder, router, request, cleanup
}

func expectAuditInsert(mock sqlmock.Sqlmock, actorID string, entityID string, action string, targetType string, targetID string, detail string) {
	mock.ExpectExec(regexp.QuoteMeta(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`)).
		WithArgs(actorID, entityID, action, targetType, targetID, detail, "192.0.2.1", "").
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectStockItemStatusUpdate(mock sqlmock.Sqlmock, stockItemID string, status string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE stock_items
		SET assigned_user_id = NULL, status = '` + status + `', updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(stockItemID).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectStockItemScopeLookup(mock sqlmock.Sqlmock, stockItemID string, branchEntityID any, assignedEntityID any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT l.entity_id::text, u.entity_id::text
		FROM stock_items s
		LEFT JOIN locations l ON l.id = s.branch_id
		LEFT JOIN users u ON u.id = s.assigned_user_id
		WHERE s.id = $1::uuid
	`)).WithArgs(stockItemID).WillReturnRows(sqlmock.NewRows([]string{"branch_entity_id", "assigned_entity_id"}).AddRow(branchEntityID, assignedEntityID))
}

func expectStockScopeAllowed(mock sqlmock.Sqlmock, stockItemID string, visibleEntityID string) {
	expectStockItemScopeLookup(mock, stockItemID, visibleEntityID, nil)
}

func expectStockScopeDelegated(mock sqlmock.Sqlmock, stockItemID string, delegatedEntityID string, userID string, allowed bool) {
	expectStockItemScopeLookup(mock, stockItemID, delegatedEntityID, nil)
	expectEntityAccessCheck(mock, userID, delegatedEntityID, allowed)
}

func expectGatepassDecisionUpdate(mock sqlmock.Sqlmock, gatepassID string, status string, approverID string, requesterID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		UPDATE gatepasses
		SET status = $2, approver_id = $3::uuid, updated_at = NOW()
		WHERE id = $1::uuid
		RETURNING requester_id
	`)).WithArgs(gatepassID, status, approverID).WillReturnRows(sqlmock.NewRows([]string{"requester_id"}).AddRow(requesterID))
}

func expectGatepassCompleteUpdate(mock sqlmock.Sqlmock, gatepassID string, receiverName string, securityName string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE gatepasses
		SET receiver_signed_name = COALESCE(NULLIF(receiver_signed_name, ''), COALESCE(NULLIF($2, ''), employee_name)),
			receiver_signed_at = COALESCE(receiver_signed_at, NOW()),
			security_signed_name = $3,
			security_signed_at = NOW(),
			status = 'completed',
			updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(gatepassID, receiverName, securityName).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectRequestStatusUpdate(mock sqlmock.Sqlmock, requestID string, status string, notes string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE requests
		SET status = $2, notes = NULLIF($3, ''), updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(requestID, status, notes).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectChatChannelCreatorLookup(mock sqlmock.Sqlmock, channelID string, createdBy string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT created_by FROM chat_channels WHERE id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnRows(sqlmock.NewRows([]string{"created_by"}).AddRow(createdBy))
}

func expectChatChannelDelete(mock sqlmock.Sqlmock, channelID string) {
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM chat_channels WHERE id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectChatChannelExists(mock sqlmock.Sqlmock, channelID string, exists bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT EXISTS(SELECT 1 FROM chat_channels WHERE id = $1::uuid)`)).
		WithArgs(channelID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(exists))
}

func expectChatMembershipCheck(mock sqlmock.Sqlmock, channelID string, userID string, allowed bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT EXISTS(SELECT 1 FROM chat_members WHERE channel_id = $1::uuid AND user_id = $2::uuid)`)).
		WithArgs(channelID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(allowed))
}

func expectChatChannelStatusLookup(mock sqlmock.Sqlmock, channelID string, status string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM chat_channels WHERE id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(status))
}

func expectAssetLookup(mock sqlmock.Sqlmock, assetID string, assetTag string, name string, hostname string, category string, isCompute bool, entityID string, saltMinionID string, wazuhAgentID string, status string, condition string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets WHERE id = $1::uuid
	`)).WithArgs(assetID).WillReturnRows(sqlmock.NewRows([]string{
		"id", "asset_tag", "name", "hostname", "category", "is_compute", "serial_number", "manufacturer", "model", "entity_id",
		"assigned_to", "dept_id", "location_id", "purchase_date", "cost", "warranty_until", "status", "condition", "glpi_id", "salt_minion_id", "wazuh_agent_id", "notes",
	}).AddRow(assetID, assetTag, name, hostname, category, isCompute, "", "", "", entityID, "", "", "", "", "", "", status, condition, 0, saltMinionID, wazuhAgentID, ""))
}

func expectChatUserMembershipExists(mock sqlmock.Sqlmock, userID string, exists bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT EXISTS(SELECT 1 FROM chat_members WHERE user_id = $1::uuid)`)).
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(exists))
}

func expectChatChannelListCount(mock sqlmock.Sqlmock, userID string, total int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(DISTINCT c.id)
		FROM chat_channels c
		JOIN chat_members m ON m.channel_id = c.id
		WHERE m.user_id = $1::uuid`)).
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(total))
}

func expectChatChannelListCountWithClause(mock sqlmock.Sqlmock, clause string, args []any, total int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(DISTINCT c.id)
		FROM chat_channels c
		JOIN chat_members m ON m.channel_id = c.id
		WHERE `+clause)).
		WithArgs(requestArgs(args...)...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(total))
}

func expectChatChannelListQuery(mock sqlmock.Sqlmock, userID string, channelID string, name string, kind string, createdAt time.Time, createdByID any, createdByName any, primaryOwnerID any, primaryOwnerName any, backupOwnerID any, backupOwnerName any, status string, closedAt any, linkedRequestID any, linkedTicketNumber any, linkedRequestStatus any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT c.id, c.name, c.kind, c.created_at, c.created_by, COALESCE(creator.full_name, ''), c.primary_owner_id, COALESCE(owner.full_name, ''),
			c.backup_owner_id, COALESCE(backup_owner.full_name, ''), c.status, c.closed_at, c.linked_request_id, COALESCE(r.ticket_number, ''), COALESCE(r.status, '')
		FROM chat_channels c
		JOIN chat_members m ON m.channel_id = c.id
		LEFT JOIN users creator ON creator.id = c.created_by
		LEFT JOIN users owner ON owner.id = c.primary_owner_id
		LEFT JOIN users backup_owner ON backup_owner.id = c.backup_owner_id
		LEFT JOIN requests r ON r.id = c.linked_request_id
		WHERE m.user_id = $1::uuid
		ORDER BY COALESCE((SELECT MAX(created_at) FROM chat_messages WHERE channel_id = c.id), c.created_at) DESC, c.created_at DESC
	`)).WithArgs(userID).WillReturnRows(sqlmock.NewRows([]string{"id", "name", "kind", "created_at", "created_by", "creator_name", "primary_owner_id", "primary_owner_name", "backup_owner_id", "backup_owner_name", "status", "closed_at", "linked_request_id", "ticket_number", "request_status"}).AddRow(channelID, name, kind, createdAt, createdByID, createdByName, primaryOwnerID, primaryOwnerName, backupOwnerID, backupOwnerName, status, closedAt, linkedRequestID, linkedTicketNumber, linkedRequestStatus))
}

func expectChatChannelListPagedQuery(mock sqlmock.Sqlmock, userID string, pageSize int, offset int, channelID string, name string, kind string, createdAt time.Time, createdByID any, createdByName any, primaryOwnerID any, primaryOwnerName any, backupOwnerID any, backupOwnerName any, status string, closedAt any, linkedRequestID any, linkedTicketNumber any, linkedRequestStatus any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT c.id, c.name, c.kind, c.created_at, c.created_by, COALESCE(creator.full_name, ''), c.primary_owner_id, COALESCE(owner.full_name, ''),
			c.backup_owner_id, COALESCE(backup_owner.full_name, ''), c.status, c.closed_at, c.linked_request_id, COALESCE(r.ticket_number, ''), COALESCE(r.status, '')
		FROM chat_channels c
		JOIN chat_members m ON m.channel_id = c.id
		LEFT JOIN users creator ON creator.id = c.created_by
		LEFT JOIN users owner ON owner.id = c.primary_owner_id
		LEFT JOIN users backup_owner ON backup_owner.id = c.backup_owner_id
		LEFT JOIN requests r ON r.id = c.linked_request_id
		WHERE m.user_id = $1::uuid
		ORDER BY COALESCE((SELECT MAX(created_at) FROM chat_messages WHERE channel_id = c.id), c.created_at) DESC, c.created_at DESC
		 LIMIT $2 OFFSET $3`)).WithArgs(userID, pageSize, offset).WillReturnRows(sqlmock.NewRows([]string{"id", "name", "kind", "created_at", "created_by", "creator_name", "primary_owner_id", "primary_owner_name", "backup_owner_id", "backup_owner_name", "status", "closed_at", "linked_request_id", "ticket_number", "request_status"}).AddRow(channelID, name, kind, createdAt, createdByID, createdByName, primaryOwnerID, primaryOwnerName, backupOwnerID, backupOwnerName, status, closedAt, linkedRequestID, linkedTicketNumber, linkedRequestStatus))
}

func expectChatChannelListQueryWithClause(mock sqlmock.Sqlmock, clause string, args []any, channelID string, name string, kind string, createdAt time.Time, createdByID any, createdByName any, primaryOwnerID any, primaryOwnerName any, backupOwnerID any, backupOwnerName any, status string, closedAt any, linkedRequestID any, linkedTicketNumber any, linkedRequestStatus any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT c.id, c.name, c.kind, c.created_at, c.created_by, COALESCE(creator.full_name, ''), c.primary_owner_id, COALESCE(owner.full_name, ''),
			c.backup_owner_id, COALESCE(backup_owner.full_name, ''), c.status, c.closed_at, c.linked_request_id, COALESCE(r.ticket_number, ''), COALESCE(r.status, '')
		FROM chat_channels c
		JOIN chat_members m ON m.channel_id = c.id
		LEFT JOIN users creator ON creator.id = c.created_by
		LEFT JOIN users owner ON owner.id = c.primary_owner_id
		LEFT JOIN users backup_owner ON backup_owner.id = c.backup_owner_id
		LEFT JOIN requests r ON r.id = c.linked_request_id
		WHERE `+clause+`
		ORDER BY COALESCE((SELECT MAX(created_at) FROM chat_messages WHERE channel_id = c.id), c.created_at) DESC, c.created_at DESC
	`)).WithArgs(requestArgs(args...)...).WillReturnRows(sqlmock.NewRows([]string{"id", "name", "kind", "created_at", "created_by", "creator_name", "primary_owner_id", "primary_owner_name", "backup_owner_id", "backup_owner_name", "status", "closed_at", "linked_request_id", "ticket_number", "request_status"}).AddRow(channelID, name, kind, createdAt, createdByID, createdByName, primaryOwnerID, primaryOwnerName, backupOwnerID, backupOwnerName, status, closedAt, linkedRequestID, linkedTicketNumber, linkedRequestStatus))
}

func expectChatChannelMembersQuery(mock sqlmock.Sqlmock, channelID string, memberID string, fullName string, role string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT u.id, u.full_name, r.name
			FROM chat_members cm
			JOIN users u ON u.id = cm.user_id
			JOIN roles r ON r.id = u.role_id
			WHERE cm.channel_id = $1::uuid
			ORDER BY u.full_name ASC
		`)).WithArgs(channelID).WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "name"}).AddRow(memberID, fullName, role))
}

func expectChatMessageCount(mock sqlmock.Sqlmock, channelID string, count int) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM chat_messages WHERE channel_id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

func expectChatLatestMessageLookup(mock sqlmock.Sqlmock, channelID string, body string, createdAt time.Time, authorName string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT cm.body, cm.created_at, COALESCE(u.full_name, '')
			FROM chat_messages cm
			LEFT JOIN users u ON u.id = cm.author_id
			WHERE cm.channel_id = $1::uuid
			ORDER BY cm.created_at DESC
			LIMIT 1
		`)).WithArgs(channelID).WillReturnRows(sqlmock.NewRows([]string{"body", "created_at", "full_name"}).AddRow(body, createdAt, authorName))
}

func expectChatMemberInsert(mock sqlmock.Sqlmock, channelID string, userID string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO chat_members (channel_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`)).
		WithArgs(channelID, userID).
		WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func expectChatMemberRoleLookup(mock sqlmock.Sqlmock, channelID string, userID string, role string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT r.name
		FROM chat_members cm
		JOIN users u ON u.id = cm.user_id
		JOIN roles r ON r.id = u.role_id
		WHERE cm.channel_id = $1::uuid AND cm.user_id = $2::uuid
	`)).WithArgs(channelID, userID).WillReturnRows(sqlmock.NewRows([]string{"name"}).AddRow(role))
}

func expectChatPrivilegedCount(mock sqlmock.Sqlmock, channelID string, count int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(*)
		FROM chat_members cm
		JOIN users u ON u.id = cm.user_id
		JOIN roles r ON r.id = u.role_id
		WHERE cm.channel_id = $1::uuid AND r.name IN ('super_admin', 'it_team')
	`)).WithArgs(channelID).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

func expectChatOwnerClear(mock sqlmock.Sqlmock, column string, channelID string, userID string) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE chat_channels SET ` + column + ` = NULL WHERE id = $1::uuid AND ` + column + ` = $2::uuid`)).
		WithArgs(channelID, userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectChatMemberDelete(mock sqlmock.Sqlmock, channelID string, userID string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM chat_members WHERE channel_id = $1::uuid AND user_id = $2::uuid`)).
		WithArgs(channelID, userID).
		WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func expectChatOwnerUpdate(mock sqlmock.Sqlmock, channelID string, ownerID string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE chat_channels SET primary_owner_id = NULLIF($2, '')::uuid WHERE id = $1::uuid`)).
		WithArgs(channelID, ownerID).
		WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func expectChatTicketSummaryQuery(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT u.id, u.full_name,
			COUNT(r.id) FILTER (WHERE r.source_chat_id IS NOT NULL),
			COUNT(r.id) FILTER (WHERE r.source_chat_id IS NOT NULL AND r.status IN ('pending', 'in_progress')),
			COUNT(r.id) FILTER (WHERE r.source_chat_id IS NOT NULL AND r.status = 'resolved')
		FROM users u
		JOIN roles role ON role.id = u.role_id
		LEFT JOIN requests r ON r.assignee_id = u.id
		WHERE u.is_active = TRUE AND role.name IN ('it_team', 'super_admin')
		GROUP BY u.id, u.full_name
		ORDER BY COUNT(r.id) FILTER (WHERE r.source_chat_id IS NOT NULL) DESC, u.full_name ASC
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "total", "open", "resolved"}).AddRow("owner-1", "Owner One", 3, 2, 1))
}

func expectChatChannelCreate(mock sqlmock.Sqlmock, name string, kind string, createdBy string, primaryOwnerID string, channelID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO chat_channels (name, kind, created_by, primary_owner_id)
		VALUES ($1, $2, $3::uuid, NULLIF($4, '')::uuid)
		RETURNING id
	`)).WithArgs(name, kind, createdBy, primaryOwnerID).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(channelID))
}

func expectChatInitialMessageInsert(mock sqlmock.Sqlmock, channelID string, authorID string, body string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
			INSERT INTO chat_messages (channel_id, author_id, body)
			VALUES ($1::uuid, $2::uuid, $3)
			RETURNING id, created_at
		`)).WithArgs(channelID, authorID, body).WillReturnRows(
		sqlmock.NewRows([]string{"id", "created_at"}).AddRow("message-1", time.Now().UTC()),
	)
}

func expectChatCloseLookup(mock sqlmock.Sqlmock, channelID string, linkedRequestID string, channelName string, primaryOwnerID string, createdByID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(linked_request_id::text, ''), name, COALESCE(primary_owner_id::text, ''), created_by::text
		FROM chat_channels
		WHERE id = $1::uuid
	`)).WithArgs(channelID).WillReturnRows(sqlmock.NewRows([]string{"linked_request_id", "name", "primary_owner_id", "created_by"}).AddRow(linkedRequestID, channelName, primaryOwnerID, createdByID))
}

func expectNextSupportTicketNumber(mock sqlmock.Sqlmock, ticketNumber string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT 'TKT-' || LPAD(nextval('support_ticket_number_seq')::text, 6, '0')`)).
		WillReturnRows(sqlmock.NewRows([]string{"ticket_number"}).AddRow(ticketNumber))
}

func expectChatTicketCreate(mock sqlmock.Sqlmock, requesterID string, assigneeID string, title string, status string, ticketNumber string, channelID string, requestID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO requests (requester_id, assignee_id, type, title, description, status, notes, ticket_number, source_chat_id, reference_key)
		VALUES ($1::uuid, NULLIF($2, '')::uuid, 'support_chat', $3, $4, $5, $6, $7, $8::uuid, $9)
		RETURNING id
	`)).WithArgs(requesterID, assigneeID, title, "Auto-created from a closed support chat conversation.", status, "Converted from chat closure.", ticketNumber, channelID, "chat:"+channelID).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(requestID))
}

func expectChatLinkedRequestUpdate(mock sqlmock.Sqlmock, channelID string, requestID string) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE chat_channels SET linked_request_id = $2::uuid WHERE id = $1::uuid`)).
		WithArgs(channelID, requestID).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectChatLinkedTicketLookup(mock sqlmock.Sqlmock, requestID string, ticketNumber string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(ticket_number, '') FROM requests WHERE id = $1::uuid`)).
		WithArgs(requestID).
		WillReturnRows(sqlmock.NewRows([]string{"ticket_number"}).AddRow(ticketNumber))
}

func expectChatCloseUpdate(mock sqlmock.Sqlmock, channelID string, userID string) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE chat_channels SET status = 'closed', closed_at = NOW(), closed_by = $2::uuid WHERE id = $1::uuid`)).
		WithArgs(channelID, userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectChatReopenStatusLookup(mock sqlmock.Sqlmock, channelID string, status string, linkedRequestID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, linked_request_id::text FROM chat_channels WHERE id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "linked_request_id"}).AddRow(status, linkedRequestID))
}

func expectChatReopenUpdate(mock sqlmock.Sqlmock, channelID string) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE chat_channels SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = $1::uuid`)).
		WithArgs(channelID).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectRequestAssigneeLookup(mock sqlmock.Sqlmock, requestID string, assigneeID any) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT assignee_id::text FROM requests WHERE id = $1::uuid`)).
		WithArgs(requestID).
		WillReturnRows(sqlmock.NewRows([]string{"assignee_id"}).AddRow(assigneeID))
}

func expectRequestStatusOnlyUpdate(mock sqlmock.Sqlmock, requestID string, status string) {
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE requests SET status = $2, updated_at = NOW() WHERE id = $1::uuid`)).
		WithArgs(requestID, status).
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectGatepassUploadMetadataLookup(mock sqlmock.Sqlmock, gatepassID string, gatepassNumber string, assetRef string, employeeCode string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(gatepass_number, ''), COALESCE(asset_ref, ''), COALESCE(employee_code, '') FROM gatepasses WHERE id = $1::uuid`)).
		WithArgs(gatepassID).
		WillReturnRows(sqlmock.NewRows([]string{"gatepass_number", "asset_ref", "employee_code"}).AddRow(gatepassNumber, assetRef, employeeCode))
}

func expectGatepassReceiverUploadUpdate(mock sqlmock.Sqlmock, gatepassID string, receiverName string, fileName string, contentType string, fileContent []byte, uploadedBy string, verificationStatus string, verificationNotes string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE gatepasses
		SET receiver_signed_name = $2,
			receiver_signed_at = COALESCE(receiver_signed_at, NOW()),
			receiver_signed_file_name = $3,
			receiver_signed_file_content_type = $4,
			receiver_signed_file_data = $5,
			receiver_signed_file_uploaded_at = NOW(),
			receiver_signed_file_uploaded_by = $6::uuid,
			receiver_signed_verification_status = $7,
			receiver_signed_verification_notes = NULLIF($8, ''),
			updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(gatepassID, receiverName, fileName, contentType, fileContent, uploadedBy, verificationStatus, verificationNotes).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectGatepassReceiverDownloadLookup(mock sqlmock.Sqlmock, gatepassID string, fileName string, contentType string, fileContent []byte) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(receiver_signed_file_name, ''), COALESCE(receiver_signed_file_content_type, ''), receiver_signed_file_data FROM gatepasses WHERE id = $1::uuid`)).
		WithArgs(gatepassID).
		WillReturnRows(sqlmock.NewRows([]string{"file_name", "content_type", "file_data"}).AddRow(fileName, contentType, fileContent))
}

func expectAuditListQuery(mock sqlmock.Sqlmock, actor string, empID string, entityCode string, action string, targetType string, targetID string, detail []byte, createdAt time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.id, COALESCE(u.full_name, ''), COALESCE(u.emp_id, ''), COALESCE(e.short_code, ''), a.action, COALESCE(a.target_type, ''), COALESCE(a.target_id::text, ''), a.detail, a.created_at
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_id
		LEFT JOIN entities e ON e.id = a.entity_id
		WHERE 1 = 1
		ORDER BY a.created_at DESC
		LIMIT 500
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "emp_id", "short_code", "action", "target_type", "target_id", "detail", "created_at"}).AddRow("audit-1", actor, empID, entityCode, action, targetType, targetID, detail, createdAt))
}

func expectAuditDetailLookup(mock sqlmock.Sqlmock, auditID string, actorID string, entityID string, action string, targetType string, targetID string, detail []byte, createdAt time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COALESCE(actor_id::text, ''), COALESCE(entity_id::text, ''), action, COALESCE(target_type, ''), COALESCE(target_id::text, ''), detail, created_at
		FROM audit_log WHERE id = $1::uuid
	`)).WithArgs(auditID).WillReturnRows(sqlmock.NewRows([]string{"actor_id", "entity_id", "action", "target_type", "target_id", "detail", "created_at"}).AddRow(actorID, entityID, action, targetType, targetID, detail, createdAt))
}

func expectAnnouncementCount(mock sqlmock.Sqlmock, total int) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) 
		FROM announcements a
		JOIN users u ON u.id = a.author_id
	`)).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(total))
}

func expectAnnouncementListQuery(mock sqlmock.Sqlmock, announcementID string, title string, body string, audience string, urgent bool, createdAt time.Time, authorName string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.id, a.title, a.body, a.audience, a.urgent, a.created_at, u.full_name
		
		FROM announcements a
		JOIN users u ON u.id = a.author_id
		
		ORDER BY a.created_at DESC
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "title", "body", "audience", "urgent", "created_at", "full_name"}).AddRow(announcementID, title, body, audience, urgent, createdAt, authorName))
}

func expectAnnouncementCountForAudiences(mock sqlmock.Sqlmock, audiences []string, total int) {
	placeholders := make([]string, 0, len(audiences))
	args := make([]driver.Value, 0, len(audiences))
	for index, audience := range audiences {
		placeholders = append(placeholders, fmt.Sprintf("$%d", index+1))
		args = append(args, audience)
	}
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) 
		FROM announcements a
		JOIN users u ON u.id = a.author_id
	 WHERE a.audience IN (` + strings.Join(placeholders, ", ") + `)`)).WithArgs(args...).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(total))
}

func expectAnnouncementListQueryForAudiences(mock sqlmock.Sqlmock, audiences []string, announcementID string, title string, body string, audience string, urgent bool, createdAt time.Time, authorName string) {
	placeholders := make([]string, 0, len(audiences))
	args := make([]driver.Value, 0, len(audiences))
	for index, value := range audiences {
		placeholders = append(placeholders, fmt.Sprintf("$%d", index+1))
		args = append(args, value)
	}
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.id, a.title, a.body, a.audience, a.urgent, a.created_at, u.full_name
		
		FROM announcements a
		JOIN users u ON u.id = a.author_id
		 WHERE a.audience IN (` + strings.Join(placeholders, ", ") + `)
		ORDER BY a.created_at DESC
	`)).WithArgs(args...).WillReturnRows(sqlmock.NewRows([]string{"id", "title", "body", "audience", "urgent", "created_at", "full_name"}).AddRow(announcementID, title, body, audience, urgent, createdAt, authorName))
}

func expectAnnouncementEmptyCount(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) 
		FROM announcements a
		JOIN users u ON u.id = a.author_id
	 WHERE 1 = 0`)).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
}

func expectAnnouncementEmptyListQuery(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT a.id, a.title, a.body, a.audience, a.urgent, a.created_at, u.full_name
		
		FROM announcements a
		JOIN users u ON u.id = a.author_id
		 WHERE 1 = 0
		ORDER BY a.created_at DESC
	`)).WillReturnRows(sqlmock.NewRows([]string{"id", "title", "body", "audience", "urgent", "created_at", "full_name"}))
}

func expectAnnouncementCreate(mock sqlmock.Sqlmock, authorID string, title string, body string, audience string, urgent bool, announcementID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO announcements (author_id, title, body, audience, urgent)
		VALUES ($1::uuid, $2, $3, $4, $5)
		RETURNING id
	`)).WithArgs(authorID, title, body, audience, urgent).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(announcementID))
}

func expectAnnouncementRead(mock sqlmock.Sqlmock, announcementID string, userID string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO announcement_reads (announcement_id, user_id)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT (announcement_id, user_id) DO UPDATE SET read_at = NOW()
	`)).WithArgs(announcementID, userID).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectLocationScope(mock sqlmock.Sqlmock, locationID string, locationEntityID string, userID string, allowed bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT entity_id::text FROM locations WHERE id = $1::uuid`)).
		WithArgs(locationID).
		WillReturnRows(sqlmock.NewRows([]string{"entity_id"}).AddRow(locationEntityID))
	if locationEntityID != "entity-1" {
		expectEntityAccessCheck(mock, userID, locationEntityID, allowed)
	}
}

func expectStockSummaryQuery(mock sqlmock.Sqlmock, entityID string, userID string, total int, available int, allocated int, retired int, returned int, inventory int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE s.status IN ('inventory', 'returned')),
			COUNT(*) FILTER (WHERE s.status = 'allocated'),
			COUNT(*) FILTER (WHERE s.status = 'retired'),
			COUNT(*) FILTER (WHERE s.status = 'returned'),
			COUNT(*) FILTER (WHERE s.status = 'inventory')
		FROM stock_items s
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE 1 = 1 AND (COALESCE(branch.entity_id, assignee.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(branch.entity_id, assignee.entity_id)))`)).
		WithArgs(entityID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"count", "available", "allocated", "retired", "returned", "inventory"}).AddRow(total, available, allocated, retired, returned, inventory))
}

func expectStockGroupQuery(mock sqlmock.Sqlmock, entityID string, userID string, category string, name string, total int, available int, allocated int, retired int, returned int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			s.category,
			s.name,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE s.status IN ('inventory', 'returned')) AS available,
			COUNT(*) FILTER (WHERE s.status = 'allocated') AS allocated,
			COUNT(*) FILTER (WHERE s.status = 'retired') AS retired,
			COUNT(*) FILTER (WHERE s.status = 'returned') AS returned
		FROM stock_items s
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE 1 = 1 AND (COALESCE(branch.entity_id, assignee.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(branch.entity_id, assignee.entity_id)))
		GROUP BY s.category, s.name
		ORDER BY COUNT(*) FILTER (WHERE s.status IN ('inventory', 'returned')) ASC, s.name ASC
	`)).WithArgs(entityID, userID).WillReturnRows(sqlmock.NewRows([]string{"category", "name", "total", "available", "allocated", "retired", "returned"}).AddRow(category, name, total, available, allocated, retired, returned))
}

func expectStockListQuery(mock sqlmock.Sqlmock, entityID string, userID string, stockItemID string, itemCode string, category string, name string, serialNumber string, specs string, branchID string, assignedUserID string, warranty string, cost string, status string, createdAt time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT s.id, s.item_code, s.category, s.name, COALESCE(s.serial_number, ''), COALESCE(s.specs, ''), COALESCE(s.branch_id::text, ''),
			COALESCE(s.assigned_user_id::text, ''), COALESCE(s.warranty_expires_at::text, ''), COALESCE(s.cost::text, ''), s.status, s.created_at
		FROM stock_items s
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE 1 = 1 AND (COALESCE(branch.entity_id, assignee.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(branch.entity_id, assignee.entity_id)))
		ORDER BY s.created_at DESC`)).WithArgs(entityID, userID).WillReturnRows(sqlmock.NewRows([]string{"id", "item_code", "category", "name", "serial_number", "specs", "branch_id", "assigned_user_id", "warranty_expires_at", "cost", "status", "created_at"}).AddRow(stockItemID, itemCode, category, name, serialNumber, specs, branchID, assignedUserID, warranty, cost, status, createdAt))
}

func expectStockCreate(mock sqlmock.Sqlmock, category string, name string, serialNumber string, specs string, branchID string, warrantyExpiresAt string, cost string, stockItemID string, itemCode string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO stock_items (category, name, serial_number, specs, branch_id, warranty_expires_at, cost, status)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, '')::uuid, NULLIF($6, '')::date, NULLIF($7, '')::numeric(12,2), 'inventory')
		RETURNING id, item_code
	`)).WithArgs(category, name, serialNumber, specs, branchID, warrantyExpiresAt, cost).WillReturnRows(sqlmock.NewRows([]string{"id", "item_code"}).AddRow(stockItemID, itemCode))
}

func expectStockUpdate(mock sqlmock.Sqlmock, stockItemID string, category string, name string, serialNumber string, specs string, branchID string, warrantyExpiresAt string, cost string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE stock_items
		SET category = $2,
			name = $3,
			serial_number = NULLIF($4, ''),
			specs = NULLIF($5, ''),
			branch_id = NULLIF($6, '')::uuid,
			warranty_expires_at = NULLIF($7, '')::date,
			cost = NULLIF($8, '')::numeric(12,2),
			updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(stockItemID, category, name, serialNumber, specs, branchID, warrantyExpiresAt, cost).WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func expectStockStatusLookup(mock sqlmock.Sqlmock, stockItemID string, status string) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM stock_items WHERE id = $1::uuid`)).
		WithArgs(stockItemID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(status))
}

func expectStockDelete(mock sqlmock.Sqlmock, stockItemID string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM stock_items WHERE id = $1::uuid`)).
		WithArgs(stockItemID).
		WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func expectInventorySummaryQuery(mock sqlmock.Sqlmock, entityID string, userID string, total int, available int, allocated int, retired int, returned int, inventory int) {
	expectStockSummaryQuery(mock, entityID, userID, total, available, allocated, retired, returned, inventory)
}

func expectInventoryGroupQuery(mock sqlmock.Sqlmock, entityID string, userID string, category string, name string, total int, available int, allocated int, retired int, returned int) {
	expectStockGroupQuery(mock, entityID, userID, category, name, total, available, allocated, retired, returned)
}

func expectInventoryListQuery(mock sqlmock.Sqlmock, entityID string, userID string, stockItemID string, itemCode string, category string, name string, serialNumber string, specs string, branchID string, assignedUserID string, warranty string, cost string, status string, createdAt time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT s.id, s.item_code, s.category, s.name, COALESCE(s.asset_tag, ''), COALESCE(s.serial_number, ''), COALESCE(s.specs, ''), COALESCE(s.branch_id::text, ''),
			COALESCE(branch.full_name, ''), COALESCE(s.assigned_user_id::text, ''), COALESCE(s.warranty_expires_at::text, ''), COALESCE(s.cost::text, ''), s.status, s.created_at
		FROM stock_items s
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE 1 = 1 AND (COALESCE(branch.entity_id, assignee.entity_id) = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = COALESCE(branch.entity_id, assignee.entity_id)))
		ORDER BY s.created_at DESC`)).WithArgs(entityID, userID).WillReturnRows(sqlmock.NewRows([]string{"id", "item_code", "category", "name", "asset_tag", "serial_number", "specs", "branch_id", "branch_name", "assigned_user_id", "warranty_expires_at", "cost", "status", "created_at"}).AddRow(stockItemID, itemCode, category, name, "", serialNumber, specs, branchID, "", assignedUserID, warranty, cost, status, createdAt))
}

func expectInventoryCreate(mock sqlmock.Sqlmock, category string, name string, assetTag string, serialNumber string, specs string, branchID string, warrantyExpiresAt string, cost string, status string, stockItemID string, itemCode string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO stock_items (category, name, asset_tag, serial_number, specs, branch_id, warranty_expires_at, cost, status)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, '')::uuid, NULLIF($7, '')::date, NULLIF($8, '')::numeric(12,2), COALESCE(NULLIF($9, ''), 'inventory'))
		RETURNING id, item_code
	`)).WithArgs(category, name, assetTag, serialNumber, specs, branchID, warrantyExpiresAt, cost, status).WillReturnRows(sqlmock.NewRows([]string{"id", "item_code"}).AddRow(stockItemID, itemCode))
}

func expectInventoryScopeDelegated(mock sqlmock.Sqlmock, stockItemID string, delegatedEntityID string, userID string, allowed bool) {
	expectStockItemScopeLookup(mock, stockItemID, delegatedEntityID, nil)
	expectEntityAccessCheck(mock, userID, delegatedEntityID, allowed)
}

func expectInventoryUpdate(mock sqlmock.Sqlmock, stockItemID string, category string, name string, assetTag string, serialNumber string, specs string, branchID string, warrantyExpiresAt string, cost string, status string, rowsAffected int64) {
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE stock_items
		SET category = $2,
			name = $3,
			asset_tag = $4,
			serial_number = NULLIF($5, ''),
			specs = NULLIF($6, ''),
			branch_id = NULLIF($7, '')::uuid,
			warranty_expires_at = NULLIF($8, '')::date,
			cost = NULLIF($9, '')::numeric(12,2),
			status = COALESCE(NULLIF($10, ''), status),
			updated_at = NOW()
		WHERE id = $1::uuid
	`)).WithArgs(stockItemID, category, name, assetTag, serialNumber, specs, branchID, warrantyExpiresAt, cost, status).WillReturnResult(sqlmock.NewResult(1, rowsAffected))
}

func requestArgs(args ...any) []driver.Value {
	values := make([]driver.Value, 0, len(args))
	for _, arg := range args {
		values = append(values, arg)
	}
	return values
}

func expectRequestLoad(mock sqlmock.Sqlmock, clause string, args []any, requestID string, requestType string, title string, description string, status string, notes string, createdAt time.Time, updatedAt time.Time, requesterID string, requesterName string, assigneeID string, assigneeName string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT r.id, r.type, r.title, COALESCE(r.description, ''), r.status, COALESCE(r.notes, ''), r.created_at, r.updated_at,
			requester.id, requester.full_name, COALESCE(assignee.id::text, ''), COALESCE(assignee.full_name, '')
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		LEFT JOIN users assignee ON assignee.id = r.assignee_id
	`+clause+` ORDER BY r.updated_at DESC, r.created_at DESC`)).WithArgs(requestArgs(args...)...).WillReturnRows(sqlmock.NewRows([]string{"id", "type", "title", "description", "status", "notes", "created_at", "updated_at", "requester_id", "requester_name", "assignee_id", "assignee_name"}).AddRow(requestID, requestType, title, description, status, notes, createdAt, updatedAt, requesterID, requesterName, assigneeID, assigneeName))
}

func expectRequestLoadPaged(mock sqlmock.Sqlmock, clause string, args []any, requestID string, requestType string, title string, description string, status string, notes string, createdAt time.Time, updatedAt time.Time, requesterID string, requesterName string, assigneeID string, assigneeName string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT r.id, r.type, r.title, COALESCE(r.description, ''), r.status, COALESCE(r.notes, ''), r.created_at, r.updated_at,
			requester.id, requester.full_name, COALESCE(assignee.id::text, ''), COALESCE(assignee.full_name, '')
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		LEFT JOIN users assignee ON assignee.id = r.assignee_id
	`+clause+` ORDER BY r.updated_at DESC, r.created_at DESC LIMIT $3 OFFSET $4`)).WithArgs(requestArgs(args...)...).WillReturnRows(sqlmock.NewRows([]string{"id", "type", "title", "description", "status", "notes", "created_at", "updated_at", "requester_id", "requester_name", "assignee_id", "assignee_name"}).AddRow(requestID, requestType, title, description, status, notes, createdAt, updatedAt, requesterID, requesterName, assigneeID, assigneeName))
}

func expectRequestLoadEmpty(mock sqlmock.Sqlmock, clause string, args []any) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT r.id, r.type, r.title, COALESCE(r.description, ''), r.status, COALESCE(r.notes, ''), r.created_at, r.updated_at,
			requester.id, requester.full_name, COALESCE(assignee.id::text, ''), COALESCE(assignee.full_name, '')
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		LEFT JOIN users assignee ON assignee.id = r.assignee_id
	`+clause+` ORDER BY r.updated_at DESC, r.created_at DESC`)).WithArgs(requestArgs(args...)...).WillReturnRows(sqlmock.NewRows([]string{"id", "type", "title", "description", "status", "notes", "created_at", "updated_at", "requester_id", "requester_name", "assignee_id", "assignee_name"}))
}

func expectRequestCommentsLookup(mock sqlmock.Sqlmock, requestID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT c.id, u.full_name, c.note, c.created_at
			FROM request_comments c
			JOIN users u ON u.id = c.author_id
			WHERE c.request_id = $1::uuid
			ORDER BY c.created_at ASC
		`)).WithArgs(requestID).WillReturnRows(sqlmock.NewRows([]string{"id", "full_name", "note", "created_at"}))
}

func expectRequestCreate(mock sqlmock.Sqlmock, requesterID string, assigneeID string, requestType string, title string, description string, requestID string) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO requests (requester_id, assignee_id, type, title, description, status)
		VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, ''), 'pending')
		RETURNING id
	`)).WithArgs(requesterID, assigneeID, requestType, title, description).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(requestID))
}

func expectRequestCommentOwnership(mock sqlmock.Sqlmock, requestID string, userID string, exists bool) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT EXISTS(SELECT 1 FROM requests WHERE id = $1::uuid AND requester_id = $2::uuid)`)).WithArgs(requestID, userID).WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(exists))
}

func expectRequestCommentInsert(mock sqlmock.Sqlmock, requestID string, userID string, note string) {
	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO request_comments (request_id, author_id, note)
		VALUES ($1::uuid, $2::uuid, $3)
	`)).WithArgs(requestID, userID, note).WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectRequestListSummaryQuery(mock sqlmock.Sqlmock, entityID string, userID string, total int, pendingCount int, inProgressCount int, resolvedCount int, enrollmentCount int, pendingEnrollmentCount int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE r.status = 'pending'),
			COUNT(*) FILTER (WHERE r.status = 'in_progress'),
			COUNT(*) FILTER (WHERE r.status = 'resolved'),
			COUNT(*) FILTER (WHERE r.type = 'device_enrollment'),
			COUNT(*) FILTER (WHERE r.type = 'device_enrollment' AND r.status = 'pending')
		
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		LEFT JOIN users assignee ON assignee.id = r.assignee_id
		
		WHERE 1 = 1 AND (requester.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = requester.entity_id)) AND r.status <> 'rejected'`)).
		WithArgs(entityID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"count", "pending", "in_progress", "resolved", "enrollment", "pending_enrollment"}).AddRow(total, pendingCount, inProgressCount, resolvedCount, enrollmentCount, pendingEnrollmentCount))
}

func expectRequestListSummaryWithClause(mock sqlmock.Sqlmock, clause string, args []any, total int, pendingCount int, inProgressCount int, resolvedCount int, enrollmentCount int, pendingEnrollmentCount int) {
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE r.status = 'pending'),
			COUNT(*) FILTER (WHERE r.status = 'in_progress'),
			COUNT(*) FILTER (WHERE r.status = 'resolved'),
			COUNT(*) FILTER (WHERE r.type = 'device_enrollment'),
			COUNT(*) FILTER (WHERE r.type = 'device_enrollment' AND r.status = 'pending')
		
		FROM requests r
		JOIN users requester ON requester.id = r.requester_id
		LEFT JOIN users assignee ON assignee.id = r.assignee_id
		WHERE `+clause)).WithArgs(requestArgs(args...)...).WillReturnRows(sqlmock.NewRows([]string{"count", "pending", "in_progress", "resolved", "enrollment", "pending_enrollment"}).AddRow(total, pendingCount, inProgressCount, resolvedCount, enrollmentCount, pendingEnrollmentCount))
}

func expectRequestCommentBatchLookup(mock sqlmock.Sqlmock, requestID string, commentID string, author string, note string, createdAt time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`
			SELECT c.request_id::text, c.id, u.full_name, c.note, c.created_at
			FROM request_comments c
			JOIN users u ON u.id = c.author_id
			WHERE c.request_id IN ($1::uuid)
			ORDER BY c.request_id ASC, c.created_at ASC
		`)).WithArgs(requestID).WillReturnRows(sqlmock.NewRows([]string{"request_id", "id", "full_name", "note", "created_at"}).AddRow(requestID, commentID, author, note, createdAt))
}

func assertRouteResult(t *testing.T, mock sqlmock.Sqlmock, recorder *httptest.ResponseRecorder, wantStatus int, label string) {
	t.Helper()
	if recorder.Code != wantStatus {
		t.Fatalf("%s status = %d, want %d, body = %s", label, recorder.Code, wantStatus, strings.TrimSpace(recorder.Body.String()))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestExtractWebSocketBearerTokenReadsBearerSubprotocol(t *testing.T) {
	token := "test-token-123"
	encoded := base64.RawURLEncoding.EncodeToString([]byte(token))
	request := httptest.NewRequest(http.MethodGet, "/ws/ssh/assets/asset-1", nil)
	request.Header.Add("Sec-WebSocket-Protocol", "itms.ssh.v1, bearer."+encoded)

	got := extractWebSocketBearerToken(request)
	if got != token {
		t.Fatalf("extractWebSocketBearerToken() = %q, want %q", got, token)
	}
}

func TestExtractWebSocketBearerTokenIgnoresQueryTokenFallback(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/ws/ssh/assets/asset-1?token=query-token", nil)

	got := extractWebSocketBearerToken(request)
	if got != "" {
		t.Fatalf("extractWebSocketBearerToken() = %q, want empty string", got)
	}
}