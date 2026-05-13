import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryPage from './InventoryPage';

describe('InventoryPage', () => {
  it('renders the inventory workspace shell and initial assets view', () => {
    const markup = renderToStaticMarkup(<InventoryPage />);

    expect(markup).toContain('Inventory Management');
    expect(markup).toContain('Inventory and asset control by branch');
    expect(markup).toContain('Manage assets, stock movement, catalog definitions, suppliers, branches, imports, audit history, and direct user assignment from one workspace.');
    expect(markup).toContain('Inventory CSV tools');
    expect(markup).toContain('Download Template');
    expect(markup).toContain('Export Inventory');
    expect(markup).toContain('Import CSV');
    expect(markup).toContain('Add Item');
    expect(markup).toContain('Update Stock');
    expect(markup).toContain('Transfer Stock');
    expect(markup).toContain('Assets');
    expect(markup).toContain('Catalog');
    expect(markup).toContain('Branches');
    expect(markup).toContain('Suppliers');
    expect(markup).toContain('Audit');
    expect(markup).toContain('Asset register');
    expect(markup).toContain('Tracked assets, branch stock, assignment and purchase details.');
    expect(markup).toContain('Search asset tag, serial, item, branch');
    expect(markup).toContain('Loading...');
  });
});