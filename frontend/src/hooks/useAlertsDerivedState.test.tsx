import { Bug, Shield, ShieldCheck } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useAlertsDerivedState } from './useAlertsDerivedState';

function TestHarness() {
  const state = useAlertsDerivedState({
    alertsData: {
      total: 3,
      items: [
        {
          id: 'alert-1',
          title: 'Salt minion offline',
          detail: 'Connection lost',
          hostname: 'host-1',
          assetTag: 'AST-1',
          assetName: 'Laptop 1',
          department: 'IT',
          userName: 'Alex',
          userEmail: 'alex@example.com',
          source: 'wazuh',
          severity: 'high',
          acknowledged: false,
          resolved: false,
        },
        {
          id: 'alert-2',
          title: 'Compliance drift',
          detail: 'Benchmark mismatch',
          hostname: 'host-2',
          assetTag: 'AST-2',
          assetName: 'Laptop 2',
          department: 'Security',
          userName: 'Sam',
          userEmail: 'sam@example.com',
          source: 'openscap',
          severity: 'medium',
          acknowledged: true,
          resolved: false,
        },
      ],
      summary: {
        open: 1,
        acknowledged: 1,
        resolved: 0,
        sourceCounts: [
          { name: 'wazuh', label: 'Wazuh', count: 1 },
          { name: 'openscap', label: 'OpenSCAP', count: 1 },
        ],
      },
    } as never,
    dashboardData: {
      wazuh: { moduleCards: [{ source: 'wazuh', totalSystemsScanned: 10, errorSystemsCount: 2, lastUpdated: '2026-05-09T00:00:00Z' }] },
      openscap: null,
      clamav: null,
    } as never,
    sourceKeys: ['wazuh', 'openscap', 'clamav'],
    sourceConfig: {
      wazuh: { label: 'Wazuh', description: 'Agent alerts', icon: Shield, accent: 'accent-a', issueShortLabel: 'issues' },
      openscap: { label: 'OpenSCAP', description: 'Compliance alerts', icon: ShieldCheck, accent: 'accent-b', issueShortLabel: 'findings' },
      clamav: { label: 'ClamAV', description: 'Malware alerts', icon: Bug, accent: 'accent-c', issueShortLabel: 'detections' },
    },
    searchQuery: 'salt',
    severityFilter: 'high',
    sourceFilter: 'wazuh',
    alertsPage: 1,
    formatDateTime: (value) => `DATE:${value ?? ''}`,
    normalizeSeverity: (value) => ((value || '').toLowerCase() || 'low') as never,
    normalizeSourceKey: (value) => (value || '').toLowerCase(),
    sourceLabel: (value, fallback) => fallback || value.toUpperCase(),
  });

  return (
    <div>
      <div>filtered:{state.filteredAlerts.length}</div>
      <div>paged:{state.paginatedFilteredAlerts.length}</div>
      <div>open:{state.openAlertsCount}</div>
      <div>ack:{state.acknowledgedAlertsCount}</div>
      <div>resolved:{state.resolvedAlertsCount}</div>
      <div>tabs:{state.alertsToolbarTabs.map((tab) => tab.label).join('|')}</div>
      <div>card:{state.dashboardSourceCards[0]?.label}:{state.dashboardSourceCards[0]?.scannedCount}:{state.dashboardSourceCards[0]?.lastScanLabel}</div>
      <div>recent:{state.recentAlerts.length}</div>
    </div>
  );
}

describe('useAlertsDerivedState', () => {
  it('derives filtered alert data, tabs, summary counts, and dashboard cards', () => {
    const markup = renderToStaticMarkup(<TestHarness />);

    expect(markup).toContain('filtered:1');
    expect(markup).toContain('paged:1');
    expect(markup).toContain('open:1');
    expect(markup).toContain('ack:1');
    expect(markup).toContain('resolved:0');
    expect(markup).toContain('tabs:All Alerts|Wazuh|OpenSCAP');
    expect(markup).toContain('card:Wazuh:10:DATE:2026-05-09T00:00:00Z');
    expect(markup).toContain('recent:2');
  });
});