import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryRegistry from './InventoryRegistry.impl';

describe('InventoryRegistry', () => {
  it('renders the live-workspace empty state copy', () => {
    const markup = renderToStaticMarkup(<InventoryRegistry />);

    expect(markup).toContain('Inventory Registry');
    expect(markup).toContain('Registry records are served from the live inventory workspace.');
    expect(markup).toContain('Open the main inventory page to review real assets, serials, branch stock, and assignment state.');
  });
});