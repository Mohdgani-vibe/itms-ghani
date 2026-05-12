import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsFeedPane } from './AlertsFeedPane';

describe('AlertsFeedPane', () => {
  it('renders the loading state and read-only review copy', () => {
    const markup = renderToStaticMarkup(
      <AlertsFeedPane
        loading={true}
        alerts={[]}
        selectedAlertId=""
        readOnlyReview={true}
        onSelectAlert={() => {}}
        totalAlerts={0}
        currentPage={1}
        pageSize={25}
        onPageChange={() => {}}
        renderSystemName={(alert) => alert.hostname || 'Unknown system'}
        renderAlertStatusClassName={() => 'bg-rose-100 text-rose-700'}
        renderAlertStatusLabel={() => 'Open'}
        renderSeverityDotClassName={() => 'bg-rose-500'}
        formatRelativeTime={() => 'just now'}
        renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
        renderSourceIcon={() => <span>icon</span>}
        renderSourceLabel={(value) => value.toUpperCase()}
        renderAlertAsset={(alert) => alert.assetTag || alert.deviceId}
      />,
    );

    expect(markup).toContain('Alert Feed');
    expect(markup).toContain('Review incidents by source and inspect the selected asset from the detail panel.');
    expect(markup).toContain('Loading alerts...');
  });

  it('renders alert cards, clam metrics, and pagination summary', () => {
    const markup = renderToStaticMarkup(
      <AlertsFeedPane
        loading={false}
        alerts={[
          {
            id: 'alert-1',
            assetId: 'asset-1',
            assetTag: 'AST-100',
            hostname: 'ops-laptop-01',
            deviceId: 'device-1',
            source: 'clamav',
            sourceLabel: 'ClamScan',
            severity: 'critical',
            title: 'Malware detected in downloads',
            detail: 'Scanned 70436 files; infected: 2; errors: 1. ---------- SCAN SUMMARY ---------- Known viruses: 3627837 Paths: /home,/etc',
            acknowledged: false,
            resolved: false,
            createdAt: '2026-05-08T10:00:00Z',
          },
          {
            id: 'alert-2',
            assetId: 'asset-2',
            assetTag: 'AST-101',
            hostname: 'ops-laptop-02',
            deviceId: 'device-2',
            source: 'wazuh',
            severity: 'high',
            title: 'Integrity drift detected',
            detail: 'Critical system file changed unexpectedly.',
            acknowledged: true,
            resolved: false,
            createdAt: '2026-05-08T09:30:00Z',
          },
        ]}
        selectedAlertId="alert-1"
        onSelectAlert={() => {}}
        totalAlerts={30}
        currentPage={2}
        pageSize={25}
        onPageChange={() => {}}
        renderSystemName={(alert) => alert.hostname || 'Unknown system'}
        renderAlertStatusClassName={(alert) => alert.acknowledged ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}
        renderAlertStatusLabel={(alert) => alert.acknowledged ? 'Acknowledged' : 'Open'}
        renderSeverityDotClassName={(alert) => alert.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}
        formatRelativeTime={() => '2 hr ago'}
        renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
        renderSourceIcon={() => <span>icon</span>}
        renderSourceLabel={(value) => value.toUpperCase()}
        renderAlertAsset={(alert) => alert.assetTag || alert.deviceId}
      />,
    );

    expect(markup).toContain('30 tracked');
    expect(markup).toContain('ops-laptop-01');
    expect(markup).toContain('Malware detected in downloads');
    expect(markup).toContain('AST-100');
    expect(markup).toContain('Infected 2');
    expect(markup).toContain('Errors 1');
    expect(markup).toContain('70,436 scanned');
    expect(markup).toContain('Integrity drift detected');
    expect(markup).toContain('Acknowledged');
    expect(markup).toContain('Showing ');
    expect(markup).toContain('26');
    expect(markup).toContain('30');
    expect(markup).toContain('alerts');
    expect(markup).toContain('Previous');
    expect(markup).toContain('Next');
  });

  it('renders the empty-state message when there are no alerts', () => {
    const markup = renderToStaticMarkup(
      <AlertsFeedPane
        loading={false}
        alerts={[]}
        selectedAlertId=""
        onSelectAlert={() => {}}
        totalAlerts={0}
        currentPage={1}
        pageSize={25}
        onPageChange={() => {}}
        renderSystemName={(alert) => alert.hostname || 'Unknown system'}
        renderAlertStatusClassName={() => 'bg-rose-100 text-rose-700'}
        renderAlertStatusLabel={() => 'Open'}
        renderSeverityDotClassName={() => 'bg-rose-500'}
        formatRelativeTime={() => 'just now'}
        renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
        renderSourceIcon={() => <span>icon</span>}
        renderSourceLabel={(value) => value.toUpperCase()}
        renderAlertAsset={(alert) => alert.assetTag || alert.deviceId}
      />,
    );

    expect(markup).toContain('No alerts found.');
  });
});