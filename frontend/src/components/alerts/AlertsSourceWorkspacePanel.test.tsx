import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsSourceWorkspacePanel } from './AlertsSourceWorkspacePanel';
import type { AlertsDashboardResponse, AlertsListRecord } from './types';

const baseAlerts: AlertsListRecord[] = [
  {
    id: 'alert-1',
    assetId: 'asset-1',
    assetTag: 'AST-1',
    hostname: 'host-1',
    deviceId: 'device-1',
    userName: 'Alex',
    userEmail: 'alex@example.com',
    department: 'IT Operations',
    source: 'clamav',
    severity: 'info',
    title: 'ClamScan scan clean',
    detail: 'Scanned 150 files; infected: 0; errors: 0.',
    acknowledged: false,
    resolved: false,
    createdAt: '2026-05-02T08:00:00Z',
  },
];

const sparseDashboard = {
  source: 'clamav',
  sourceLabel: 'ClamScan',
  filters: {
    department: 'IT Operations',
    search: '',
    status: 'all',
  },
  moduleCards: [
    {
      source: 'clamav',
      label: 'ClamScan Alerts',
      moduleLabel: 'ClamScan',
      totalSystemsScanned: 1,
      cleanSystemsCount: 1,
      errorSystemsCount: 0,
      lastUpdated: '2026-05-02T08:00:00Z',
      statusColor: 'green',
    },
  ],
  trend: {
    dailyBuckets: [
      { date: '', count: 0 },
      { date: '2026-05-02', count: 1 },
    ],
    last7DaysTotal: 1,
    previous7Days: 0,
    trendDirection: 'up',
    trendDelta: 1,
    trendPercent: 100,
  },
  departments: [
    {
      key: 'IT Operations',
      name: 'IT Operations',
      totalSystems: 1,
      cleanCount: 1,
      errorCount: 0,
      lastUpdated: '2026-05-02T08:00:00Z',
    },
  ],
  systems: [
    {
      key: 'asset-1',
      assetId: 'asset-1',
      assetTag: 'AST-1',
      hostname: 'host-1',
      username: 'Alex',
      userEmail: 'alex@example.com',
      department: 'IT Operations',
      module: 'clamav',
      moduleLabel: 'ClamScan',
      status: 'clean',
      errorCount: 0,
      errorDetails: [],
      lastScanAt: '2026-05-02T08:00:00Z',
      latestAlertId: 'alert-1',
      latestTitle: 'ClamScan scan clean',
      latestDetail: 'Scanned 150 files; infected: 0; errors: 0.',
    },
  ],
  report: {
    generatedAt: '2026-05-02T08:05:00Z',
    departmentSummary: [
      {
        key: 'IT Operations',
        name: 'IT Operations',
        totalSystems: 1,
        cleanCount: 1,
        errorCount: 0,
        lastUpdated: '2026-05-02T08:00:00Z',
      },
    ],
    systemStatuses: [
      {
        key: 'asset-1',
        assetId: 'asset-1',
        assetTag: 'AST-1',
        hostname: 'host-1',
        username: 'Alex',
        userEmail: 'alex@example.com',
        department: 'IT Operations',
        module: 'clamav',
        moduleLabel: 'ClamScan',
        status: 'clean',
        errorCount: 0,
        errorDetails: [],
        lastScanAt: '2026-05-02T08:00:00Z',
        latestAlertId: 'alert-1',
        latestTitle: 'ClamScan scan clean',
        latestDetail: 'Scanned 150 files; infected: 0; errors: 0.',
      },
    ],
    errorDetails: [],
    last7DaysTrend: {
      dailyBuckets: [
        { date: '', count: 0 },
        { date: '2026-05-02', count: 1 },
      ],
      last7DaysTotal: 1,
      previous7Days: 0,
      trendDirection: 'up',
      trendDelta: 1,
      trendPercent: 100,
    },
    module: 'clamav',
    moduleLabel: 'ClamScan',
    selectedDepartment: 'IT Operations',
  },
} as AlertsDashboardResponse;

describe('AlertsSourceWorkspacePanel', () => {
  it('renders department view without crashing on sparse dashboard rows', () => {
    const markup = renderToStaticMarkup(
      <AlertsSourceWorkspacePanel
        source="clamav"
        sourceLabel="ClamScan"
        alerts={baseAlerts}
        dashboard={sparseDashboard}
        loading={false}
        error=""
        activeView="department"
        selectedDepartment="IT Operations"
        selectedSystemKey="asset-1"
        onActiveViewChange={() => {}}
        onSelectDepartment={() => {}}
        onSelectSystemKey={() => {}}
        onSelectAlert={() => {}}
        onOpenSystem={() => {}}
        renderSourceIcon={() => null}
        formatRelativeTime={() => 'just now'}
      />,
    );

    expect(markup).toContain('IT Operations systems for ClamScan.');
    expect(markup).toContain('Infected Systems 0');
    expect(markup).toContain('No active errors');
    expect(markup).toContain('Open system details');
    expect(markup).toContain('View Report');
  });

  it('renders reports view without crashing on empty error details and blank trend labels', () => {
    const markup = renderToStaticMarkup(
      <AlertsSourceWorkspacePanel
        source="clamav"
        sourceLabel="ClamScan"
        alerts={baseAlerts}
        dashboard={sparseDashboard}
        loading={false}
        error=""
        activeView="reports"
        selectedDepartment="IT Operations"
        selectedSystemKey="asset-1"
        onActiveViewChange={() => {}}
        onSelectDepartment={() => {}}
        onSelectSystemKey={() => {}}
        onSelectAlert={() => {}}
        onOpenSystem={() => {}}
        renderSourceIcon={() => null}
        formatRelativeTime={() => 'just now'}
      />,
    );

    expect(markup).toContain('Download PDF');
    expect(markup).toContain('Department Summary');
    expect(markup).toContain('Infected Systems 0');
    expect(markup).toContain('No active error details available for this report scope.');
    expect(markup).toContain('System Summary');
  });
});