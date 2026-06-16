// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const dashboardPageMocks = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../lib/api', () => ({
  apiRequest: dashboardPageMocks.apiRequestMock,
}));

vi.mock('../../lib/session', () => ({
  getStoredSession: () => ({
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
  }),
}));

import DashboardPage from './DashboardPage';

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderDashboard(entry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <DashboardPage />
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
  dashboardPageMocks.apiRequestMock.mockReset();
});

describe('DashboardPage', () => {
  it('renders the active charts-only dashboard shell for the live IT route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('IT Team Workspace');
    expect(markup).toContain('Welcome Alex Kumar');
    expect(markup).toContain('Operational Pulse');
    expect(markup).toContain('Total Systems Added');
    expect(markup).toContain('Active Users Today');
    expect(markup).toContain('Offline Users');
    expect(markup).toContain('Recent Chats');
    expect(markup).toContain('Chat Activity');
    expect(markup).toContain('Loading...');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('...');
  });

  it('maps the employee route to the employee workspace label', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Employee Workspace');
    expect(markup).toContain('My Support Chats');
    expect(markup).toContain('Loading...');
    expect(markup).toContain('aria-disabled="true"');
  });

  it('renders recent chat links with deep-linked chat routes after dashboard data loads', async () => {
    dashboardPageMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/users?')) {
        return {
          items: [{ id: 'user-1', fullName: 'Alex Kumar', createdAt: '2026-06-09T09:00:00Z' }],
          total: 1,
        };
      }
      if (path === '/api/requests?paginate=1&page=1&page_size=5') {
        return {
          items: [{ id: 'req-1', title: 'Laptop setup', status: 'pending', createdAt: '2026-06-09T10:00:00Z' }],
          total: 1,
          summary: { pending: 1, inProgress: 0, resolved: 0 },
        };
      }
      if (path === '/api/announcements?paginate=1&page=1&page_size=5') {
        return {
          items: [{ id: 'ann-1', title: 'Maintenance Notice', createdAt: '2026-06-09T08:00:00Z' }],
          total: 1,
        };
      }
      if (path === '/api/chat/channels?paginate=1&page=1&page_size=5') {
        return {
          items: [
            {
              id: 'channel-2',
              name: 'Ops Queue',
              kind: 'operations',
              status: 'open',
              createdAt: '2026-06-09T09:00:00Z',
              members: [{ id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' }],
              latestMessage: {
                authorName: 'Alex Kumar',
                body: 'Operations chat channel',
                createdAt: '2026-06-10T08:45:00Z',
              },
            },
            {
              id: 'channel-1',
              name: 'VPN Support',
              kind: 'support',
              status: 'open',
              createdAt: '2026-06-09T08:00:00Z',
              members: [{ id: 'user-1', fullName: 'Alex Kumar', role: 'it_team' }],
              latestMessage: {
                authorName: 'Employee One',
                body: 'Need help with VPN',
                createdAt: '2026-06-10T08:15:00Z',
              },
            },
          ],
          total: 2,
        };
      }
      if (path.startsWith('/api/gatepass?')) {
        return { items: [], total: 0 };
      }
      if (path.startsWith('/api/audit?')) {
        return { items: [{ id: 'audit-1', action: 'login', createdAt: '2026-06-10T08:30:00Z', actor: { fullName: 'Alex Kumar', email: 'alex@example.com' } }] };
      }
      if (path.startsWith('/api/alerts?')) {
        return { items: [], total: 0, summary: { pending: 0, inProgress: 0, resolved: 0 } };
      }
      if (path === '/api/inventory/module/assets?page=1&page_size=1000') {
        return { items: [{ id: 'asset-1', createdAt: '2026-06-01T08:00:00Z' }], total: 12 };
      }
      if (path === '/api/patch/reports') {
        return [];
      }
      if (path.startsWith('/api/devices?')) {
        return {
          items: [{ id: 'dev-1', title: 'Ops Laptop 01', createdAt: '2026-06-08T07:00:00Z', lastSeenAt: '2026-06-10T08:00:00Z', user: { fullName: 'Alex Kumar', employeeCode: 'EMP-1' } }],
          total: 1,
        };
      }

      throw new Error(`unexpected path ${path}`);
    });

    const view = await renderDashboard('/it/dashboard');
    await flushEffects();
    await flushEffects();

    expect(view.container.textContent).toContain('Recent Chats');
    expect(view.container.textContent).toContain('Ops Queue');
    expect(view.container.textContent).toContain('2 visible channels');
    expect(view.container.querySelector('a[href="/it/chat?channel=channel-2"]')?.textContent).toContain('Open Chat');
    expect(view.container.querySelectorAll('a[href="/it/chat?channel=channel-2"]').length).toBeGreaterThanOrEqual(2);
    expect(view.container.querySelector('a[href="/it/chat?channel=channel-1"]')?.textContent).toContain('VPN Support');

    await view.cleanup();
  });
});