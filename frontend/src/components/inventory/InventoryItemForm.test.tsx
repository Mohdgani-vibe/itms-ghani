import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryItemForm from './InventoryItemForm';

describe('InventoryItemForm', () => {
  it('renders the inventory asset form with taxonomy, stock, and save controls', () => {
    const markup = renderToStaticMarkup(
      <InventoryItemForm
        onSave={vi.fn()}
        onCreateMainItem={vi.fn(async () => null)}
        onCreateSubItem={vi.fn(async () => null)}
        onCancel={vi.fn()}
        saving={false}
        branches={[{ id: 'branch-1', name: 'HQ' }] as never[]}
        items={[{ id: 'item-1', name: 'Laptop' }] as never[]}
        subItems={[] as never[]}
        suppliers={[{ id: 'supplier-1', name: 'Dell' }] as never[]}
        entities={[{ id: 'entity-1', full_name: 'Zerodha Pvt Ltd' }] as never[]}
        defaultCompanyName="Zerodha Pvt Ltd"
      />,
    );

    expect(markup).toContain('Main Item');
    expect(markup).toContain('Select main item');
    expect(markup).toContain('Sub Item / Asset Name');
    expect(markup).toContain('Select a main item to load matching sub items.');
    expect(markup).toContain('Entity Company');
    expect(markup).toContain('Zerodha Pvt Ltd');
    expect(markup).toContain('Supplier');
    expect(markup).toContain('Dell');
    expect(markup).toContain('Branch Stock');
    expect(markup).toContain('Total Qty: 1');
    expect(markup).toContain('Save asset');
    expect(markup).toContain('Cancel');
  });
});