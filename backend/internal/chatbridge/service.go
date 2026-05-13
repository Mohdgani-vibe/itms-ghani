package chatbridge

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"itms/backend/internal/app"
	"itms/backend/pkg/mattermost"
)

const providerMattermost = "mattermost"

type Service struct {
	db     *sql.DB
	client *mattermost.Client
	config app.Config
}

func NewService(db *sql.DB, client *mattermost.Client, config app.Config) *Service {
	return &Service{db: db, client: client, config: config}
}

func (service *Service) Enabled() bool {
	return service != nil && service.db != nil && service.config.MattermostEnabled && service.client != nil && service.client.Enabled()
}

func (service *Service) MirrorITMSMessage(ctx context.Context, input OutboundMessageInput) error {
	if !service.Enabled() || !service.allowsChannelKind(input.ChannelKind) {
		return nil
	}
	if strings.TrimSpace(input.ChatMessageID) == "" {
		return fmt.Errorf("chat message id is required")
	}
	if strings.TrimSpace(input.Body) == "" {
		return nil
	}
	exists, err := service.hasMessageLink(ctx, providerMattermost, input.ChatMessageID)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	channelLink, err := service.EnsureChannelLink(ctx, EnsureChannelLinkInput{
		ChatChannelID: input.ChatChannelID,
		ChannelName:   input.ChannelName,
		ChannelKind:   input.ChannelKind,
	})
	if err != nil {
		return err
	}
	post, err := service.client.CreatePost(ctx, mattermost.CreatePostInput{
		ChannelID: channelLink.ExternalChannelID,
		Message:   formatMattermostPost(input.AuthorName, input.Body),
	})
	if err != nil {
		return fmt.Errorf("create mattermost post: %w", err)
	}
	return service.upsertMessageLink(ctx, MessageLink{
		ChatMessageID:     input.ChatMessageID,
		Provider:          providerMattermost,
		ExternalPostID:    post.ID,
		ExternalChannelID: channelLink.ExternalChannelID,
		Direction:         "outbound",
	})
}

func (service *Service) EnsureChannelLink(ctx context.Context, input EnsureChannelLinkInput) (ChannelLink, error) {
	if !service.Enabled() || !service.allowsChannelKind(input.ChannelKind) {
		return ChannelLink{}, nil
	}
	if strings.TrimSpace(input.ChatChannelID) == "" {
		return ChannelLink{}, fmt.Errorf("chat channel id is required")
	}
	existing, found, err := service.findChannelLink(ctx, providerMattermost, input.ChatChannelID)
	if err != nil {
		return ChannelLink{}, err
	}
	if found {
		return existing, nil
	}
	team, err := service.client.ResolveTeam(ctx, service.config.MattermostTeam)
	if err != nil {
		return ChannelLink{}, fmt.Errorf("resolve mattermost team: %w", err)
	}
	externalChannelName := buildMattermostChannelName(input.ChannelKind, input.ChannelName, input.ChatChannelID)
	channel, err := service.client.GetChannelByName(ctx, team.ID, externalChannelName)
	if err != nil {
		if err != mattermost.ErrNotFound {
			return ChannelLink{}, fmt.Errorf("resolve mattermost channel: %w", err)
		}
		if !service.config.MattermostCreateChannels {
			return ChannelLink{}, fmt.Errorf("mattermost channel %q is not mapped and MATTERMOST_CREATE_CHANNELS is false", externalChannelName)
		}
		channel, err = service.client.CreateChannel(ctx, mattermost.CreateChannelInput{
			TeamID:      team.ID,
			Name:        externalChannelName,
			DisplayName: strings.TrimSpace(input.ChannelName),
			Type:        "O",
			Purpose:     fmt.Sprintf("Mirrored ITMS %s channel", strings.TrimSpace(input.ChannelKind)),
		})
		if err != nil {
			return ChannelLink{}, fmt.Errorf("create mattermost channel: %w", err)
		}
	}
	link := ChannelLink{
		ChatChannelID:       input.ChatChannelID,
		Provider:            providerMattermost,
		ExternalTeamID:      team.ID,
		ExternalChannelID:   channel.ID,
		ExternalChannelName: channel.Name,
		SyncDirection:       service.syncDirection(),
	}
	if err := service.upsertChannelLink(ctx, link); err != nil {
		return ChannelLink{}, err
	}
	return link, nil
}

func (service *Service) allowsChannelKind(kind string) bool {
	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind == "" {
		return false
	}
	allowedKinds := strings.Split(service.config.MattermostAllowedChannelKinds, ",")
	for _, allowed := range allowedKinds {
		if strings.ToLower(strings.TrimSpace(allowed)) == kind {
			return true
		}
	}
	return false
}

func (service *Service) syncDirection() string {
	direction := strings.ToLower(strings.TrimSpace(service.config.MattermostSyncDirection))
	if direction == "" {
		return "outbound"
	}
	return direction
}