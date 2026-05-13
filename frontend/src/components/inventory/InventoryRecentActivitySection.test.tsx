import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryRecentActivitySection from './InventoryRecentActivitySection';

describe('InventoryRecentActivitySection', () => {
  it('renders the forwarded recent-activity guidance content', () => {
    const markup = renderToStaticMarkup(<InventoryRecentActivitySection />);

    expect(markup).toContain('Inventory Activity');
    expect(markup).toContain('Recent stock movement is shown in the live inventory workspace.');
  });
});