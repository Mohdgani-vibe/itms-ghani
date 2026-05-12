import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsMainTabs } from './AlertsMainTabs';

describe('AlertsMainTabs', () => {
  it('renders the configured tabs and highlights the active one', () => {
    const markup = renderToStaticMarkup(
      <AlertsMainTabs
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'wazuh', label: 'Wazuh' },
          { id: 'all-alerts', label: 'All Alerts' },
        ]}
        activeTab="all-alerts"
        onSelectTab={() => {}}
      />,
    );

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Wazuh');
    expect(markup).toContain('All Alerts');
    expect(markup).toContain('bg-sky-50');
  });
});