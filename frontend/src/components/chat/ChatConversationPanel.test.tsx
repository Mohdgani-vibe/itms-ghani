import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ChatConversationPanel from './ChatConversationPanel';

describe('ChatConversationPanel', () => {
  it('renders the empty-state guidance when no channel is selected', () => {
    const markup = renderToStaticMarkup(
      <ChatConversationPanel
        activeChannel={null}
        activeChannelId=""
        canCreateChat={true}
        canComposeChat={true}
        canCloseActiveChannel={false}
        canReopenActiveChannel={false}
        isManager={false}
        closingChannel={false}
        error=""
        notice=""
        hasOlderMessages={false}
        loadingMessages={false}
        loadingOlderMessages={false}
        totalMessages={0}
        messages={[]}
        remoteTypingLabel=""
        currentUserId="user-1"
        draft=""
        socketReady={true}
        isActiveChannelClosed={false}
        onStartFreshChat={vi.fn()}
        onCloseChannel={vi.fn()}
        onReopenChannel={vi.fn()}
        onLoadOlderMessages={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftBlur={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(markup).toContain('Select a channel');
    expect(markup).toContain('No chat selected.');
    expect(markup).toContain('Select an existing channel or start a fresh support chat.');
    expect(markup).toContain('Select a channel first');
  });

  it('renders the closed-channel reopen banner and older-messages control for employees', () => {
    const markup = renderToStaticMarkup(
      <ChatConversationPanel
        activeChannel={{
          id: 'channel-1',
          name: 'VPN Support',
          kind: 'support',
          status: 'closed',
          linkedRequest: { ticketNumber: 'REQ-1024' },
          members: [
            { id: 'user-1', fullName: 'Employee One', role: 'employee' },
            { id: 'user-2', fullName: 'IT Owner', role: 'it_team' },
          ],
        }}
        activeChannelId="channel-1"
        canCreateChat={true}
        canComposeChat={true}
        canCloseActiveChannel={false}
        canReopenActiveChannel={true}
        isManager={false}
        closingChannel={false}
        error=""
        notice=""
        hasOlderMessages={true}
        loadingMessages={false}
        loadingOlderMessages={false}
        totalMessages={5}
        messages={[
          {
            id: 'message-1',
            body: 'Need help with VPN access.',
            createdAt: '2026-05-08T09:00:00Z',
            author: { id: 'user-1', fullName: 'Employee One' },
          },
          {
            id: 'message-2',
            body: 'Issue resolved after token reset.',
            createdAt: '2026-05-08T09:05:00Z',
            author: { id: 'user-2', fullName: 'IT Owner' },
          },
        ]}
        remoteTypingLabel=""
        currentUserId="user-1"
        draft=""
        socketReady={true}
        isActiveChannelClosed={true}
        onStartFreshChat={vi.fn()}
        onCloseChannel={vi.fn()}
        onReopenChannel={vi.fn()}
        onLoadOlderMessages={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftBlur={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(markup).toContain('VPN Support');
    expect(markup).toContain('REQ-1024');
    expect(markup).toContain('This chat is closed.');
    expect(markup).toContain('Reopen it if you still need help');
    expect(markup).toContain('Load older messages (3 more)');
    expect(markup).toContain('Issue resolved after token reset.');
    expect(markup).toContain('This chat is closed. Reopen it to continue.');
  });

  it('renders live conversation content, notices, and typing status', () => {
    const markup = renderToStaticMarkup(
      <ChatConversationPanel
        activeChannel={{
          id: 'channel-2',
          name: 'Laptop Setup',
          kind: 'operations',
          status: 'open',
          members: [
            { id: 'user-1', fullName: 'Alex Kumar', role: 'employee' },
            { id: 'user-2', fullName: 'IT Owner', role: 'it_team' },
          ],
        }}
        activeChannelId="channel-2"
        canCreateChat={false}
        canComposeChat={true}
        canCloseActiveChannel={true}
        canReopenActiveChannel={false}
        isManager={true}
        closingChannel={false}
        error="Terminal follow-up queued"
        notice="Device assigned successfully"
        hasOlderMessages={false}
        loadingMessages={false}
        loadingOlderMessages={false}
        totalMessages={2}
        messages={[
          {
            id: 'message-1',
            body: 'Laptop is ready for collection.',
            createdAt: '2026-05-08T09:10:00Z',
            author: { id: 'user-2', fullName: 'IT Owner' },
          },
          {
            id: 'message-2',
            body: 'Thanks, collecting it now.',
            createdAt: '2026-05-08T09:12:00Z',
            author: { id: 'user-1', fullName: 'Alex Kumar' },
          },
        ]}
        remoteTypingLabel="IT Owner is typing..."
        currentUserId="user-1"
        draft="On my way"
        socketReady={true}
        isActiveChannelClosed={false}
        onStartFreshChat={vi.fn()}
        onCloseChannel={vi.fn()}
        onReopenChannel={vi.fn()}
        onLoadOlderMessages={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftBlur={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(markup).toContain('Close Chat');
    expect(markup).toContain('Terminal follow-up queued');
    expect(markup).toContain('Device assigned successfully');
    expect(markup).toContain('Laptop is ready for collection.');
    expect(markup).toContain('Thanks, collecting it now.');
    expect(markup).toContain('IT Owner is typing...');
    expect(markup).toContain('Type a message...');
  });
});