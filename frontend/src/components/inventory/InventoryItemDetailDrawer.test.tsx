import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryItemDetailDrawer from './InventoryItemDetailDrawer';

describe('InventoryItemDetailDrawer', () => {
  it('renders the forwarded item detail content', () => {
    const markup = renderToStaticMarkup(
      <InventoryItemDetailDrawer
        item={{
          id: 'item-1',
          itemCode: 'INV-1001',
          name: 'Docking Station',
          assetTag: 'INV-1001',
          serialNumber: 'SN-001',
          specs: '',
          warrantyExpiresAt: '',
          status: 'assigned',
          cost: '85000',
        } as never}
      />,
    );

    expect(markup).toContain('INV-1001');
    expect(markup).toContain('SN-001');
    expect(markup).toContain('assigned');
    expect(markup).toContain('₹85,000');
  });
});