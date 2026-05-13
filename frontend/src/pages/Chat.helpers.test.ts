import { describe, expect, it } from 'vitest';

import { buildChatChannelsUrl, buildChatMessagesUrl, deriveChatChannelActionPermissions, deriveChatPermissions, filterAvailableTeammates, filterBackupOwnerCandidates, filterEligibleChatTeammates, filterOwnerCandidates, findActiveChatChannel, hasOlderChatMessages, resolveChatMemberName, selectNextActiveChatChannelId } from './Chat';

describe('Chat helpers', () => {
  it('derives manager and auditor permissions correctly', () => {
    expect(deriveChatPermissions('it_team', false)).toMatchObject({
      isManager: true,
      canCreateChat: true,
      canComposeChat: true,
    });
    expect(deriveChatPermissions('auditor', true)).toMatchObject({
      isAuditor: true,
      canCreateChat: false,
      canComposeChat: false,
    });
  });

  it('lets employees create chats only when workflow settings allow it', () => {
    expect(deriveChatPermissions('employee', true)).toMatchObject({
      isEmployee: true,
      canCreateChat: true,
      canComposeChat: true,
    });
    expect(deriveChatPermissions('employee', false)).toMatchObject({
      canCreateChat: false,
      canComposeChat: true,
    });
  });

  it('builds the default chat channels query', () => {
    expect(buildChatChannelsUrl(3, '', 'all', 'all')).toBe(
      '/api/chat/channels?paginate=1&page=3&page_size=50',
    );
  });

  it('trims search text and appends kind and status filters', () => {
    expect(buildChatChannelsUrl(2, '  printer  ', 'support', 'closed')).toBe(
      '/api/chat/channels?paginate=1&page=2&page_size=50&search=printer&kind=support&status=closed',
    );
  });

  it('builds the chat messages query', () => {
    expect(buildChatMessagesUrl('channel-42', 3)).toBe(
      '/api/chat/channels/channel-42/messages?paginate=1&page=3&page_size=100',
    );
  });

  it('detects when older chat messages remain available', () => {
    expect(hasOlderChatMessages(10, 25)).toBe(true);
    expect(hasOlderChatMessages(25, 25)).toBe(false);
    expect(hasOlderChatMessages(30, 25)).toBe(false);
  });

  it('filters out active channel members from the available teammates list', () => {
    const teammates = [
      { id: 'user-1', fullName: 'Alex Kumar', email: 'alex@example.com', role: 'it_team' },
      { id: 'user-2', fullName: 'Rina Das', email: 'rina@example.com', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', email: 'noah@example.com', role: 'it_team' },
    ];
    const activeChannel = {
      id: 'channel-1',
      name: 'Support 1',
      kind: 'support',
      members: [
        { id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' },
        { id: 'user-4', fullName: 'Guest User', role: 'employee' },
      ],
    };

    expect(filterAvailableTeammates(teammates, activeChannel)).toEqual([
      { id: 'user-2', fullName: 'Rina Das', email: 'rina@example.com', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', email: 'noah@example.com', role: 'it_team' },
    ]);
    expect(filterAvailableTeammates(teammates, null)).toEqual(teammates);
  });

  it('removes the primary owner from backup owner candidates', () => {
    const ownerCandidates = [
      { id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' },
      { id: 'user-2', fullName: 'Rina Das', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', role: 'it_team' },
    ];

    expect(filterBackupOwnerCandidates(ownerCandidates, 'user-2', null)).toEqual([
      { id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' },
      { id: 'user-3', fullName: 'Noah Ali', role: 'it_team' },
    ]);
    expect(filterBackupOwnerCandidates(ownerCandidates, null, {
      id: 'channel-1',
      name: 'Support 1',
      kind: 'support',
      members: ownerCandidates,
      primaryOwner: { id: 'user-1', fullName: 'Alex Kumar' },
    })).toEqual([
      { id: 'user-2', fullName: 'Rina Das', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', role: 'it_team' },
    ]);
  });

  it('keeps only IT manager roles as owner candidates', () => {
    const activeChannel = {
      id: 'channel-1',
      name: 'Support 1',
      kind: 'support',
      members: [
        { id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' },
        { id: 'user-2', fullName: 'Rina Das', role: 'super_admin' },
        { id: 'user-3', fullName: 'Noah Ali', role: 'employee' },
      ],
    };

    expect(filterOwnerCandidates(activeChannel)).toEqual([
      { id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' },
      { id: 'user-2', fullName: 'Rina Das', role: 'super_admin' },
    ]);
    expect(filterOwnerCandidates(null)).toEqual([]);
  });

  it('finds the active channel by id', () => {
    const channels = [
      { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
      { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
    ];

    expect(findActiveChatChannel(channels, 'channel-2')).toEqual(
      { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
    );
    expect(findActiveChatChannel(channels, 'missing')).toBeNull();
  });

  it('retains the current active channel when present and falls back to the first channel', () => {
    const channels = [
      { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
      { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
    ];

    expect(selectNextActiveChatChannelId(channels, 'channel-2')).toBe('channel-2');
    expect(selectNextActiveChatChannelId(channels, 'missing')).toBe('channel-1');
    expect(selectNextActiveChatChannelId([], 'missing')).toBe('');
  });

  it('resolves chat member names with a fallback label', () => {
    const members = [
      { id: 'user-1', fullName: 'Alex Kumar' },
      { id: 'user-2', fullName: 'Rina Das' },
    ];

    expect(resolveChatMemberName(members, 'user-2', 'Selected member')).toBe('Rina Das');
    expect(resolveChatMemberName(members, 'missing', 'Selected member')).toBe('Selected member');
    expect(resolveChatMemberName(members, null, 'Selected member')).toBe('Selected member');
  });

  it('filters eligible teammates using workflow member ids', () => {
    const teammates = [
      { id: 'user-1', fullName: 'Alex Kumar', email: 'alex@example.com', role: 'it_team' },
      { id: 'user-2', fullName: 'Rina Das', email: 'rina@example.com', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', email: 'noah@example.com', role: 'it_team' },
    ];

    expect(filterEligibleChatTeammates(teammates, [])).toEqual(teammates);
    expect(filterEligibleChatTeammates(teammates, ['user-2', 'user-3'])).toEqual([
      { id: 'user-2', fullName: 'Rina Das', email: 'rina@example.com', role: 'super_admin' },
      { id: 'user-3', fullName: 'Noah Ali', email: 'noah@example.com', role: 'it_team' },
    ]);
  });

  it('derives close and reopen permissions from role and channel status', () => {
    const openChannel = { id: 'channel-open', name: 'Open', kind: 'support', members: [], status: 'open' };
    const closedChannel = { id: 'channel-closed', name: 'Closed', kind: 'support', members: [], status: 'closed' };

    expect(deriveChatChannelActionPermissions('it_team', openChannel)).toEqual({
      isActiveChannelClosed: false,
      canCloseActiveChannel: true,
      canReopenActiveChannel: false,
    });
    expect(deriveChatChannelActionPermissions('employee', closedChannel)).toEqual({
      isActiveChannelClosed: true,
      canCloseActiveChannel: false,
      canReopenActiveChannel: true,
    });
    expect(deriveChatChannelActionPermissions('auditor', closedChannel)).toEqual({
      isActiveChannelClosed: true,
      canCloseActiveChannel: false,
      canReopenActiveChannel: false,
    });
    expect(deriveChatChannelActionPermissions('super_admin', null)).toEqual({
      isActiveChannelClosed: false,
      canCloseActiveChannel: false,
      canReopenActiveChannel: false,
    });
  });
});