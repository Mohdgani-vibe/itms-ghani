import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SecurityFindingsPanel from './SecurityFindingsPanel';

describe('SecurityFindingsPanel', () => {
  it('renders latest finding details and ClamScan title normalization', () => {
    const markup = renderToStaticMarkup(
      <SecurityFindingsPanel
        title="Malware Findings"
        description="Recent endpoint detections and scans."
        alerts={[
          {
            id: 'alert-1',
            source: 'clamav',
            severity: 'high',
            title: 'ClamAV malware detected',
            detail: 'Trojan signature found in downloads.',
            acknowledged: false,
            resolved: false,
            createdAt: '2026-05-08T10:00:00Z',
          },
          {
            id: 'alert-2',
            source: 'wazuh',
            severity: 'medium',
            title: 'Integrity drift detected',
            detail: 'Critical system file changed unexpectedly.',
            acknowledged: true,
            resolved: false,
            createdAt: '2026-05-08T09:00:00Z',
          },
        ]}
        loading={false}
        emptyMessage="No findings"
        onSelectAlert={() => {}}
        alertStatusBadgeClassName={(alert) => alert.resolved ? 'bg-emerald-100' : alert.acknowledged ? 'bg-amber-100' : 'bg-rose-100'}
        alertStatusLabel={(alert) => alert.resolved ? 'Resolved' : alert.acknowledged ? 'Acknowledged' : 'Open'}
        severityBadgeClassName={() => 'bg-rose-100 text-rose-700'}
        alertSourceLabel={(source) => source === 'clamav' ? 'ClamScan' : source}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Malware Findings');
    expect(markup).toContain('Recent endpoint detections and scans.');
    expect(markup).toContain('2 recent');
    expect(markup).toContain('ClamScan malware detected');
    expect(markup).toContain('Open');
    expect(markup).toContain('08 May 2026');
    expect(markup).toContain('Trojan signature found in downloads.');
    expect(markup).toContain('Click for full details');
    expect(markup).toContain('Integrity drift detected');
    expect(markup).toContain('Acknowledged');
  });

  it('renders loading and empty states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <SecurityFindingsPanel
        title="Hardening Findings"
        description="Baseline compliance drift."
        alerts={[]}
        loading={true}
        emptyMessage="No hardening alerts"
        onSelectAlert={() => {}}
        alertStatusBadgeClassName={() => 'bg-zinc-100'}
        alertStatusLabel={() => 'Open'}
        severityBadgeClassName={() => 'bg-zinc-100'}
        alertSourceLabel={(source) => source}
        formatDate={() => 'Unknown'}
      />,
    );

    const emptyMarkup = renderToStaticMarkup(
      <SecurityFindingsPanel
        title="Hardening Findings"
        description="Baseline compliance drift."
        alerts={[]}
        loading={false}
        emptyMessage="No hardening alerts"
        onSelectAlert={() => {}}
        alertStatusBadgeClassName={() => 'bg-zinc-100'}
        alertStatusLabel={() => 'Open'}
        severityBadgeClassName={() => 'bg-zinc-100'}
        alertSourceLabel={(source) => source}
        formatDate={() => 'Unknown'}
      />,
    );

    expect(loadingMarkup).toContain('Loading hardening findings...');
    expect(emptyMarkup).toContain('No recent hardening findings');
    expect(emptyMarkup).toContain('No timestamp available');
    expect(emptyMarkup).toContain('No hardening alerts');
  });
});