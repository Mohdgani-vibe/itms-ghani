import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryDetailDrawer from './InventoryDetailDrawer';

describe('InventoryDetailDrawer', () => {
  it('renders the selected inventory item details', () => {
    const markup = renderToStaticMarkup(
      <InventoryDetailDrawer
        item={{
          id: 'item-1',
          name: 'Dell Latitude',
          itemCode: 'INV-1001',
          serialNumber: 'SN-001',
          specs: '16GB RAM',
          warrantyExpiresAt: '2027-05-01',
          cost: '85000',
          status: 'assigned',
        } as never}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Close');
    expect(markup).toContain('Dell Latitude');
    expect(markup).toContain('Item Code: INV-1001');
    expect(markup).toContain('Serial Number: SN-001');
    expect(markup).toContain('Specs: 16GB RAM');
    expect(markup).toContain('Warranty Expires: 2027-05-01');
    expect(markup).toContain('Cost: 85000');
    expect(markup).toContain('Status: assigned');
  });

  it('renders nothing without a selected item', () => {
    const markup = renderToStaticMarkup(<InventoryDetailDrawer item={null} onClose={vi.fn()} />);

    expect(markup).toBe('');
  });
});