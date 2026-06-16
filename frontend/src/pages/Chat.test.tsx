// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
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

const chatPageMocks = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../lib/api', () => ({
  apiRequest: chatPageMocks.apiRequestMock,
}));

vi.mock('../lib/session', () => ({
  getStoredSession: () => mockSession,
}));

vi.mock('../components/chat/ChatChannelSidebar', () => ({
  default: ({
    canCreateChat,
    isManager,
    activeChannelId,
    query,
    statusFilter,
    kindFilter,
    channelPage,
  }: {
    canCreateChat: boolean;
    isManager: boolean;
    activeChannelId: string;
    query: string;
    statusFilter: string;
    kindFilter: string;
    channelPage: number;
  }) => (
    <div>
      Channel Sidebar
      {activeChannelId ? ` active-${activeChannelId}` : ' active-none'}
      {` query-${query || 'empty'}`}
      {` status-${statusFilter}`}
      {` kind-${kindFilter}`}
      {` page-${channelPage}`}
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

function LocationProbe() {
  const location = useLocation();
  return <div data-location>{`${location.pathname}${location.search}`}</div>;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderChat(entry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Chat />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await flushEffects();

  return {
    container,
    cleanup: async () => {
      if (root) {
        await act(async () => {
          root!.unmount();
        });
      }
      container.remove();
    },
  };
}

async function renderChatInBrowser(entry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  window.history.replaceState({}, '', entry);

  await act(async () => {
    root = createRoot(container);
    root.render(
      <BrowserRouter>
        <Chat />
        <LocationProbe />
      </BrowserRouter>,
    );
  });
  await flushEffects();

  return {
    container,
    cleanup: async () => {
      if (root) {
        await act(async () => {
          root!.unmount();
        });
      }
      window.history.replaceState({}, '', '/');
      container.remove();
    },
  };
}

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

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/chat']}>
        <Chat />
      </MemoryRouter>,
    );

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

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/audit/chat']}>
        <Chat />
      </MemoryRouter>,
    );

    expect(markup).toContain('Channel Sidebar');
    expect(markup).toContain('create-disabled');
    expect(markup).toContain('non-manager-view');
    expect(markup).toContain('Conversation Panel');
    expect(markup).toContain('compose-disabled');
    expect(markup).not.toContain('Control Sidebar');
    expect(markup).toContain('Close Modals');
  });

  it('prefers a requested chat channel from the query string when it is visible', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/chat/channels?')) {
        return {
          items: [
            { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-2/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChat('/it/chat?channel=channel-2');
    await flushEffects();

    expect(container.textContent).toContain('active-channel-2');

    await cleanup();
  });

  it('preserves an employee chat deep link on the employee portal route', async () => {
    mockSession = {
      token: 'token',
      shortName: 'AK',
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        fullName: 'Alex Kumar',
        role: 'employee',
        defaultPortal: '/emp/dashboard',
        portals: ['employee'],
      },
    };

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/chat/channels?')) {
        return {
          items: [
            { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-2/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChat('/emp/chat?channel=channel-2');
    await flushEffects();

    expect(container.textContent).toContain('active-channel-2');
    expect(container.textContent).toContain('/emp/chat?channel=channel-2');
    expect(container.textContent).toContain('create-enabled');
    expect(container.textContent).toContain('non-manager-view');
    expect(container.textContent).toContain('compose-enabled');

    await cleanup();
  });

  it('syncs the selected chat channel into the URL for shareable links', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/chat/channels?')) {
        return {
          items: [
            { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-1/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChat('/it/chat');

    expect(container.textContent).toContain('active-channel-1');
    expect(container.textContent).toContain('/it/chat?channel=channel-1');

    await cleanup();
  });

  it('replaces an invalid requested chat channel in the URL with the first visible channel', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/chat/channels?')) {
        return {
          items: [
            { id: 'channel-1', name: 'Support 1', kind: 'support', members: [] },
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', members: [] },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-1/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChat('/it/chat?channel=missing');

    expect(container.textContent).toContain('active-channel-1');
    expect(container.textContent).toContain('/it/chat?channel=channel-1');

    await cleanup();
  });

  it('hydrates chat filters and pagination from the URL and keeps them shareable', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.includes('search=vpn') && path.includes('kind=operations') && path.includes('status=closed') && path.includes('page=3')) {
        return {
          items: [
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', status: 'closed', members: [] },
          ],
          total: 1,
          page: 3,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-2/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChat('/it/chat?search=vpn&kind=operations&status=closed&page=3');

    expect(container.textContent).toContain('query-vpn');
    expect(container.textContent).toContain('status-closed');
    expect(container.textContent).toContain('kind-operations');
    expect(container.textContent).toContain('page-3');
    expect(container.textContent).toContain('/it/chat?channel=channel-2&search=vpn&kind=operations&status=closed&page=3');

    await cleanup();
  });

  it('rehydrates chat filters from mounted URL navigation without remounting the page', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.includes('search=vpn') && path.includes('kind=operations') && path.includes('status=closed') && path.includes('page=3')) {
        return {
          items: [
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', status: 'closed', members: [] },
          ],
          total: 1,
          page: 3,
          pageSize: 50,
        };
      }
      if (path.includes('search=hardware') && path.includes('page=2') && !path.includes('kind=') && !path.includes('status=')) {
        return {
          items: [
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', status: 'open', members: [] },
          ],
          total: 1,
          page: 2,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-2/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      if (path.startsWith('/api/chat/channels?')) {
        throw new Error(`Unexpected chat channels request: ${path}`);
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChatInBrowser('/it/chat?channel=channel-2&search=vpn&kind=operations&status=closed&page=3');

    expect(container.textContent).toContain('active-channel-2');
    expect(container.textContent).toContain('query-vpn');
    expect(container.textContent).toContain('status-closed');
    expect(container.textContent).toContain('kind-operations');
    expect(container.textContent).toContain('page-3');

    await act(async () => {
      window.history.pushState({}, '', '/it/chat?channel=channel-2&search=hardware&page=2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await flushEffects();
    await flushEffects();

    expect(container.textContent).toContain('active-channel-2');
    expect(container.textContent).toContain('query-hardware');
    expect(container.textContent).toContain('status-open');
    expect(container.textContent).toContain('kind-all');
    expect(container.textContent).toContain('page-2');
    expect(container.textContent).toContain('/it/chat?channel=channel-2&search=hardware&page=2');

    await cleanup();
  });

  it('rehydrates a different chat channel from mounted URL navigation without remounting the page', async () => {
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

    chatPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.includes('search=vpn') && path.includes('kind=operations') && path.includes('status=closed') && path.includes('page=3')) {
        return {
          items: [
            { id: 'channel-2', name: 'Ops 1', kind: 'operations', status: 'closed', members: [] },
          ],
          total: 1,
          page: 3,
          pageSize: 50,
        };
      }
      if (path.includes('search=hardware') && path.includes('kind=support') && path.includes('page=2')) {
        return {
          items: [
            { id: 'channel-1', name: 'Support 1', kind: 'support', status: 'open', members: [] },
          ],
          total: 1,
          page: 2,
          pageSize: 50,
        };
      }
      if (path === '/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active') {
        return { items: [] };
      }
      if (path === '/api/settings/workflow') {
        return { chatAutoCreateEnabled: true, chatMemberIds: [] };
      }
      if (path === '/api/chat/channels/channel-2/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      if (path === '/api/chat/channels/channel-1/messages?paginate=1&page=1&page_size=100') {
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
      if (path.startsWith('/api/chat/channels?')) {
        throw new Error(`Unexpected chat channels request: ${path}`);
      }
      return { items: [], total: 0, page: 1, pageSize: 100 };
    });

    const { container, cleanup } = await renderChatInBrowser('/it/chat?channel=channel-2&search=vpn&kind=operations&status=closed&page=3');

    expect(container.textContent).toContain('active-channel-2');
    expect(container.textContent).toContain('query-vpn');
    expect(container.textContent).toContain('status-closed');
    expect(container.textContent).toContain('kind-operations');
    expect(container.textContent).toContain('page-3');

    await act(async () => {
      window.history.pushState({}, '', '/it/chat?channel=channel-1&search=hardware&kind=support&page=2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await flushEffects();
    await flushEffects();

    expect(container.textContent).toContain('active-channel-1');
    expect(container.textContent).toContain('query-hardware');
    expect(container.textContent).toContain('status-open');
    expect(container.textContent).toContain('kind-support');
    expect(container.textContent).toContain('page-2');
    expect(container.textContent).toContain('/it/chat?channel=channel-1&search=hardware&kind=support&page=2');

    await cleanup();
  });
});