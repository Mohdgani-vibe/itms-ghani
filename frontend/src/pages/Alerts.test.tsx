// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const alertsPageMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  useAlertsDerivedStateMock: vi.fn(),
  alertsMainTabsMock: vi.fn(),
  alertsDashboardSourceGridMock: vi.fn(),
  alertsSourceWorkspacePanelMock: vi.fn(),
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
  AlertsDashboardSourceGrid: (props: { onOpenSource: (source: string) => void }) => {
    alertsPageMocks.alertsDashboardSourceGridMock(props);
    return <button type="button" onClick={() => props.onOpenSource('wazuh')}>alerts-dashboard-source-grid</button>;
  },
}));
vi.mock('../components/alerts/AlertsSourceWorkspacePanel', () => ({
  AlertsSourceWorkspacePanel: (props: unknown) => {
    alertsPageMocks.alertsSourceWorkspacePanelMock(props);
    return <div>alerts-source-workspace-panel</div>;
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
vi.mock('../components/alerts/AlertsToolbar', () => ({ AlertsToolbar: () => null }));
vi.mock('../components/alerts/AlertsThreatTimelineChart', () => ({ AlertsThreatTimelineChart: () => <div>alerts-threat-timeline-chart</div> }));
vi.mock('../components/alerts/AlertsMalwareTrendChart', () => ({ AlertsMalwareTrendChart: () => <div>alerts-malware-trend-chart</div> }));
vi.mock('../components/EmbeddedConsoleModal', () => ({ default: () => null }));
vi.mock('../components/PatchRunReportModal', () => ({ default: () => null }));

import Alerts from './Alerts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderAlertsPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(<Alerts />);
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
  alertsPageMocks.useLocationMock.mockReset();
  alertsPageMocks.useNavigateMock.mockReset();
  alertsPageMocks.getStoredSessionMock.mockReset();
  alertsPageMocks.useAlertsDerivedStateMock.mockReset();
  alertsPageMocks.alertsMainTabsMock.mockReset();
  alertsPageMocks.alertsDashboardSourceGridMock.mockReset();
  alertsPageMocks.alertsSourceWorkspacePanelMock.mockReset();
  alertsPageMocks.alertsQueueOverviewCardMock.mockReset();
  alertsPageMocks.alertsFeedPaneMock.mockReset();
});

describe('Alerts', () => {
  it('renders the default dashboard shell before data resolves', () => {
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
    expect(markup).toContain('Source Navigation');
    expect(markup).toContain('Wazuh');
    expect(markup).toContain('OpenSCAP');
    expect(markup).toContain('ClamAV');
    expect(markup).toContain('alerts-dashboard-source-grid');
    expect(markup).not.toContain('alerts-source-workspace-panel');
    expect(alertsPageMocks.alertsMainTabsMock).toHaveBeenCalledWith(expect.objectContaining({
      activeTab: 'dashboard',
    }));
    expect(alertsPageMocks.alertsSourceWorkspacePanelMock).not.toHaveBeenCalled();
  });

  it('passes source card wiring during dashboard server render', () => {
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

    expect(alertsPageMocks.alertsDashboardSourceGridMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      cards: [],
      formatNumber: expect.any(Function),
      onOpenSource: expect.any(Function),
    }));
  });

  it('opens the dedicated source detail view when a source card is clicked', async () => {
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

    const { container, cleanup } = await renderAlertsPage();

    const sourceButton = Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.includes('alerts-dashboard-source-grid'));
    expect(sourceButton).toBeTruthy();

    await act(async () => {
      sourceButton?.click();
    });
    await flushEffects();

    expect(container.textContent).toContain('Source Detail View');
    expect(container.textContent).toContain('Wazuh alert details');
    expect(container.textContent).toContain('alerts-source-workspace-panel');
    expect(alertsPageMocks.alertsSourceWorkspacePanelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'wazuh',
      sourceLabel: 'Wazuh',
      activeView: 'department',
      onSelectAlert: expect.any(Function),
      onOpenSystem: expect.any(Function),
    }));

    await cleanup();
  });

  it('opens the dedicated source detail view from the persistent source subnav', async () => {
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

    const { container, cleanup } = await renderAlertsPage();

    const sourceButton = Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.includes('OpenSCAP'));
    expect(sourceButton).toBeTruthy();

    await act(async () => {
      sourceButton?.click();
    });
    await flushEffects();

    expect(container.textContent).toContain('Source Detail View');
    expect(container.textContent).toContain('OpenSCAP alert details');
    expect(alertsPageMocks.alertsSourceWorkspacePanelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'openscap',
      sourceLabel: 'OpenSCAP',
      activeView: 'department',
    }));

    await cleanup();
  });
});