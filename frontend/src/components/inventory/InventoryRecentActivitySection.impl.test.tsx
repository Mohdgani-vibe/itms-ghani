import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryRecentActivitySection from './InventoryRecentActivitySection.impl';

describe('InventoryRecentActivitySection.impl', () => {
  it('renders the live-workspace recent-activity guidance', () => {
    const markup = renderToStaticMarkup(<InventoryRecentActivitySection />);

    expect(markup).toContain('Inventory Activity');
    expect(markup).toContain('Recent stock movement is shown in the live inventory workspace.');
    expect(markup).toContain('Use the main inventory page to review assignments, stock adjustments, and audit-linked activity.');
  });
});