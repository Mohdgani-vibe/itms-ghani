import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const requestsQueueMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  requestsQueueHeroMock: vi.fn(),
  requestsCreateFormMock: vi.fn(),
  requestsQueueToolbarMock: vi.fn(),
}));

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

vi.mock('../../components/requests/RequestsBulkTriagePanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailCommentsPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailControlsPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestEnrollmentReviewPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailInfoPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestDetailOverviewPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestQueueTableRow', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestSelectedDetailPanel', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestsQueueEmptyState', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestsQueueSection', () => ({ default: () => null }));
vi.mock('../../components/requests/RequestsQueueTablePanel', () => ({ default: () => null }));
vi.mock('../../components/Pagination', () => ({ default: () => null }));

import RequestsQueuePage from './RequestsQueuePage';

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
});