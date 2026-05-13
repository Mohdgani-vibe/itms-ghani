import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventorySummarySection from './InventorySummarySection';

describe('InventorySummarySection', () => {
  it('renders the forwarded summary guidance content', () => {
    const markup = renderToStaticMarkup(<InventorySummarySection />);

    expect(markup).toContain('Inventory Summary');
    expect(markup).toContain('Inventory totals and branch rollups are available in the live inventory workspace.');
  });
});