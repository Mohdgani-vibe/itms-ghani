import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const alertsPageMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  useAlertsDerivedStateMock: vi.fn(),
  alertsMainTabsMock: vi.fn(),
  alertsDashboardSourceGridMock: vi.fn(),
  alertsQueueOverviewCardMock: vi.fn(),
  alertsFeedPaneMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: alertsPageMocks.useLocationMock,
    useNavigate: alertsPageMocks.useNavigateMock,
  };
});

vi.mock('../lib/session', () => ({
  getStoredSession: alertsPageMocks.getStoredSessionMock,
}));

vi.mock('../hooks/useAlertsDerivedState', () => ({
  useAlertsDerivedState: alertsPageMocks.useAlertsDerivedStateMock,
}));

vi.mock('../components/alerts/AlertsMainTabs', () => ({
  AlertsMainTabs: (props: unknown) => {
    alertsPageMocks.alertsMainTabsMock(props);
    return <div>alerts-main-tabs</div>;
  },
}));

vi.mock('../components/alerts/AlertsDashboardSourceGrid', () => ({
  AlertsDashboardSourceGrid: (props: unknown) => {
    alertsPageMocks.alertsDashboardSourceGridMock(props);
    return <div>alerts-dashboard-source-grid</div>;
  },
}));

vi.mock('../components/alerts/AlertsDetailPane', () => ({ AlertsDetailPane: () => null }));
vi.mock('../components/alerts/AlertsFeedPane', () => ({
  AlertsFeedPane: (props: unknown) => {
    alertsPageMocks.alertsFeedPaneMock(props);
    return <div>alerts-feed-pane</div>;
  },
}));
vi.mock('../components/alerts/AlertsQueueOverviewCard', () => ({
  AlertsQueueOverviewCard: (props: unknown) => {
    alertsPageMocks.alertsQueueOverviewCardMock(props);
    return <div>alerts-queue-overview-card</div>;
  },
}));
vi.mock('../components/alerts/AlertsSourceWorkspacePanel', () => ({ AlertsSourceWorkspacePanel: () => null }));
vi.mock('../components/alerts/AlertsToolbar', () => ({ AlertsToolbar: () => null }));
vi.mock('../components/EmbeddedConsoleModal', () => ({ default: () => null }));
vi.mock('../components/PatchRunReportModal', () => ({ default: () => null }));

import Alerts from './Alerts';

describe('Alerts', () => {
  it('renders the default all-alerts shell before data resolves', () => {
    alertsPageMocks.useLocationMock.mockReturnValue({ pathname: '/admin/alerts' });
    alertsPageMocks.useNavigateMock.mockReturnValue(vi.fn());
    alertsPageMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    alertsPageMocks.useAlertsDerivedStateMock.mockReturnValue({
      alerts: [],
      sourceAlerts: { wazuh: [], openscap: [], clamav: [] },
      moduleCards: [],
      summarySourceOptions: [],
      sourceCountMap: {},
      sourceLabelMap: {},
      alertsToolbarTabs: [],
      filteredAlerts: [],
      alertsPageSize: 25,
      paginatedFilteredAlerts: [],
      totalAlerts: 0,
      openAlertsCount: 0,
      acknowledgedAlertsCount: 0,
      resolvedAlertsCount: 0,
      dashboardSourceCards: [],
      recentAlerts: [],
    });

    const markup = renderToStaticMarkup(<Alerts />);

    expect(markup).toContain('Security Alerts');
    expect(markup).toContain('Refresh');
    expect(markup).toContain('alerts-main-tabs');
    expect(markup).toContain('alerts-queue-overview-card');
    expect(markup).toContain('alerts-feed-pane');
    expect(alertsPageMocks.alertsMainTabsMock).toHaveBeenCalledWith(expect.objectContaining({
      activeTab: 'all-alerts',
    }));
    expect(alertsPageMocks.alertsQueueOverviewCardMock).toHaveBeenCalledWith(expect.objectContaining({
      severityFilter: 'all',
    }));
  });

  it('passes initial queue wiring to the alerts feed pane during server render', () => {
    alertsPageMocks.useLocationMock.mockReturnValue({ pathname: '/admin/alerts' });
    alertsPageMocks.useNavigateMock.mockReturnValue(vi.fn());
    alertsPageMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    alertsPageMocks.useAlertsDerivedStateMock.mockReturnValue({
      alerts: [],
      sourceAlerts: { wazuh: [], openscap: [], clamav: [] },
      moduleCards: [],
      summarySourceOptions: [],
      sourceCountMap: {},
      sourceLabelMap: {},
      alertsToolbarTabs: [],
      filteredAlerts: [],
      alertsPageSize: 25,
      paginatedFilteredAlerts: [],
      totalAlerts: 0,
      openAlertsCount: 0,
      acknowledgedAlertsCount: 0,
      resolvedAlertsCount: 0,
      dashboardSourceCards: [],
      recentAlerts: [],
    });

    renderToStaticMarkup(<Alerts />);

    expect(alertsPageMocks.alertsFeedPaneMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      loading: true,
      alerts: [],
      totalAlerts: 0,
      currentPage: 1,
      pageSize: 25,
      onSelectAlert: expect.any(Function),
      renderSystemName: expect.any(Function),
      renderAlertStatusClassName: expect.any(Function),
      renderSourceLabel: expect.any(Function),
      formatRelativeTime: expect.any(Function),
    }));
  });
});