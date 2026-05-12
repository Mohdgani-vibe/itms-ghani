# Mattermost Implementation Plan

## Goal

Implement a low-risk Mattermost bridge for ITMS chat with this scope:

- ITMS remains the source of truth for chat channels, ownership, close/reopen state, and request linkage
- Mattermost receives mirrored messages for selected ITMS channels
- initial delivery target is `operations` channels only
- first milestone is outbound sync only

This plan is intentionally incremental so it does not disrupt the existing chat UI or lifecycle logic.

## Scope For Milestone 1

Milestone 1 includes:

- backend config for Mattermost
- backend Mattermost REST client
- bridge mapping tables
- outbound mirroring when new ITMS chat messages are persisted
- optional channel creation for mapped ITMS channels
- audit-safe failure handling that does not block ITMS chat

Milestone 1 excludes:

- inbound Mattermost to ITMS message sync
- member sync
- owner sync
- archive/unarchive propagation
- frontend changes

## Exact Files To Change

### 1. Backend Config

File:

- `backend/internal/app/config.go`

Changes:

- extend `Config` with Mattermost settings
- load env vars in `LoadConfig`
- add security warnings for missing or default Mattermost secrets where appropriate

Suggested fields:

- `MattermostEnabled bool`
- `MattermostBaseURL string`
- `MattermostToken string`
- `MattermostTeam string`
- `MattermostAllowedChannelKinds string`
- `MattermostSyncDirection string`
- `MattermostCreateChannels bool`

Suggested env vars:

- `MATTERMOST_ENABLED`
- `MATTERMOST_BASE_URL`
- `MATTERMOST_TOKEN`
- `MATTERMOST_TEAM`
- `MATTERMOST_ALLOWED_CHANNEL_KINDS`
- `MATTERMOST_SYNC_DIRECTION`
- `MATTERMOST_CREATE_CHANNELS`

### 2. Mattermost Client Package

New directory:

- `backend/pkg/mattermost/`

New files:

- `backend/pkg/mattermost/client.go`
- `backend/pkg/mattermost/types.go`
- `backend/pkg/mattermost/errors.go`

Responsibilities:

- create authenticated HTTP client
- resolve team by name or id
- create or resolve channels
- create posts

Minimum methods for milestone 1:

- `Enabled() bool`
- `ResolveTeam(ctx, team string) (Team, error)`
- `GetChannelByName(ctx, teamID, name string) (Channel, error)`
- `CreateChannel(ctx, input CreateChannelInput) (Channel, error)`
- `CreatePost(ctx, input CreatePostInput) (Post, error)`

### 3. Bridge Service Layer

New directory:

- `backend/internal/chatbridge/`

New files:

- `backend/internal/chatbridge/service.go`
- `backend/internal/chatbridge/types.go`
- `backend/internal/chatbridge/channel_links.go`
- `backend/internal/chatbridge/message_links.go`
- `backend/internal/chatbridge/mapping.go`

Responsibilities:

- decide whether a channel kind is bridgeable
- resolve or create Mattermost channel mapping
- mirror ITMS messages outward
- persist external link rows
- prevent Mattermost failures from breaking ITMS chat delivery

Suggested public API for milestone 1:

- `NewService(db *sql.DB, client *mattermost.Client, config app.Config) *Service`
- `Enabled() bool`
- `MirrorITMSMessage(ctx context.Context, input OutboundMessageInput) error`
- `EnsureChannelLink(ctx context.Context, input EnsureChannelLinkInput) (ChannelLink, error)`

### 4. API Server Wiring

File:

- `backend/internal/api/router.go`

Changes:

- add Mattermost client to `apiServer`
- add bridge service to `apiServer`
- initialize them in `NewRouter`

Suggested `apiServer` additions:

- `mattermost *mattermost.Client`
- `chatBridge *chatbridge.Service`

Wiring behavior:

- create Mattermost client from config
- create bridge service from config, db, and client
- allow disabled/no-op behavior when Mattermost is not configured

### 5. Chat Message Outbound Hook

File:

- `backend/internal/api/modules.go`

Primary hook location:

- the websocket message persistence path in `chatWebsocket`

Current local flow already:

- validates channel
- inserts into `chat_messages`
- publishes websocket envelope to ITMS clients

Changes:

- after successful `chat_messages` insert, call the bridge service in best-effort mode
- do not fail the websocket send or database success if Mattermost sync fails

Implementation note:

- call the bridge after local persistence and before returning to the client is acceptable for milestone 1
- if latency becomes noticeable, move this to a background goroutine or job queue later

Suggested local helper in `modules.go`:

- `server.mirrorChatMessageToMattermost(...)`

### 6. Channel Create Outbound Hook

File:

- `backend/internal/api/modules.go`

Hook locations:

- `createChatChannel`
- `createOperationsChannel`

Changes:

- when channel kind is allowed and Mattermost bridge is enabled, resolve or create the mapped Mattermost channel
- persist mapping in the new link table
- do not fail ITMS channel creation if Mattermost is unavailable

For milestone 1, only apply this automatically to:

- `operations`

Support channels can be deferred until routing and privacy rules are reviewed.

### 7. Database Migrations

New migration file:

- `backend/db/postgres_migrations/026_mattermost_chat_bridge.sql`

Contents should create at least:

- `chat_channel_external_links`
- `chat_message_external_links`

Recommended table shape:

`chat_channel_external_links`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `chat_channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE`
- `provider VARCHAR(40) NOT NULL`
- `external_team_id TEXT`
- `external_channel_id TEXT NOT NULL`
- `external_channel_name TEXT`
- `sync_direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:

- unique `(chat_channel_id, provider)`
- unique `(provider, external_channel_id)`

`chat_message_external_links`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE`
- `provider VARCHAR(40) NOT NULL`
- `external_post_id TEXT NOT NULL`
- `external_channel_id TEXT NOT NULL`
- `direction VARCHAR(20) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:

- unique `(chat_message_id, provider)`
- unique `(provider, external_post_id)`

### 8. Optional Admin Diagnostics Endpoint

File:

- `backend/internal/api/router.go`
- `backend/internal/api/modules.go` or a new focused file if preferred later

Route candidate:

- `GET /api/integrations/mattermost/status`

Milestone 1 does not require it, but it is useful for validating configuration and channel mapping health.

## Implementation Order

### Step 1

Add config support in:

- `backend/internal/app/config.go`

Acceptance check:

- backend still loads with Mattermost disabled
- missing Mattermost env vars do not break startup

### Step 2

Create the migration:

- `backend/db/postgres_migrations/026_mattermost_chat_bridge.sql`

Acceptance check:

- `go build ./...` still passes after migration file is added

### Step 3

Create Mattermost client package:

- `backend/pkg/mattermost/*`

Acceptance check:

- package builds in isolation
- disabled config path is no-op safe

### Step 4

Create bridge service:

- `backend/internal/chatbridge/*`

Acceptance check:

- service can resolve a mapped channel or create one when enabled
- service returns nil-safe behavior when disabled

### Step 5

Wire the service into:

- `backend/internal/api/router.go`

Acceptance check:

- server boots with and without Mattermost config

### Step 6

Hook outbound message mirroring in:

- `backend/internal/api/modules.go`

Acceptance check:

- ITMS chat message insert still succeeds if Mattermost is down
- operations channel messages mirror to Mattermost when mapping exists

### Step 7

Hook channel mapping creation in:

- `backend/internal/api/modules.go`

Acceptance check:

- new operations channel receives a Mattermost mapping row
- if Mattermost channel creation fails, ITMS channel still exists and remains usable

## Tests To Add

### Config Tests

File candidate:

- `backend/internal/app/config_test.go`

Tests:

- loads Mattermost env vars correctly
- disabled config remains safe

### API / Helper Tests

Existing nearby patterns:

- `backend/internal/api/router_auth_helpers_test.go`
- `backend/internal/api/router_auth_portal_notifications_test.go`
- `backend/internal/api/router_auth_chat_management_test.go`

Add tests for:

- outbound mirror called after successful chat insert
- chat insert not rolled back on Mattermost failure
- operations channel creation attempts mapping when enabled
- support channel creation does not map in milestone 1

### Bridge Service Tests

New file candidates:

- `backend/internal/chatbridge/service_test.go`
- `backend/internal/chatbridge/mapping_test.go`

Tests:

- kind filtering
- existing link reuse
- new link creation path
- duplicate post protection using `chat_message_external_links`

### Mattermost Client Tests

New file candidate:

- `backend/pkg/mattermost/client_test.go`

Tests:

- auth headers are attached
- expected channel and post payloads are encoded correctly
- non-2xx responses return actionable errors

## Validation Commands

Use the existing repo commands remembered for this workspace:

- backend build and test: `cd /home/itteam/itms/backend && GOTOOLCHAIN=local go build ./... && GOTOOLCHAIN=local go test ./...`

Frontend is not required for milestone 1, and current frontend build already has unrelated failures.

## Deferred Work After Milestone 1

### Milestone 2

Inbound webhook sync:

- add `POST /api/integrations/mattermost/events`
- verify secret or signature
- resolve mapped channel
- insert mirrored ITMS chat message
- populate `chat_message_external_links`

### Milestone 3

Membership and close/reopen propagation:

- mirror teammate add/remove
- optionally post close and reopen banners to Mattermost
- optionally archive Mattermost channel on close

### Milestone 4

UI and diagnostics:

- Mattermost sync status in settings
- channel deep-link button
- sync failure visibility

## Recommended First Coding Slice

The smallest practical first edit set is:

- `backend/internal/app/config.go`
- `backend/db/postgres_migrations/026_mattermost_chat_bridge.sql`
- `backend/pkg/mattermost/client.go`
- `backend/internal/chatbridge/service.go`
- `backend/internal/api/router.go`
- the outbound chat message section in `backend/internal/api/modules.go`

That gives a real outbound bridge for `operations` messages without forcing a wider platform change.

## Next Action

If implementation should start now, begin with milestone 1 and this exact first commit scope:

- add config
- add migration
- scaffold Mattermost client
- scaffold bridge service
- wire outbound sync for operations messages only