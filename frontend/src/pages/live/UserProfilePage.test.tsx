// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const userProfileMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(() => ({ pathname: '/admin/users/user-1', hash: '' })),
  useNavigateMock: vi.fn(() => vi.fn()),
  useParamsMock: vi.fn<() => { id?: string }>(() => ({ id: 'user-1' })),
  apiRequestMock: vi.fn(),
  getStoredSessionMock: vi.fn(() => ({
    token: 'token-1',
    user: { id: 'admin-1', role: 'super_admin' },
  })),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: userProfileMocks.useLocationMock,
    useNavigate: userProfileMocks.useNavigateMock,
    useParams: userProfileMocks.useParamsMock,
  };
});

vi.mock('../../lib/session', () => ({
  getPreferredPortalPath: vi.fn(() => '/admin/dashboard'),
  getShortName: vi.fn(() => 'Admin'),
  getStoredSession: userProfileMocks.getStoredSessionMock,
  normalizeAuthUser: vi.fn((value) => value),
  setStoredSession: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: userProfileMocks.apiRequestMock,
}));

import UserProfilePage from './UserProfilePage';

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderProfile() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter>
        <UserProfilePage />
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

describe('UserProfilePage', () => {
  it('renders the initial loading shell during static rendering', () => {
    userProfileMocks.apiRequestMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockReturnValue({
      token: 'token-1',
      user: { id: 'admin-1', role: 'super_admin' },
    });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <UserProfilePage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Loading user profile...');
  });

  it('renders recent chats linked to the profiled user after profile data loads', async () => {
    userProfileMocks.apiRequestMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockReturnValue({
      token: 'token-1',
      user: { id: 'admin-1', role: 'super_admin' },
    });
    userProfileMocks.useLocationMock.mockReturnValue({ pathname: '/admin/users/user-1', hash: '' });
    userProfileMocks.useNavigateMock.mockReturnValue(vi.fn());
    userProfileMocks.useParamsMock.mockReturnValue({ id: 'user-1' });
    userProfileMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path === '/api/users/user-1') {
        return {
          id: 'user-1',
          full_name: 'Alex Kumar',
          email: 'alex@example.com',
          emp_id: 'EMP-1',
          status: 'active',
          role: 'employee',
          dept_id: 'dept-1',
          location_id: 'branch-1',
        };
      }
      if (path === '/api/users/meta/options') {
        return {
          roles: [{ id: 'role-1', name: 'employee' }],
          departments: [{ id: 'dept-1', name: 'IT' }],
          branches: [{ id: 'branch-1', name: 'HQ' }],
        };
      }
      if (path === '/api/users/user-1/assets') {
        return { devices: [], items: [] };
      }
      if (path === '/api/chat/channels?paginate=1&page=1&page_size=10') {
        return {
          items: [
            {
              id: 'channel-2',
              name: 'Ops Queue',
              kind: 'operations',
              status: 'open',
              createdAt: '2026-06-09T09:00:00Z',
              members: [{ id: 'user-1', fullName: 'Alex Kumar', role: 'employee' }],
              latestMessage: {
                authorName: 'Alex Kumar',
                body: 'Operations follow-up',
                createdAt: '2026-06-10T08:45:00Z',
              },
            },
            {
              id: 'channel-1',
              name: 'VPN Support',
              kind: 'support',
              status: 'open',
              createdAt: '2026-06-09T08:00:00Z',
              members: [{ id: 'user-1', fullName: 'Alex Kumar', role: 'employee' }],
              latestMessage: {
                authorName: 'Support Agent',
                body: 'Need help with VPN',
                createdAt: '2026-06-10T08:15:00Z',
              },
            },
            {
              id: 'channel-3',
              name: 'Other User Thread',
              kind: 'support',
              status: 'open',
              createdAt: '2026-06-09T10:00:00Z',
              members: [{ id: 'user-2', fullName: 'Priya Nair', role: 'employee' }],
              latestMessage: {
                authorName: 'Priya Nair',
                body: 'Other user issue',
                createdAt: '2026-06-10T09:00:00Z',
              },
            },
          ],
          total: 3,
          page: 1,
          pageSize: 10,
        };
      }

      throw new Error(`Unexpected path ${path}`);
    });

    const view = await renderProfile();
    await flushEffects();
    await flushEffects();

    expect(view.container.innerHTML).toContain('User Chat Activity');

    expect(view.container.textContent).toContain('User Chat Activity');
    expect(view.container.textContent).toContain('2 visible channels');
    expect(view.container.textContent).toContain('Ops Queue');
    expect(view.container.textContent).toContain('VPN Support');
    expect(view.container.textContent).not.toContain('Other User Thread');
    expect(view.container.querySelector('a[href="/admin/chat?channel=channel-2"]')?.textContent).toContain('Open Chat');

    await view.cleanup();
  });

  it('uses self-profile recent chat copy and employee chat routes on the employee profile path', async () => {
    userProfileMocks.apiRequestMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockReturnValue({
      token: 'token-1',
      user: { id: 'admin-1', role: 'employee' },
    });
    userProfileMocks.useLocationMock.mockReturnValue({ pathname: '/emp/profile', hash: '' });
    userProfileMocks.useNavigateMock.mockReturnValue(vi.fn());
    userProfileMocks.useParamsMock.mockReturnValue({});
    userProfileMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path === '/api/me/profile') {
        return {
          id: 'admin-1',
          full_name: 'Alex Kumar',
          email: 'alex@example.com',
          emp_id: 'EMP-1',
          status: 'active',
          role: 'employee',
          dept_id: 'dept-1',
          location_id: 'branch-1',
        };
      }
      if (path === '/api/users/meta/options') {
        return {
          roles: [{ id: 'role-1', name: 'employee' }],
          departments: [{ id: 'dept-1', name: 'IT' }],
          branches: [{ id: 'branch-1', name: 'HQ' }],
        };
      }
      if (path === '/api/me/assets') {
        return { devices: [], items: [] };
      }
      if (path === '/api/chat/channels?paginate=1&page=1&page_size=10') {
        return {
          items: [
            {
              id: 'channel-emp-2',
              name: 'Benefits Help',
              kind: 'support',
              status: 'open',
              createdAt: '2026-06-09T09:00:00Z',
              members: [{ id: 'admin-1', fullName: 'Alex Kumar', role: 'employee' }],
              latestMessage: {
                authorName: 'HR Support',
                body: 'Benefits follow-up',
                createdAt: '2026-06-10T08:45:00Z',
              },
            },
            {
              id: 'channel-emp-1',
              name: 'VPN Support',
              kind: 'support',
              status: 'open',
              createdAt: '2026-06-09T08:00:00Z',
              members: [{ id: 'admin-1', fullName: 'Alex Kumar', role: 'employee' }],
              latestMessage: {
                authorName: 'Support Agent',
                body: 'Need help with VPN',
                createdAt: '2026-06-10T08:15:00Z',
              },
            },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        };
      }

      throw new Error(`Unexpected path ${path}`);
    });

    const view = await renderProfile();
    await flushEffects();
    await flushEffects();

    expect(view.container.textContent).toContain('My Support Chats');
    expect(view.container.textContent).toContain('2 visible chats');
    expect(view.container.querySelector('a[href="/emp/chat?channel=channel-emp-2"]')?.textContent).toContain('Open My Chat');

    await view.cleanup();
  });

  it('uses profile-specific empty chat copy when the viewed user has no linked chats', async () => {
    userProfileMocks.apiRequestMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockReturnValue({
      token: 'token-1',
      user: { id: 'admin-1', role: 'super_admin' },
    });
    userProfileMocks.useLocationMock.mockReturnValue({ pathname: '/admin/users/user-1', hash: '' });
    userProfileMocks.useNavigateMock.mockReturnValue(vi.fn());
    userProfileMocks.useParamsMock.mockReturnValue({ id: 'user-1' });
    userProfileMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path === '/api/users/user-1') {
        return {
          id: 'user-1',
          full_name: 'Alex Kumar',
          email: 'alex@example.com',
          emp_id: 'EMP-1',
          status: 'active',
          role: 'employee',
          dept_id: 'dept-1',
          location_id: 'branch-1',
        };
      }
      if (path === '/api/users/meta/options') {
        return {
          roles: [{ id: 'role-1', name: 'employee' }],
          departments: [{ id: 'dept-1', name: 'IT' }],
          branches: [{ id: 'branch-1', name: 'HQ' }],
        };
      }
      if (path === '/api/users/user-1/assets') {
        return { devices: [], items: [] };
      }
      if (path === '/api/chat/channels?paginate=1&page=1&page_size=10') {
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
        };
      }

      throw new Error(`Unexpected path ${path}`);
    });

    const view = await renderProfile();
    await flushEffects();
    await flushEffects();

    expect(view.container.textContent).toContain('User Chat Activity');
    expect(view.container.textContent).toContain('Alex Kumar has no recent chat activity yet.');
    expect(view.container.querySelector('a[href="/admin/chat"]')?.textContent).toContain('Browse Chats');

    await view.cleanup();
  });

  it('hides the recent chat panel for auditor profile views', async () => {
    userProfileMocks.apiRequestMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockReset();
    userProfileMocks.getStoredSessionMock.mockImplementation(() => ({
      token: 'token-1',
      user: { id: 'audit-1', role: 'auditor' },
    }));
    userProfileMocks.useLocationMock.mockReturnValue({ pathname: '/audit/users/user-1', hash: '' });
    userProfileMocks.useNavigateMock.mockReturnValue(vi.fn());
    userProfileMocks.useParamsMock.mockReturnValue({ id: 'user-1' });
    userProfileMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path === '/api/users/user-1') {
        return {
          id: 'user-1',
          full_name: 'Alex Kumar',
          email: 'alex@example.com',
          emp_id: 'EMP-1',
          status: 'active',
          role: 'employee',
          dept_id: 'dept-1',
          location_id: 'branch-1',
        };
      }
      if (path === '/api/users/meta/options') {
        return {
          roles: [{ id: 'role-1', name: 'employee' }],
          departments: [{ id: 'dept-1', name: 'IT' }],
          branches: [{ id: 'branch-1', name: 'HQ' }],
        };
      }
      if (path === '/api/users/user-1/assets') {
        return { devices: [], items: [] };
      }

      throw new Error(`Unexpected path ${path}`);
    });

    const view = await renderProfile();
    await flushEffects();
    await flushEffects();

    expect(view.container.textContent).toContain('Auditor access is read-only on user profiles.');
    expect(view.container.textContent).not.toContain('Recent Chats');
    expect(view.container.textContent).not.toContain('User Chat Activity');

    await view.cleanup();
  });
});
