import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ChatChannelSidebar from './ChatChannelSidebar';

describe('ChatChannelSidebar', () => {
  it('renders recent chat preview author from fallback message shapes', () => {
    const markup = renderToStaticMarkup(
      <ChatChannelSidebar
        query=""
        statusFilter="open"
        kindFilter="all"
        isManager={false}
        canCreateChat={false}
        newChannelName=""
        newChannelMessage=""
        creatingChannel={false}
        loadingChannels={false}
        visibleChannels={[
          {
            id: 'channel-1',
            name: 'VPN Support',
            kind: 'support',
            status: 'open',
            createdAt: '2026-04-27T08:00:00Z',
            messageCount: 3,
            members: [
              { id: 'user-1', fullName: 'Employee One', role: 'employee' },
              { id: 'user-2', fullName: 'IT Owner', role: 'it_team' },
            ],
            latestMessage: {
              body: 'Need help with VPN',
              createdAt: '2026-04-27T09:15:00Z',
              author: { full_name: 'Employee One' },
            },
          },
        ]}
        activeChannelId="channel-1"
        channelPage={1}
        totalChannels={1}
        pageSize={10}
        formatDateTime={() => 'Apr 27 09:15'}
        onQueryChange={() => {}}
        onStatusFilterChange={() => {}}
        onKindFilterChange={() => {}}
        onStartFreshChat={() => {}}
        onNewChannelNameChange={() => {}}
        onNewChannelMessageChange={() => {}}
        onCreateSupportChat={() => {}}
        onSelectChannel={() => {}}
        onChannelPageChange={() => {}}
      />,
    );

    expect(markup).toContain('VPN Support');
    expect(markup).toContain('Need help with VPN');
    expect(markup).toContain('Employee One · Apr 27 09:15');
  });

  it('renders the active status and queue filters from props', () => {
    const markup = renderToStaticMarkup(
      <ChatChannelSidebar
        query="vpn"
        statusFilter="closed"
        kindFilter="operations"
        isManager
        canCreateChat
        newChannelName=""
        newChannelMessage=""
        creatingChannel={false}
        loadingChannels={false}
        visibleChannels={[]}
        activeChannelId=""
        channelPage={1}
        totalChannels={0}
        pageSize={50}
        formatDateTime={() => 'today'}
        onQueryChange={() => {}}
        onStatusFilterChange={() => {}}
        onKindFilterChange={() => {}}
        onStartFreshChat={() => {}}
        onNewChannelNameChange={() => {}}
        onNewChannelMessageChange={() => {}}
        onCreateSupportChat={() => {}}
        onSelectChannel={() => {}}
        onChannelPageChange={() => {}}
      />,
    );

    expect(markup).toContain('Archived</button>');
    expect(markup).toContain('border-emerald-200 bg-emerald-50 text-emerald-800');
    expect(markup).toContain('operations</button>');
  });
});