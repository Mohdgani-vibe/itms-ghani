import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsQueueOverviewCard } from './AlertsQueueOverviewCard';

describe('AlertsQueueOverviewCard', () => {
  it('renders the all-alerts overview copy and severity options', () => {
    const markup = renderToStaticMarkup(
      <AlertsQueueOverviewCard
        severityFilter="high"
        severityOptions={['all', 'critical', 'high', 'medium', 'low']}
        onSeverityFilterChange={() => {}}
        onBackToDashboard={() => {}}
      />,
    );

    expect(markup).toContain('All Alerts');
    expect(markup).toContain('Back to Dashboard');
    expect(markup).toContain('Severity filter');
    expect(markup).toContain('All severities');
    expect(markup).toContain('Critical');
    expect(markup).toContain('High');
  });
});