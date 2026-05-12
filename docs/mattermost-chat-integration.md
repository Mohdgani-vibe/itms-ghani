# Mattermost Chat Integration

## Recommendation

Integrate Mattermost as a bridge for ITMS chat, not as an immediate replacement.

This codebase already owns chat workflow end-to-end:

- chat storage in `chat_channels`, `chat_members`, and `chat_messages`
- real-time delivery over `/ws/chat`
- employee auto-create and workflow gating
- IT owner and backup owner assignment
- linked request creation on chat close
- reopen semantics and audit tagging

Mattermost can fit well as an operator-facing collaboration surface, but the ITMS workflow metadata should remain authoritative in ITMS during phase one.

## Best First Scope

Use an operations-only or routed-support bridge.

Phase one should:

- keep ITMS as the source of truth for channel membership, ownership, and request linkage
- mirror selected ITMS channels into Mattermost
- mirror Mattermost replies back into ITMS chat
- avoid replacing employee-facing chat UI on day one

This preserves the existing frontend in `frontend/src/pages/Chat.tsx` and avoids rewriting request-chat lifecycle rules in `backend/internal/api/modules.go`.

## Current Integration Anchors

Backend and schema:

- chat websocket registration: `backend/internal/api/router.go`
- chat list, create, membership, owner update, close, reopen, message history, websocket message persistence: `backend/internal/api/modules.go`
- chat schema: `backend/db/postgres_migrations/002_modules.sql`
- backend config loading: `backend/internal/app/config.go`

Frontend:

- chat page: `frontend/src/pages/Chat.tsx`
- chat websocket client: `frontend/src/components/chat/useChatMessaging.ts`

## Target Architecture

### Source Of Truth

ITMS remains authoritative for:

- channel identity
- routed member set
- primary owner
- backup owner
- linked request id
- close and reopen status
- audit trail

Mattermost is authoritative only for mirrored message transport inside mapped channels.

### Integration Model

Add a backend adapter that translates between:

- ITMS channel events and Mattermost channel/post APIs
- Mattermost webhook events and ITMS message/channel actions

### Suggested Backend Package

Add a package such as:

- `backend/pkg/mattermost/`

Suggested components:

- `client.go`: REST client for teams, channels, posts, users
- `types.go`: request and response models
- `signing.go`: webhook signature verification helpers if used
- `mapper.go`: conversion helpers between ITMS and Mattermost payloads

Suggested internal orchestration layer:

- `backend/internal/chatbridge/`

Responsibilities:

- channel mapping lookup
- post deduplication
- outbound sync from ITMS to Mattermost
- inbound sync from Mattermost to ITMS
- close and reopen propagation
- retry and dead-letter handling

## Data Model Additions

Do not overload existing chat tables for remote identity mapping. Add dedicated bridge tables.

### `chat_channel_external_links`

Purpose:

- map one ITMS channel to one Mattermost channel

Suggested columns:

- `id UUID PRIMARY KEY`
- `chat_channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE`
- `provider VARCHAR(40) NOT NULL`
- `external_team_id TEXT`
- `external_channel_id TEXT NOT NULL`
- `external_channel_name TEXT`
- `sync_direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- unique index on `(provider, external_channel_id)`
- unique index on `(chat_channel_id, provider)`

### `chat_message_external_links`

Purpose:

- prevent sync loops and support traceability

Suggested columns:

- `id UUID PRIMARY KEY`
- `chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE`
- `provider VARCHAR(40) NOT NULL`
- `external_post_id TEXT NOT NULL`
- `external_channel_id TEXT NOT NULL`
- `direction VARCHAR(20) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- unique index on `(provider, external_post_id)`
- unique index on `(chat_message_id, provider)`

### Optional `chat_bridge_delivery_attempts`

Purpose:

- queue retry state for failed outbound posts

Suggested only if you want durable async delivery instead of in-request best effort.

## Config Additions

Extend `backend/internal/app/config.go` with Mattermost settings the same way Salt and Wazuh are wired.

Suggested config fields:

- `MattermostEnabled bool`
- `MattermostBaseURL string`
- `MattermostToken string`
- `MattermostTeam string`
- `MattermostWebhookSecret string`
- `MattermostAllowedChannelKinds string`
- `MattermostSyncDirection string`
- `MattermostUsernameSuffix string`
- `MattermostCreateChannels bool`
- `MattermostArchiveOnClose bool`

Suggested env vars:

- `MATTERMOST_ENABLED=true`
- `MATTERMOST_BASE_URL=https://mattermost.example.com`
- `MATTERMOST_TOKEN=...`
- `MATTERMOST_TEAM=itms`
- `MATTERMOST_WEBHOOK_SECRET=...`
- `MATTERMOST_ALLOWED_CHANNEL_KINDS=operations,support`
- `MATTERMOST_SYNC_DIRECTION=bidirectional`
- `MATTERMOST_CREATE_CHANNELS=true`
- `MATTERMOST_ARCHIVE_ON_CLOSE=false`

Keep the token server-side only. No frontend direct Mattermost access in phase one.

## Backend Flow Changes

### 1. Channel Create

Current ITMS flow is in `createChatChannel`.

On successful ITMS channel creation:

- decide whether the channel kind is bridgeable
- create or resolve the target Mattermost channel
- persist the mapping row in `chat_channel_external_links`
- optionally seed the first ITMS message into Mattermost

Failure policy:

- do not fail ITMS chat creation because Mattermost is unavailable
- record the sync failure and surface it in audit or admin diagnostics

### 2. New Message From ITMS

Current ITMS persistence path is in `chatWebsocket`.

After `chat_messages` insert succeeds:

- publish to ITMS websocket as today
- enqueue or send the mirrored Mattermost post
- store the external post mapping if successful

This must happen after local persistence, never before.

### 3. New Message From Mattermost

Add a new protected webhook endpoint, for example:

- `POST /api/integrations/mattermost/events`

Expected behavior:

- verify webhook signature or shared secret
- ignore bot-originated events from the ITMS bridge user
- resolve `external_channel_id` to `chat_channel_id`
- map Mattermost sender to an ITMS user if possible
- if mapped, insert into `chat_messages` with that `author_id`
- if not mapped, either reject or insert as a dedicated integration user
- create `chat_message_external_links`
- publish the message through the existing chat hub

### 4. Membership And Ownership

ITMS currently has stronger semantics than Mattermost:

- `chat_members`
- `primary_owner_id`
- `backup_owner_id`

Recommendation:

- keep owner metadata only in ITMS
- mirror member additions and removals to Mattermost channel membership where possible
- do not attempt to encode primary or backup owner as Mattermost native roles in phase one

### 5. Close And Reopen

Current behavior in `closeChatChannel` and `reopenChatChannel` must remain ITMS-owned.

Close behavior recommendation:

- close in ITMS first
- optionally post a closure notice to Mattermost
- optionally archive or rename the Mattermost channel
- do not let Mattermost archive state become the source of truth

Reopen behavior recommendation:

- reopen in ITMS first
- optionally unarchive or post a reopen notice in Mattermost

### 6. Search And List APIs

Do not replace the current `/api/chat/channels` or `/api/chat/channels/:id/messages` endpoints in phase one.

The frontend should continue to read from ITMS APIs so sorting, previews, and permission filtering remain consistent.

## User Mapping

This is the hard part.

There are three viable strategies:

### Preferred

Map ITMS users to Mattermost users by email.

Requirements:

- Mattermost accounts exist for the same staff
- email addresses match reliably

Store resolved user mappings in a dedicated cache table only if lookup cost becomes high.

### Acceptable For Phase One

Only allow IT team and super admin messages to sync bidirectionally.

Employee-originated ITMS messages mirror to Mattermost, but Mattermost replies map back only from known IT users.

### Fallback

Create a dedicated integration author inside ITMS for unmapped Mattermost senders.

This is operationally workable but weakens audit clarity.

## Security Requirements

- use a bot token with the narrowest Mattermost scope possible
- store the token in backend env only
- validate webhook signatures or shared secret on inbound events
- reject inbound channel events for unmapped channels
- reject replayed post ids using `chat_message_external_links`
- keep auditor restrictions enforced only through ITMS APIs and UI
- never expose Mattermost credentials to the browser

## Frontend Impact

For the recommended bridge design, frontend changes are optional.

Possible small UI additions later:

- channel badge: `Mirrored to Mattermost`
- admin diagnostic surface for sync health
- deep link button from ITMS channel to Mattermost channel

The existing chat page can remain unchanged in phase one.

## Rollout Plan

### Phase 1

- add Mattermost config
- add bridge tables
- add backend Mattermost client
- add outbound sync for `operations` channels only
- no inbound sync yet

### Phase 2

- add inbound webhook endpoint
- enable bidirectional message sync for mapped IT users
- add dedupe protection and retry logging

### Phase 3

- mirror support channels selectively
- sync membership changes
- add admin diagnostics page or settings panel

### Phase 4

- evaluate whether any native ITMS chat UI should be replaced or reduced
- only attempt this after ownership and ticket lifecycle parity is proven

## Exact Files To Change First

Backend:

- `backend/internal/app/config.go`
- `backend/internal/api/router.go`
- `backend/internal/api/modules.go`
- add `backend/pkg/mattermost/client.go`
- add `backend/internal/chatbridge/...`
- add a new postgres migration under `backend/db/postgres_migrations/`

Frontend:

- none required for phase one
- optional later changes in `frontend/src/pages/Chat.tsx` and related chat components

## Minimal Viable Implementation

If the goal is to prove feasibility quickly, the smallest useful implementation is:

- bridge only `operations` channels
- outbound ITMS to Mattermost only
- no membership sync
- no inbound sync
- no close or reopen propagation yet

This can be delivered with low risk and gives the team a live Mattermost view of operational chat traffic.

## Open Questions

- Should employee-originated support chats ever appear in Mattermost automatically?
- Should Mattermost replies create first-class ITMS chat messages or only notes visible to operators?
- Is email-based user matching reliable for all IT staff?
- Should a closed ITMS chat archive the Mattermost channel, or only post a closure banner?
- Do you want one Mattermost team per ITMS entity, or a single shared team with channel naming conventions?

## Recommendation Summary

Proceed with a bridge, not a replacement.

Start with:

- backend Mattermost adapter
- channel and message mapping tables
- outbound mirroring for `operations` chat

Then add inbound sync only after user identity mapping is settled.