import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsHeroSection } from './AlertsHeroSection';

describe('AlertsHeroSection', () => {
  it('renders backend-driven module health cards for alert sources', () => {
    const markup = renderToStaticMarkup(
      <AlertsHeroSection
        feedLabel="Security Operations"
        totalAlerts={42}
        openCount={12}
        acknowledgedCount={8}
        resolvedCount={22}
        sourceCountMap={new Map<string, number>([
          ['wazuh', 7],
          ['openscap', 5],
          ['clamav', 3],
        ])}
        moduleCards={[
          {
            source: 'wazuh',
            label: 'Wazuh Alerts',
            moduleLabel: 'Wazuh',
            totalSystemsScanned: 11,
            cleanSystemsCount: 4,
            errorSystemsCount: 7,
            lastUpdated: '2026-05-02T08:00:00Z',
            statusColor: 'red',
          },
          {
            source: 'openscap',
            label: 'Hardening / OpenSCAP Alerts',
            moduleLabel: 'Hardening / OpenSCAP',
            totalSystemsScanned: 9,
            cleanSystemsCount: 6,
            errorSystemsCount: 3,
            lastUpdated: '2026-05-02T07:00:00Z',
            statusColor: 'yellow',
          },
          {
            source: 'clamav',
            label: 'ClamScan Alerts',
            moduleLabel: 'ClamScan',
            totalSystemsScanned: 8,
            cleanSystemsCount: 8,
            errorSystemsCount: 0,
            lastUpdated: '2026-05-02T06:00:00Z',
            statusColor: 'green',
          },
        ]}
        sourceFilter="all"
        onSelectSourceFilter={() => {}}
        renderSourceIcon={() => null}
      />,
    );

    expect(markup).toContain('Wazuh Alerts');
    expect(markup).toContain('Hardening / OpenSCAP Alerts');
    expect(markup).toContain('ClamScan Alerts');
    expect(markup).toContain('>7<');
    expect(markup).toContain('Systems Scanned');
    expect(markup).toContain('Clean Systems');
    expect(markup).toContain('Error Systems');
    expect(markup).toContain('Infected Systems');
    expect(markup).toContain('Queue 7');
    expect(markup).toContain('Queue 5');
    expect(markup).toContain('Queue 3');
  });
});