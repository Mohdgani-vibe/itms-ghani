package chatbridge

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func (service *Service) hasMessageLink(ctx context.Context, provider string, chatMessageID string) (bool, error) {
	var exists bool
	err := service.db.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM chat_message_external_links
			WHERE chat_message_id = $1::uuid AND provider = $2
		)
	`, chatMessageID, provider).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check chat message external link: %w", err)
	}
	return exists, nil
}

func (service *Service) upsertMessageLink(ctx context.Context, link MessageLink) error {
	_, err := service.db.ExecContext(ctx, `
		INSERT INTO chat_message_external_links (chat_message_id, provider, external_post_id, external_channel_id, direction)
		VALUES ($1::uuid, $2, $3, $4, $5)
		ON CONFLICT (chat_message_id, provider)
		DO UPDATE SET
			external_post_id = EXCLUDED.external_post_id,
			external_channel_id = EXCLUDED.external_channel_id,
			direction = EXCLUDED.direction
	`, link.ChatMessageID, link.Provider, link.ExternalPostID, link.ExternalChannelID, link.Direction)
	if err != nil {
		return fmt.Errorf("upsert chat message external link: %w", err)
	}
	return nil
}

func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}