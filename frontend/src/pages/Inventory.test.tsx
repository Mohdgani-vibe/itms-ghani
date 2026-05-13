import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../components/inventory/InventoryPage', () => ({
  default: () => <div>inventory-page-alias-target</div>,
}));

import Inventory from './Inventory';

describe('Inventory', () => {
  it('re-exports the inventory page component', () => {
    const markup = renderToStaticMarkup(<Inventory />);

    expect(markup).toContain('inventory-page-alias-target');
  });
});