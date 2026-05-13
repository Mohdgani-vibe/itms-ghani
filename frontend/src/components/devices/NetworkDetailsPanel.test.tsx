import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import NetworkDetailsPanel from './NetworkDetailsPanel';

describe('NetworkDetailsPanel', () => {
  it('renders summary metrics and interface details', () => {
    const markup = renderToStaticMarkup(
      <NetworkDetailsPanel
        summaryItems={[
          { label: 'Primary IP', value: '10.10.1.22' },
          { label: 'Gateway', value: '10.10.1.1' },
        ]}
        networkInterfaces={[
          ['eth0', { state: 'up', mac: 'aa:bb:cc:dd:ee:ff', mtu: 1500, addresses: ['10.10.1.22/24'] }],
        ]}
        formatDetailValue={(value, fallback = 'Unknown') => value || fallback}
      />,
    );

    expect(markup).toContain('Network');
    expect(markup).toContain('Primary IP');
    expect(markup).toContain('10.10.1.22');
    expect(markup).toContain('eth0');
    expect(markup).toContain('up');
    expect(markup).toContain('aa:bb:cc:dd:ee:ff');
    expect(markup).toContain('1500');
    expect(markup).toContain('10.10.1.22/24');
  });

  it('renders the no-interface fallback', () => {
    const markup = renderToStaticMarkup(
      <NetworkDetailsPanel
        summaryItems={[]}
        networkInterfaces={[]}
        formatDetailValue={(value, fallback = 'Unknown') => value || fallback}
      />,
    );

    expect(markup).toContain('No network interface details are available for this asset.');
  });
});