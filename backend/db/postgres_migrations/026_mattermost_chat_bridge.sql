CREATE TABLE IF NOT EXISTS chat_channel_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  external_team_id TEXT,
  external_channel_id TEXT NOT NULL,
  external_channel_name TEXT,
  sync_direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_channel_external_links_channel_provider_idx
  ON chat_channel_external_links (chat_channel_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS chat_channel_external_links_provider_external_channel_idx
  ON chat_channel_external_links (provider, external_channel_id);

CREATE TABLE IF NOT EXISTS chat_message_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  external_post_id TEXT NOT NULL,
  external_channel_id TEXT NOT NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_message_external_links_message_provider_idx
  ON chat_message_external_links (chat_message_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS chat_message_external_links_provider_external_post_idx
  ON chat_message_external_links (provider, external_post_id);