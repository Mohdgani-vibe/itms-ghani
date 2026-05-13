import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventorySummarySection from './InventorySummarySection.impl';

describe('InventorySummarySection.impl', () => {
  it('renders the live-workspace summary guidance', () => {
    const markup = renderToStaticMarkup(<InventorySummarySection />);

    expect(markup).toContain('Inventory Summary');
    expect(markup).toContain('Inventory totals and branch rollups are available in the live inventory workspace.');
    expect(markup).toContain('Open the inventory module for real-time asset counts, supplier coverage, branch stock, and allocation detail.');
  });
});