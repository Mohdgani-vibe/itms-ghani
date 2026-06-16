import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import RecentChatPanel from './RecentChatPanel';

describe('RecentChatPanel', () => {
  it('renders recent chat cards with deep links and activity details', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <RecentChatPanel
          basePath="/it"
          loading={false}
          total={4}
          panel={{
            eyebrow: 'Recent Chats',
            title: 'Chat Activity',
            description: 'Latest support conversations and portal threads visible from this dashboard.',
            actionLabel: 'Open Chat',
            totalLabel: 'visible channels',
            loadingText: 'Loading recent chat activity...',
            emptyText: 'No recent chat activity yet.',
          }}
          items={[
            {
              id: 'channel-1',
              title: 'VPN Support',
              meta: 'Employee One: Need help with VPN',
              timestamp: '30m ago',
              badge: 'Support',
            },
            {
              id: 'channel-2',
              title: 'Ops Queue',
              meta: 'Operations chat channel',
              timestamp: '2h ago',
              badge: 'Operations',
            },
            {
              id: 'channel-3',
              title: 'Stock Queue',
              meta: 'Inventory request follow-up',
              timestamp: '3h ago',
              badge: 'Support',
            },
            {
              id: 'channel-4',
              title: 'HR Helpdesk',
              meta: 'Benefits question',
              timestamp: '5h ago',
              badge: 'Support',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Recent Chats');
    expect(markup).toContain('Chat Activity');
    expect(markup).toContain('4 visible channels');
    expect(markup).toContain('Open Chat');
    expect(markup).toContain('VPN Support');
    expect(markup).toContain('Employee One: Need help with VPN');
    expect(markup).toContain('Last active 30m ago');
    expect(markup).toContain('/it/chat?channel=channel-1');
    expect(markup).toContain('/it/chat?channel=channel-2');
    expect(markup).toContain('/it/chat?channel=channel-3');
    expect(markup).not.toContain('/it/chat?channel=channel-4');
    expect(markup).toContain('Showing the latest 3 chats from this workspace.');
    expect(markup).toContain('View All Chats');
    expect(markup).toContain('/it/chat');
  });

  it('renders loading and empty states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <RecentChatPanel
          basePath="/it"
          loading={true}
          total={0}
          panel={{
            eyebrow: 'Recent Chats',
            title: 'Chat Activity',
            description: 'Latest support conversations and portal threads visible from this dashboard.',
            actionLabel: 'Open Chat',
            totalLabel: 'visible channels',
            loadingText: 'Loading recent chat activity...',
            emptyText: 'No recent chat activity yet.',
          }}
          items={[]}
        />
      </MemoryRouter>,
    );

    const emptyMarkup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <RecentChatPanel
          basePath="/it"
          loading={false}
          total={0}
          panel={{
            eyebrow: 'Recent Chats',
            title: 'Chat Activity',
            description: 'Latest support conversations and portal threads visible from this dashboard.',
            actionLabel: 'Open Chat',
            totalLabel: 'visible channels',
            loadingText: 'Loading recent chat activity...',
            emptyText: 'No recent chat activity yet.',
          }}
          items={[]}
        />
      </MemoryRouter>,
    );

    expect(loadingMarkup).toContain('Loading recent chat activity...');
    expect(loadingMarkup).toContain('Loading...');
    expect(loadingMarkup).toContain('aria-disabled="true"');
    expect(loadingMarkup).toContain('...');
    expect(emptyMarkup).toContain('No recent chat activity yet.');
    expect(emptyMarkup).toContain('0 visible channels');
    expect(emptyMarkup).toContain('Browse Chats');
    expect(emptyMarkup).toContain('/it/chat');
  });

  it('uses panel-specific loading copy for employee routes', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/dashboard']}>
        <RecentChatPanel
          basePath="/emp"
          loading={true}
          total={0}
          panel={{
            eyebrow: 'Recent Chats',
            title: 'My Support Chats',
            description: 'Latest support conversations and replies tied to your employee account.',
            actionLabel: 'Open My Chat',
            totalLabel: 'visible chats',
            loadingText: 'Loading your recent chat activity...',
            emptyText: 'No recent chat activity yet.',
          }}
          items={[]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('My Support Chats');
    expect(markup).toContain('Loading your recent chat activity...');
    expect(markup).toContain('Loading...');
    expect(markup).toContain('aria-disabled="true"');
  });
});