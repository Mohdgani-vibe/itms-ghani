import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/it/alerts', search: '?tab=open' }),
}));

import NavigationMetrics from './NavigationMetrics';

describe('NavigationMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the latest seeded navigation metrics overlay', () => {
    vi.stubGlobal('window', {
      __ITMS_NAV_METRICS__: [
        {
          from: '/it/dashboard',
          to: '/it/requests',
          source: 'pushState',
          startedAt: 10,
          completedAt: 32.5,
          durationMs: 22.5,
        },
        {
          from: '/it/requests',
          to: '/it/alerts?tab=open',
          source: 'location-change',
          startedAt: 40,
          completedAt: 58.4,
          durationMs: 18.4,
        },
      ],
    });

    const markup = renderToStaticMarkup(<NavigationMetrics />);

    expect(markup).toContain('Navigation Metrics');
    expect(markup).toContain('18.4ms');
    expect(markup).toContain('/it/alerts?tab=open');
    expect(markup).toContain('p50 18.4ms');
    expect(markup).toContain('p95 22.5ms');
    expect(markup).toContain('2 entries');
    expect(markup).toContain('Show');
  });
});