import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import OtherAlertsPanel from './OtherAlertsPanel';

describe('OtherAlertsPanel', () => {
  it('renders alert cards with source, severity, status, and details', () => {
    const markup = renderToStaticMarkup(
      <OtherAlertsPanel
        alerts={[
          {
            id: 'alert-1',
            source: 'lifecycle',
            severity: 'medium',
            title: 'Warranty expiration approaching',
            detail: 'This asset warranty expires in 30 days.',
            acknowledged: false,
            resolved: false,
            createdAt: '2026-05-08T09:00:00Z',
          },
        ]}
        loading={false}
        onSelectAlert={vi.fn()}
        alertSourceLabel={(source) => source === 'lifecycle' ? 'Lifecycle' : source}
        severityBadgeClassName={() => 'bg-amber-100 text-amber-700'}
        alertStatusBadgeClassName={() => 'bg-rose-100 text-rose-700'}
        alertStatusLabel={() => 'Open'}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Other Alerts');
    expect(markup).toContain('1 recent');
    expect(markup).toContain('Warranty expiration approaching');
    expect(markup).toContain('Lifecycle');
    expect(markup).toContain('08 May 2026');
    expect(markup).toContain('medium');
    expect(markup).toContain('Open');
    expect(markup).toContain('This asset warranty expires in 30 days.');
    expect(markup).toContain('Click for full details');
  });

  it('renders loading and empty states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <OtherAlertsPanel
        alerts={[]}
        loading={true}
        onSelectAlert={vi.fn()}
        alertSourceLabel={(source) => source}
        severityBadgeClassName={() => 'bg-zinc-100'}
        alertStatusBadgeClassName={() => 'bg-zinc-100'}
        alertStatusLabel={() => 'Open'}
        formatDate={() => 'Unknown'}
      />,
    );

    const emptyMarkup = renderToStaticMarkup(
      <OtherAlertsPanel
        alerts={[]}
        loading={false}
        onSelectAlert={vi.fn()}
        alertSourceLabel={(source) => source}
        severityBadgeClassName={() => 'bg-zinc-100'}
        alertStatusBadgeClassName={() => 'bg-zinc-100'}
        alertStatusLabel={() => 'Open'}
        formatDate={() => 'Unknown'}
      />,
    );

    expect(loadingMarkup).toContain('Loading alerts...');
    expect(emptyMarkup).toContain('No additional operational alerts for this asset.');
  });
});