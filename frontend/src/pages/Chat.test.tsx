import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type MockSession = {
  token: string;
  shortName: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    defaultPortal: string;
    portals: string[];
  };
};

let mockSession: MockSession | null = {
  token: 'token',
  shortName: 'AK',
  user: {
    id: 'user-1',
    email: 'alex@example.com',
    fullName: 'Alex Kumar',
    role: 'it_team',
    defaultPortal: '/it/dashboard',
    portals: ['it_team'],
  },
};

vi.mock('../lib/session', () => ({
  getStoredSession: () => mockSession,
}));

vi.mock('../components/chat/ChatChannelSidebar', () => ({
  default: ({ canCreateChat, isManager }: { canCreateChat: boolean; isManager: boolean }) => (
    <div>
      Channel Sidebar
      {canCreateChat ? ' create-enabled' : ' create-disabled'}
      {isManager ? ' manager-view' : ' non-manager-view'}
    </div>
  ),
}));

vi.mock('../components/chat/ChatConversationPanel', () => ({
  default: ({ canComposeChat, canCloseActiveChannel }: { canComposeChat: boolean; canCloseActiveChannel: boolean }) => (
    <div>
      Conversation Panel
      {canComposeChat ? ' compose-enabled' : ' compose-disabled'}
      {canCloseActiveChannel ? ' close-enabled' : ' close-disabled'}
    </div>
  ),
}));

vi.mock('../components/chat/ChatControlSidebar', () => ({
  default: () => <div>Control Sidebar</div>,
}));

vi.mock('../components/chat/ChatCloseModals', () => ({
  default: () => <div>Close Modals</div>,
}));

vi.mock('../components/ConfirmDialog', () => ({
  default: () => <div>Confirm Dialog</div>,
}));

vi.mock('../components/chat/useChatMessaging', () => ({
  useChatMessaging: () => ({
    socketReady: true,
    remoteTypingLabel: '',
    handleSend: vi.fn(),
    handleLoadOlderMessages: vi.fn(),
    handleDraftChange: vi.fn(),
    handleDraftBlur: vi.fn(),
  }),
}));

import Chat from './Chat';

describe('Chat', () => {
  it('renders the manager chat workspace with control sidebar access', () => {
    mockSession = {
      token: 'token',
      shortName: 'AK',
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        fullName: 'Alex Kumar',
        role: 'it_team',
        defaultPortal: '/it/dashboard',
        portals: ['it_team'],
      },
    };

    const markup = renderToStaticMarkup(<Chat />);

    expect(markup).toContain('Channel Sidebar');
    expect(markup).toContain('create-enabled');
    expect(markup).toContain('manager-view');
    expect(markup).toContain('Conversation Panel');
    expect(markup).toContain('compose-enabled');
    expect(markup).toContain('Control Sidebar');
    expect(markup).toContain('Close Modals');
    expect(markup).toContain('Confirm Dialog');
  });

  it('renders the auditor chat workspace without manager controls or compose access', () => {
    mockSession = {
      token: 'token',
      shortName: 'AU',
      user: {
        id: 'user-2',
        email: 'auditor@example.com',
        fullName: 'Ari User',
        role: 'auditor',
        defaultPortal: '/audit/dashboard',
        portals: ['auditor'],
      },
    };

    const markup = renderToStaticMarkup(<Chat />);

    expect(markup).toContain('Channel Sidebar');
    expect(markup).toContain('create-disabled');
    expect(markup).toContain('non-manager-view');
    expect(markup).toContain('Conversation Panel');
    expect(markup).toContain('compose-disabled');
    expect(markup).not.toContain('Control Sidebar');
    expect(markup).toContain('Close Modals');
  });
});