package chatbridge

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

func (service *Service) findChannelLink(ctx context.Context, provider string, chatChannelID string) (ChannelLink, bool, error) {
	var link ChannelLink
	err := service.db.QueryRowContext(ctx, `
		SELECT chat_channel_id, provider, COALESCE(external_team_id, ''), external_channel_id, COALESCE(external_channel_name, ''), sync_direction
		FROM chat_channel_external_links
		WHERE chat_channel_id = $1::uuid AND provider = $2
	`, chatChannelID, provider).Scan(&link.ChatChannelID, &link.Provider, &link.ExternalTeamID, &link.ExternalChannelID, &link.ExternalChannelName, &link.SyncDirection)
	if errors.Is(err, sql.ErrNoRows) {
		return ChannelLink{}, false, nil
	}
	if err != nil {
		return ChannelLink{}, false, fmt.Errorf("load chat channel external link: %w", err)
	}
	return link, true, nil
}

func (service *Service) upsertChannelLink(ctx context.Context, link ChannelLink) error {
	_, err := service.db.ExecContext(ctx, `
		INSERT INTO chat_channel_external_links (chat_channel_id, provider, external_team_id, external_channel_id, external_channel_name, sync_direction)
		VALUES ($1::uuid, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6)
		ON CONFLICT (chat_channel_id, provider)
		DO UPDATE SET
			external_team_id = EXCLUDED.external_team_id,
			external_channel_id = EXCLUDED.external_channel_id,
			external_channel_name = EXCLUDED.external_channel_name,
			sync_direction = EXCLUDED.sync_direction,
			updated_at = NOW()
	`, link.ChatChannelID, link.Provider, strings.TrimSpace(link.ExternalTeamID), link.ExternalChannelID, strings.TrimSpace(link.ExternalChannelName), link.SyncDirection)
	if err != nil {
		return fmt.Errorf("upsert chat channel external link: %w", err)
	}
	return nil
}