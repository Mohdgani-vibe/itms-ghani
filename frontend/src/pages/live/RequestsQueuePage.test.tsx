// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const requestsQueueMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  apiRequestMock: vi.fn(),
  requestsQueueHeroMock: vi.fn(),
  requestsCreateFormMock: vi.fn(),
  requestsQueueToolbarMock: vi.fn(),
  requestsQueueSectionMock: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: requestsQueueMocks.useLocationMock,
    useNavigate: requestsQueueMocks.useNavigateMock,
  };
});

vi.mock('../../lib/session', () => ({
  getStoredSession: requestsQueueMocks.getStoredSessionMock,
}));

vi.mock('../../lib/api', () => ({
  apiRequest: requestsQueueMocks.apiRequestMock,
}));

vi.mock('../../components/requests/RequestsQueueHero', () => ({
  default: (props: unknown) => {
    requestsQueueMocks.requestsQueueHeroMock(props);
    return <div>requests-queue-hero</div>;
  },
}));

vi.mock('../../components/requests/RequestsCreateForm', () => ({
  default: (props: unknown) => {
    requestsQueueMocks.requestsCreateFormMock(props);
    return <div>requests-create-form</div>;
  },
}));

vi.mock('../../components/requests/RequestsQueueToolbar', () => ({
  default: (props: unknown) => {
    requestsQueueMocks.requestsQueueToolbarMock(props);
    return <div>requests-queue-toolbar</div>;
  },
}));

vi.mock('../../components/requests/RequestsQueueSection', () => ({
  default: (props: { title: string; children?: React.ReactNode }) => {
    requestsQueueMocks.requestsQueueSectionMock(props);
    return <div>{`requests-queue-section:${props.title}`}{props.children}</div>;
  },
}));

vi.mock('../../components/requests/RequestsBulkTriagePanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailCommentsPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailControlsPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestEnrollmentReviewPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailInfoPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailOverviewPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestQueueTableRow', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestSelectedDetailPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestsQueueEmptyState', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestsQueueTablePanel', () => ({ default: () => null }));
vi.mock('../../components/Pagination', () => ({ default: () => null }));

import RequestsQueuePage from './RequestsQueuePage';

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(<RequestsQueuePage />);
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
  requestsQueueMocks.apiRequestMock.mockReset();
  requestsQueueMocks.requestsQueueHeroMock.mockReset();
  requestsQueueMocks.requestsCreateFormMock.mockReset();
  requestsQueueMocks.requestsQueueToolbarMock.mockReset();
  requestsQueueMocks.requestsQueueSectionMock.mockReset();
  requestsQueueMocks.useLocationMock.mockReset();
  requestsQueueMocks.useNavigateMock.mockReset();
  requestsQueueMocks.getStoredSessionMock.mockReset();
});

describe('RequestsQueuePage', () => {
  it('renders the initial loading shell with queue chrome for non-auditor users', () => {
    requestsQueueMocks.useLocationMock.mockReturnValue({ pathname: '/admin/requests', search: '', hash: '' });
    requestsQueueMocks.useNavigateMock.mockReturnValue(vi.fn());
    requestsQueueMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });

    const markup = renderToStaticMarkup(<RequestsQueuePage />);

    expect(markup).toContain('requests-queue-hero');
    expect(markup).toContain('requests-create-form');
    expect(markup).toContain('requests-queue-toolbar');
    expect(markup).toContain('Loading request queue...');
    expect(requestsQueueMocks.requestsQueueToolbarMock).toHaveBeenCalledWith(expect.objectContaining({
      viewMode: 'list',
      totalRequests: 0,
      statusFilter: 'all',
      typeFilter: 'all',
    }));
  });

  it('renders a populated support section after queue data loads', async () => {
    requestsQueueMocks.useLocationMock.mockReturnValue({ pathname: '/admin/requests', search: '', hash: '' });
    requestsQueueMocks.useNavigateMock.mockReturnValue(vi.fn());
    requestsQueueMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    requestsQueueMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/requests?')) {
        return {
          items: [
            {
              id: 'request-1',
              type: 'hardware',
              title: 'Battery replacement',
              description: 'system: ops-laptop-01\nasset id: AST-44\nusername: Chris Employee',
              status: 'pending',
              notes: '',
              createdAt: '2026-06-02T08:00:00Z',
              updatedAt: '2026-06-02T09:00:00Z',
              requester: { id: 'user-1', fullName: 'Chris Employee' },
              assignee: {},
              comments: [],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 12,
          summary: {
            pending: 1,
            inProgress: 0,
            resolved: 0,
            enrollment: 0,
            pendingEnrollment: 0,
          },
        };
      }
      if (path.startsWith('/api/users?')) {
        return {
          items: [{ id: 'it-1', fullName: 'Ava Admin', role: 'it_team' }],
          total: 1,
          page: 1,
          pageSize: 200,
        };
      }
      if (path === '/api/settings/workflow') {
        return { ticketAssigneeIds: [] };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const view = await renderPage();
    await flushEffects();
    await flushEffects();

    expect(view.container.textContent).toContain('requests-queue-hero');
    expect(view.container.textContent).toContain('requests-create-form');
    expect(view.container.textContent).toContain('requests-queue-toolbar');
    expect(view.container.textContent).toContain('requests-queue-section:Support Requests');
    expect(view.container.textContent).not.toContain('Loading request queue...');
    expect(requestsQueueMocks.requestsQueueToolbarMock).toHaveBeenLastCalledWith(expect.objectContaining({
      totalRequests: 1,
      requestSummary: expect.objectContaining({ pending: 1 }),
      typeCounts: expect.objectContaining({ all: 1, other: 1 }),
    }));
    expect(requestsQueueMocks.requestsQueueSectionMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Support Requests',
      visibleItems: 1,
    }));

    await view.cleanup();
  });
});