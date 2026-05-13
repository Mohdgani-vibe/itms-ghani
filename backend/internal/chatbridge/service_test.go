package chatbridge

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"itms/backend/internal/app"
	"itms/backend/pkg/mattermost"
)

func newServiceTestHarness(t *testing.T, config app.Config) (*Service, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	client := mattermost.NewClient("https://mattermost.example.com", "test-token")
	service := NewService(db, client, config)
	return service, mock, func() { _ = db.Close() }
}

func TestMirrorITMSMessageNoOpWhenDisabled(t *testing.T) {
	service, mock, cleanup := newServiceTestHarness(t, app.Config{})
	defer cleanup()

	err := service.MirrorITMSMessage(context.Background(), OutboundMessageInput{
		ChatChannelID: "channel-1",
		ChannelKind:   "operations",
		ChatMessageID: "message-1",
		Body:          "Need help with VPN",
	})
	if err != nil {
		t.Fatalf("MirrorITMSMessage: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestMirrorITMSMessageNoOpForBlankBody(t *testing.T) {
	service, mock, cleanup := newServiceTestHarness(t, app.Config{
		MattermostEnabled:             true,
		MattermostAllowedChannelKinds: "operations",
	})
	defer cleanup()

	err := service.MirrorITMSMessage(context.Background(), OutboundMessageInput{
		ChatChannelID: "channel-1",
		ChannelKind:   "operations",
		ChatMessageID: "message-1",
		Body:          "   ",
	})
	if err != nil {
		t.Fatalf("MirrorITMSMessage: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestEnsureChannelLinkReturnsExistingLinkWithoutRemoteCalls(t *testing.T) {
	service, mock, cleanup := newServiceTestHarness(t, app.Config{
		MattermostEnabled:             true,
		MattermostAllowedChannelKinds: "operations",
		MattermostTeam:                "itms",
	})
	defer cleanup()

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT chat_channel_id, provider, COALESCE(external_team_id, ''), external_channel_id, COALESCE(external_channel_name, ''), sync_direction
		FROM chat_channel_external_links
		WHERE chat_channel_id = $1::uuid AND provider = $2
	`)).
		WithArgs("channel-1", providerMattermost).
		WillReturnRows(sqlmock.NewRows([]string{"chat_channel_id", "provider", "external_team_id", "external_channel_id", "external_channel_name", "sync_direction"}).
			AddRow("channel-1", providerMattermost, "team-1", "channel-ext-1", "itms-operations", "outbound"))

	link, err := service.EnsureChannelLink(context.Background(), EnsureChannelLinkInput{
		ChatChannelID: "channel-1",
		ChannelName:   "IT Operations",
		ChannelKind:   "operations",
	})
	if err != nil {
		t.Fatalf("EnsureChannelLink: %v", err)
	}
	if link.ExternalChannelID != "channel-ext-1" {
		t.Fatalf("ExternalChannelID = %q, want %q", link.ExternalChannelID, "channel-ext-1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestAllowsChannelKind(t *testing.T) {
	service := &Service{config: app.Config{MattermostAllowedChannelKinds: "operations, support"}}

	if !service.allowsChannelKind("operations") {
		t.Fatal("operations should be allowed")
	}
	if !service.allowsChannelKind(" support ") {
		t.Fatal("support should be allowed")
	}
	if service.allowsChannelKind("employee") {
		t.Fatal("employee should not be allowed")
	}
}