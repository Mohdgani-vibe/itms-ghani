// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const topNavMocks = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  resolveWebSocketUrlMock: vi.fn(() => 'ws://example.test/ws/announcements'),
  clearStoredSessionMock: vi.fn(),
}));

class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;

  close() {}
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

vi.mock('../../lib/session', () => ({
  clearStoredSession: topNavMocks.clearStoredSessionMock,
  getStoredSession: () => mockSession,
  getPortalSegmentForRole: (role: string) => {
    if (role === 'super_admin') {
      return 'admin';
    }
    if (role === 'it_team') {
      return 'it';
    }
    if (role === 'auditor') {
      return 'audit';
    }
    return 'emp';
  },
  getPreferredPortalPath: () => '/emp/profile',
}));

vi.mock('../../lib/api', () => ({
  apiRequest: topNavMocks.apiRequestMock,
  resolveWebSocketUrl: topNavMocks.resolveWebSocketUrlMock,
}));

vi.mock('../../lib/portalGuards', () => ({
  getPageAccessRedirect: () => null,
}));

vi.mock('../../lib/topNavNotifications', () => ({
  getTopNavNotificationAccess: (role: string) => role === 'auditor'
    ? { announcements: true, chat: false, requests: false }
    : { announcements: true, chat: true, requests: true },
}));

vi.mock('../../lib/theme', () => ({
  getStoredTheme: () => 'light',
  toggleStoredTheme: () => 'dark',
}));

import TopNav from './TopNav';

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderTopNav(entry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <TopNav />
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

afterEach(() => {
  document.body.innerHTML = '';
  topNavMocks.apiRequestMock.mockReset();
  topNavMocks.resolveWebSocketUrlMock.mockClear();
  topNavMocks.clearStoredSessionMock.mockReset();
});

describe('TopNav', () => {
  it('renders IT navigation chrome for the active IT portal', () => {
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
      <MemoryRouter initialEntries={['/it/alerts']}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(markup).toContain('ITMS');
    expect(markup).toContain('Users');
    expect(markup).toContain('Patch');
    expect(markup).toContain('Alerts');
    expect(markup).toContain('Requests');
    expect(markup).toContain('View Settings');
    expect(markup).not.toContain('Inventory');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('placeholder="Search..."');
    expect(markup).toContain('AK');
  });

  it('renders employee navigation labels without admin-only items', () => {
    mockSession = {
      token: 'token',
      shortName: 'EP',
      user: {
        id: 'user-2',
        email: 'employee@example.com',
        fullName: 'Evan Patel',
        role: 'employee',
        defaultPortal: '/emp/dashboard',
        portals: ['employee'],
      },
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/assets']}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(markup).toContain('Profile');
    expect(markup).toContain('My Assets');
    expect(markup).toContain('My Alerts');
    expect(markup).toContain('My Requests');
    expect(markup).not.toContain('View Settings');
    expect(markup).not.toContain('Inventory');
    expect(markup).toContain('EP');
  });

  it('hides search and notification chrome for auditors', () => {
    mockSession = {
      token: 'token',
      shortName: 'AU',
      user: {
        id: 'user-3',
        email: 'auditor@example.com',
        fullName: 'Ari User',
        role: 'auditor',
        defaultPortal: '/audit/dashboard',
        portals: ['auditor'],
      },
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/audit/alerts']}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(markup).toContain('Users');
    expect(markup).toContain('Announcements');
    expect(markup).toContain('Inventory');
    expect(markup).not.toContain('placeholder="Search..."');
    expect(markup).not.toContain('Notifications');
    expect(markup).not.toContain('My Profile');
    expect(markup).toContain('AU');
  });

  it('loads notification data once per section instead of refiring from unstable audience deps', async () => {
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
    topNavMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/announcements?')) {
        return { items: [], total: 0 };
      }
      if (path.startsWith('/api/chat/channels?')) {
        return { items: [], total: 0 };
      }
      if (path.startsWith('/api/requests?')) {
        return { items: [], total: 0 };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const view = await renderTopNav('/it/alerts');

    await flushEffects();
    await flushEffects();

    expect(topNavMocks.apiRequestMock).toHaveBeenCalledTimes(3);
    expect(topNavMocks.apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      expect.stringMatching(/^\/api\/announcements\?/),
      expect.stringMatching(/^\/api\/chat\/channels\?/),
      expect.stringMatching(/^\/api\/requests\?/),
    ]);

    await view.cleanup();
  });
});