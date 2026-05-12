import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { AlertsRecentTable, selectRecentAlert } from './AlertsRecentTable';

const alerts = [
  {
    id: 'alert-1',
    deviceId: 'device-1',
    hostname: 'ops-laptop-01',
    department: 'IT',
    source: 'wazuh',
    severity: 'critical',
    title: 'Integrity drift detected',
    detail: 'File integrity monitoring detected a change.',
    acknowledged: false,
    resolved: false,
    createdAt: '2026-05-08T08:00:00Z',
  },
  {
    id: 'alert-2',
    deviceId: 'device-2',
    assetName: 'Finance Workstation',
    source: 'clamav',
    sourceLabel: 'ClamScan',
    severity: 'warning',
    title: 'Malware signature found',
    detail: 'A suspicious file matched a known signature.',
    acknowledged: true,
    resolved: false,
    createdAt: '2026-05-08T07:00:00Z',
  },
];

describe('AlertsRecentTable', () => {
  it('renders recent alerts rows with normalized severity and source labels', () => {
    const markup = renderToStaticMarkup(
      <AlertsRecentTable
        alerts={alerts}
        renderSystemName={(alert) => alert.hostname || alert.assetName || alert.deviceId}
        renderSeverityClassName={(alert) => (alert.severity.toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}
        renderSourceLabel={(value) => (value === 'wazuh' ? 'Wazuh' : 'ClamAV')}
        formatDateTime={(value) => value || 'Unknown time'}
      />,
    );

    expect(markup).toContain('Integrity drift detected');
    expect(markup).toContain('ops-laptop-01');
    expect(markup).toContain('Finance Workstation');
    expect(markup).toContain('>critical<');
    expect(markup).toContain('>medium<');
    expect(markup).toContain('>Wazuh<');
    expect(markup).toContain('>ClamScan<');
  });

  it('passes the recent-alert slice when a row is clicked', () => {
    const onSelectAlert = vi.fn();

    selectRecentAlert(alerts[0], alerts, onSelectAlert);

    expect(onSelectAlert).toHaveBeenCalledWith(alerts[0], [alerts[0]]);
  });
});