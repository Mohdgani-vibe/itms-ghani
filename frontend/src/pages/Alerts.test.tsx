import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const alertsPageMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  useAlertsDerivedStateMock: vi.fn(),
  alertsHeroSectionMock: vi.fn(),
  alertsStatusStripMock: vi.fn(),
  alertsMainTabsMock: vi.fn(),
  alertsDashboardSourceGridMock: vi.fn(),
  alertsRecentTableMock: vi.fn(),
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

vi.mock('../components/alerts/AlertsHeroSection', () => ({
  AlertsHeroSection: (props: unknown) => {
    alertsPageMocks.alertsHeroSectionMock(props);
    return <div>alerts-hero-section</div>;
  },
}));

vi.mock('../components/alerts/AlertsStatusStrip', () => ({
  AlertsStatusStrip: (props: unknown) => {
    alertsPageMocks.alertsStatusStripMock(props);
    return <div>alerts-status-strip</div>;
  },
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
vi.mock('../components/alerts/AlertsFeedPane', () => ({ AlertsFeedPane: () => null }));
vi.mock('../components/alerts/AlertsQueueOverviewCard', () => ({ AlertsQueueOverviewCard: () => null }));
vi.mock('../components/alerts/AlertsRecentTable', () => ({
  AlertsRecentTable: (props: unknown) => {
    alertsPageMocks.alertsRecentTableMock(props);
    return <div>alerts-recent-table</div>;
  },
}));
vi.mock('../components/alerts/AlertsSourceWorkspacePanel', () => ({ AlertsSourceWorkspacePanel: () => null }));
vi.mock('../components/alerts/AlertsToolbar', () => ({ AlertsToolbar: () => null }));
vi.mock('../components/EmbeddedConsoleModal', () => ({ default: () => null }));
vi.mock('../components/PatchRunReportModal', () => ({ default: () => null }));

import Alerts from './Alerts';

describe('Alerts', () => {
  it('renders the default dashboard shell with overview chrome before data resolves', () => {
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

    expect(markup).toContain('alerts-hero-section');
    expect(markup).toContain('alerts-status-strip');
    expect(markup).toContain('alerts-main-tabs');
    expect(markup).toContain('alerts-dashboard-source-grid');
    expect(markup).toContain('Recent Alerts');
    expect(markup).toContain('No recent alerts');
    expect(alertsPageMocks.alertsMainTabsMock).toHaveBeenCalledWith(expect.objectContaining({
      activeTab: 'dashboard',
    }));
    expect(alertsPageMocks.alertsStatusStripMock).toHaveBeenCalledWith(expect.objectContaining({
      loading: true,
      totalAlertsLabel: '0 alerts visible across configured sources',
    }));
  });

  it('passes recent dashboard alerts and drawer wiring to the recent alerts table', () => {
    const recentAlerts = [
      {
        id: 'alert-1',
        assetId: 'asset-1',
        deviceId: 'device-1',
        hostname: 'itteam',
        department: 'IT Operations',
        source: 'openscap',
        sourceLabel: 'OpenSCAP Hardening',
        severity: 'medium',
        title: 'OpenSCAP hardening findings',
        detail: 'OpenSCAP findings present.',
        acknowledged: false,
        resolved: false,
        createdAt: '2026-05-12T10:00:00Z',
      },
    ];

    alertsPageMocks.useLocationMock.mockReturnValue({ pathname: '/admin/alerts' });
    alertsPageMocks.useNavigateMock.mockReturnValue(vi.fn());
    alertsPageMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    alertsPageMocks.useAlertsDerivedStateMock.mockReturnValue({
      alerts: recentAlerts,
      sourceAlerts: { wazuh: [], openscap: recentAlerts, clamav: [] },
      moduleCards: [],
      summarySourceOptions: [],
      sourceCountMap: {},
      sourceLabelMap: {},
      alertsToolbarTabs: [],
      filteredAlerts: recentAlerts,
      alertsPageSize: 25,
      paginatedFilteredAlerts: recentAlerts,
      totalAlerts: 1,
      openAlertsCount: 1,
      acknowledgedAlertsCount: 0,
      resolvedAlertsCount: 0,
      dashboardSourceCards: [],
      recentAlerts,
    });

    renderToStaticMarkup(<Alerts />);

    expect(alertsPageMocks.alertsRecentTableMock).toHaveBeenCalledWith(expect.objectContaining({
      alerts: recentAlerts,
      onSelectAlert: expect.any(Function),
    }));
  });
});