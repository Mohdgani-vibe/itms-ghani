import { describe, expect, it } from 'vitest';

import { chatActivityTimestamp, chatPreviewAuthorName, chatPreviewText, sortByRecentChatActivity } from './chat';

describe('chatActivityTimestamp', () => {
  it('prefers the latest message timestamp when present', () => {
    const item = {
      createdAt: '2026-04-27T08:00:00Z',
      latestMessage: { createdAt: '2026-04-27T09:15:00Z' },
    };

    expect(chatActivityTimestamp(item)).toBe(new Date('2026-04-27T09:15:00Z').getTime());
  });

  it('falls back to channel creation time when latest message time is missing or invalid', () => {
    expect(
      chatActivityTimestamp({
        createdAt: '2026-04-27T08:00:00Z',
        latestMessage: { createdAt: 'not-a-date' },
      }),
    ).toBe(new Date('2026-04-27T08:00:00Z').getTime());
  });
});

describe('sortByRecentChatActivity', () => {
  it('sorts channels by most recent activity first', () => {
    const items = [
      { id: 'oldest', createdAt: '2026-04-27T08:00:00Z' },
      { id: 'middle', latestMessage: { createdAt: '2026-04-27T09:00:00Z' } },
      { id: 'newest', latestMessage: { createdAt: '2026-04-27T10:00:00Z' } },
    ];

    expect(sortByRecentChatActivity(items).map((item) => item.id)).toEqual(['newest', 'middle', 'oldest']);
  });
});

describe('chatPreviewAuthorName', () => {
  it('returns a trimmed author name when present', () => {
    expect(chatPreviewAuthorName({ authorName: '  Employee One  ' })).toBe('Employee One');
  });

  it('falls back through compatible author name shapes', () => {
    expect(chatPreviewAuthorName({ fullName: 'Employee Two' })).toBe('Employee Two');
    expect(chatPreviewAuthorName({ full_name: 'Employee Three' })).toBe('Employee Three');
    expect(chatPreviewAuthorName({ author: { fullName: 'Employee Four' } })).toBe('Employee Four');
    expect(chatPreviewAuthorName({ author: { full_name: 'Employee Five' } })).toBe('Employee Five');
    expect(chatPreviewAuthorName({ author: { name: 'Employee Six' } })).toBe('Employee Six');
  });

  it('falls back to the default label when no usable author name exists', () => {
    expect(chatPreviewAuthorName({ authorName: '   ' })).toBe('Chat user');
    expect(chatPreviewAuthorName()).toBe('Chat user');
  });
});

describe('chatPreviewText', () => {
  it('renders author and trimmed body for recent chat previews', () => {
    expect(chatPreviewText({ authorName: 'Employee One', body: '  Need help with VPN  ' })).toBe('Employee One: Need help with VPN');
  });

  it('returns the provided empty label when the body is missing or blank', () => {
    expect(chatPreviewText({ authorName: 'Employee One', body: '   ' }, 'Chat channel')).toBe('Chat channel');
    expect(chatPreviewText(undefined)).toBe('No recent messages');
  });
});