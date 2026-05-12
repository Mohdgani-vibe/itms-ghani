package api

import (
	"net/http"
	"testing"
)

func TestRouterDeleteChatChannelRejectsNonCreatorITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1", "")
	defer cleanup()

	expectChatChannelCreatorLookup(mock, "channel-1", "creator-2")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "delete chat channel non-creator")
}

func TestRouterDeleteChatChannelAllowsCreatorITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1", "")
	defer cleanup()

	expectChatChannelCreatorLookup(mock, "channel-1", "user-1")
	expectChatChannelDelete(mock, "channel-1")
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_deleted", "chat_channel", "channel-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "delete chat channel creator")
}

func TestRouterCloseChatChannelRejectsNonMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/close", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "close chat channel non-member")
}

func TestRouterCloseChatChannelAllowsMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/close", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	mock.ExpectBegin()
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectChatCloseLookup(mock, "channel-1", "request-1", "Support - Employee One", "owner-1", "employee-1")
	expectChatLinkedTicketLookup(mock, "request-1", "TKT-000001")
	expectChatCloseUpdate(mock, "channel-1", "user-1")
	expectRequestCommentInsert(mock, "request-1", "user-1", "Chat closed by it_team. Follow-up continues under ticket TKT-000001.")
	mock.ExpectCommit()
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_closed", "chat_channel", "channel-1", `{"ticketId":"request-1","ticketNumber":"TKT-000001"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "close chat channel member")
}

func TestRouterCloseChatChannelCreatesTicketWhenMissingLink(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/close", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	mock.ExpectBegin()
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectChatCloseLookup(mock, "channel-1", "", "Support - Employee One", "owner-1", "employee-1")
	expectNextSupportTicketNumber(mock, "TKT-000002")
	expectChatTicketCreate(mock, "employee-1", "owner-1", "Chat Ticket: Support - Employee One", "in_progress", "TKT-000002", "channel-1", "request-2")
	expectChatLinkedRequestUpdate(mock, "channel-1", "request-2")
	expectChatCloseUpdate(mock, "channel-1", "user-1")
	expectRequestCommentInsert(mock, "request-2", "user-1", "Chat closed by it_team. Follow-up continues under ticket TKT-000002.")
	mock.ExpectCommit()
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_closed", "chat_channel", "channel-1", `{"ticketId":"request-2","ticketNumber":"TKT-000002"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "close chat channel creates linked ticket")
}

func TestRouterReopenChatChannelRejectsNonMember(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/reopen", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "employee-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "reopen chat channel non-member")
}

func TestRouterReopenChatChannelAllowsMember(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/reopen", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "employee-1", true)
	expectChatReopenStatusLookup(mock, "channel-1", "closed", "request-1")
	mock.ExpectBegin()
	expectChatReopenUpdate(mock, "channel-1")
	expectRequestAssigneeLookup(mock, "request-1", "owner-1")
	expectRequestStatusOnlyUpdate(mock, "request-1", "in_progress")
	expectRequestCommentInsert(mock, "request-1", "employee-1", "Chat reopened by employee.")
	mock.ExpectCommit()
	expectAuditInsert(mock, "employee-1", "entity-1", "chat_channel_reopened", "chat_channel", "channel-1", `null`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "reopen chat channel member")
}

func TestRouterAddChatChannelMembersRejectsNonMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/chat/channels/channel-1/members", `{"memberIds":["member-2"]}`)
	defer cleanup()

	expectChatChannelExists(mock, "channel-1", true)
	expectChatMembershipCheck(mock, "channel-1", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "add chat members non-member")
}

func TestRouterAddChatChannelMembersAllowsMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/chat/channels/channel-1/members", `{"memberIds":["member-2"]}`)
	defer cleanup()

	expectChatChannelExists(mock, "channel-1", true)
	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["member-2"]}`)
	expectActiveWorkflowUserLookup(mock, "member-2", "it_team", true)
	expectChatMemberInsert(mock, "channel-1", "member-2", 1)
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_members_added", "chat_channel", "channel-1", `{"added":1,"memberIds":["member-2"]}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "add chat members member")
}

func TestRouterAddChatChannelMembersRejectsClosedChannel(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/chat/channels/channel-1/members", `{"memberIds":["member-2"]}`)
	defer cleanup()

	expectChatChannelExists(mock, "channel-1", true)
	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "closed")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "add chat members closed channel")
}

func TestRouterAddChatChannelMembersRejectsEmptySelection(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPost, "/api/chat/channels/channel-1/members", `{"memberIds":["", " "]}`)
	defer cleanup()

	expectChatChannelExists(mock, "channel-1", true)
	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "open")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "add chat members empty selection")
}

func TestRouterRemoveChatChannelMemberRejectsNonMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1/members/member-2", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "remove chat member non-member")
}

func TestRouterRemoveChatChannelMemberAllowsPrivilegedRemoval(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1/members/member-2", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "it_team")
	expectChatPrivilegedCount(mock, "channel-1", 2)
	expectChatOwnerClear(mock, "primary_owner_id", "channel-1", "member-2")
	expectChatOwnerClear(mock, "backup_owner_id", "channel-1", "member-2")
	expectChatMemberDelete(mock, "channel-1", "member-2", 1)
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_member_removed", "chat_channel", "channel-1", `{"userId":"member-2"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "remove chat member success")
}

func TestRouterRemoveChatChannelMemberRejectsNonITTarget(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1/members/member-2", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "employee")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "remove chat member non-it target")
}

func TestRouterRemoveChatChannelMemberRejectsLastPrivilegedOwner(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodDelete, "/api/chat/channels/channel-1/members/member-2", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "it_team")
	expectChatPrivilegedCount(mock, "channel-1", 1)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "remove chat member last privileged owner")
}

func TestRouterUpdateChatChannelOwnerRejectsNonMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":"member-2"}`)
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "update chat owner non-member")
}

func TestRouterUpdateChatChannelOwnerRejectsMissingOwnerFields(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update chat owner missing fields")
}

func TestRouterUpdateChatChannelOwnerRejectsBlankPrimaryOwner(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":" "}`)
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update chat owner blank primary")
}

func TestRouterUpdateChatChannelOwnerAllowsMemberITUser(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":"member-2"}`)
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["member-2"]}`)
	expectActiveWorkflowUserLookup(mock, "member-2", "it_team", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "it_team")
	expectChatOwnerUpdate(mock, "channel-1", "member-2", 1)
	expectAuditInsert(mock, "user-1", "entity-1", "chat_channel_owner_updated", "chat_channel", "channel-1", `{"ownerId":"member-2"}`)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "update chat owner member")
}

func TestRouterUpdateChatChannelOwnerRejectsClosedChannel(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":"member-2"}`)
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "closed")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update chat owner closed channel")
}

func TestRouterUpdateChatChannelOwnerRejectsNonMemberOwner(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":"member-2"}`)
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["member-2"]}`)
	expectActiveWorkflowUserLookup(mock, "member-2", "it_team", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "employee")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update chat owner non-owner target")
}

func TestRouterUpdateChatChannelOwnerRejectsDuplicatePrimaryAndBackup(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodPut, "/api/chat/channels/channel-1/owner", `{"ownerId":"member-2","backupOwnerId":"member-2"}`)
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "user-1", true)
	expectChatChannelStatusLookup(mock, "channel-1", "open")
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["member-2"]}`)
	expectActiveWorkflowUserLookup(mock, "member-2", "it_team", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "it_team")
	expectWorkflowSettingsLookup(mock, `{"chatMemberIds":["member-2"]}`)
	expectActiveWorkflowUserLookup(mock, "member-2", "it_team", true)
	expectChatMemberRoleLookup(mock, "channel-1", "member-2", "it_team")

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusBadRequest, "update chat owner duplicate primary backup")
}

func TestRouterListChatTicketSummaryRejectsITTeamRole(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "it_team", "user-1", "entity-1", http.MethodGet, "/api/chat/tickets/summary", "")
	defer cleanup()

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list chat ticket summary role boundary")
}

func TestRouterListChatTicketSummaryAllowsSuperAdmin(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "super_admin", "admin-1", "entity-1", http.MethodGet, "/api/chat/tickets/summary", "")
	defer cleanup()

	expectChatTicketSummaryQuery(mock)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusOK, "list chat ticket summary super admin")
}

func TestRouterListChatMessagesRejectsNonMember(t *testing.T) {
	mock, recorder, router, request, cleanup := newRoleRouteRequest(t, "employee", "employee-1", "entity-1", http.MethodGet, "/api/chat/channels/channel-1/messages", "")
	defer cleanup()

	expectChatMembershipCheck(mock, "channel-1", "employee-1", false)

	router.ServeHTTP(recorder, request)
	assertRouteResult(t, mock, recorder, http.StatusForbidden, "list chat messages non-member")
}
