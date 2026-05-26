import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsStatusStrip } from './AlertsStatusStrip';

describe('AlertsStatusStrip', () => {
  it('renders the refresh control, summary text, and blocking error banner', () => {
    const markup = renderToStaticMarkup(
      <AlertsStatusStrip
        loading
        alertsError="Failed to load alerts"
        hasAlertsData={false}
        totalAlertsLabel="42 alerts visible across configured sources"
        liveLabel="Refreshing live telemetry"
        lastUpdatedLabel="2 min ago"
        notificationCount={3}
        onRefresh={() => {}}
      />,
    );

    expect(markup).toContain('Refresh');
    expect(markup).toContain('animate-spin');
    expect(markup).toContain('Failed to load alerts');
    expect(markup).toContain('bg-rose-50');
  });
});