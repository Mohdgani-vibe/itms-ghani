import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsDashboardSourceGrid } from './AlertsDashboardSourceGrid';

describe('AlertsDashboardSourceGrid', () => {
  it('renders dashboard source cards with counts and scan timestamps', () => {
    const markup = renderToStaticMarkup(
      <AlertsDashboardSourceGrid
        cards={[
          {
            source: 'wazuh',
            label: 'Wazuh',
            description: 'Endpoint monitoring summary.',
            accentClassName: 'bg-emerald-50 text-emerald-700',
            icon: <span>W</span>,
            scannedCount: 12,
            issueCount: 4,
            issueLabel: 'Findings',
            alertCount: 7,
            systemsAffected: 3,
            healthStatus: 'Critical',
            healthTone: 'critical',
            riskScore: 72,
            lastScanLabel: '5/8/2026, 8:00:00 AM',
            sparklineValues: [2, 4, 3, 7],
          },
          {
            source: 'clamav',
            label: 'ClamAV',
            description: 'Malware detection summary.',
            accentClassName: 'bg-rose-50 text-rose-700',
            icon: <span>C</span>,
            scannedCount: 9,
            issueCount: 1,
            issueLabel: 'Threats',
            alertCount: 3,
            systemsAffected: 1,
            healthStatus: 'Healthy',
            healthTone: 'healthy',
            riskScore: 16,
            lastScanLabel: 'Unknown time',
            sparklineValues: [0, 1, 1, 0],
          },
        ]}
        formatNumber={(value) => String(value ?? 0)}
        onOpenSource={() => {}}
      />,
    );

    expect(markup).toContain('Wazuh');
    expect(markup).toContain('ClamAV');
    expect(markup).toContain('Endpoint monitoring summary.');
    expect(markup).toContain('Malware detection summary.');
    expect(markup).toContain('>12<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('>7<');
    expect(markup).toContain('Threats');
    expect(markup).toContain('Last scan');
    expect(markup).toContain('5/8/2026, 8:00:00 AM');
    expect(markup).toContain('Risk 72');
    expect(markup).toContain('View Alerts');
  });
});