import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsRelatedFindingsPanel } from './AlertsRelatedFindingsPanel';
import type { AlertsRelatedRecord } from './types';

const relatedAlerts: AlertsRelatedRecord[] = [
  {
    id: 'related-1',
    source: 'wazuh',
    severity: 'high',
    title: 'Integrity drift detected',
    detail: 'System file changed outside approved maintenance window.',
    acknowledged: false,
    resolved: false,
    createdAt: '2026-05-08T02:00:00Z',
  },
];

describe('AlertsRelatedFindingsPanel', () => {
  it('renders related findings cards and count badge', () => {
    const markup = renderToStaticMarkup(
      <AlertsRelatedFindingsPanel
        relatedAlerts={relatedAlerts}
        relatedAlertsLoading={false}
        renderSeverityDotClassName={() => 'bg-rose-500'}
        renderAlertStatusClassName={() => 'bg-amber-100 text-amber-700'}
        renderAlertStatusLabel={() => 'Open'}
        renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
        renderSourceIcon={() => <span>icon</span>}
        renderSourceLabel={(value) => value.toUpperCase()}
        formatRelativeTime={() => '2 hours ago'}
      />,
    );

    expect(markup).toContain('Asset Findings');
    expect(markup).toContain('Integrity drift detected');
    expect(markup).toContain('Open');
    expect(markup).toContain('WAZUH');
    expect(markup).toContain('2 hours ago');
  });

  it('renders empty state copy when no related findings exist', () => {
    const markup = renderToStaticMarkup(
      <AlertsRelatedFindingsPanel
        relatedAlerts={[]}
        relatedAlertsLoading={false}
        renderSeverityDotClassName={() => 'bg-rose-500'}
        renderAlertStatusClassName={() => 'bg-amber-100 text-amber-700'}
        renderAlertStatusLabel={() => 'Open'}
        renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
        renderSourceIcon={() => <span>icon</span>}
        renderSourceLabel={(value) => value.toUpperCase()}
        formatRelativeTime={() => '2 hours ago'}
      />,
    );

    expect(markup).toContain('No additional findings on this asset.');
  });
});