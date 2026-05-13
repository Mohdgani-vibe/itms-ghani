import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryItemDetailDrawer from './InventoryItemDetailDrawer.impl';

describe('InventoryItemDetailDrawer', () => {
  it('renders asset tag and formatted cost when present', () => {
    const markup = renderToStaticMarkup(
      <InventoryItemDetailDrawer
        item={{
          id: 'inventory-1',
          itemCode: 'INV-001',
          name: 'Dell Latitude 7450',
          assetTag: 'AST-445',
          serialNumber: 'SN-7788',
          status: 'in_stock',
          specs: '',
          warrantyExpiresAt: '',
          cost: '84500',
        }}
      />,
    );

    expect(markup).toContain('Dell Latitude 7450 Details');
    expect(markup).toContain('AST-445');
    expect(markup).toContain('SN-7788');
    expect(markup).toContain('in_stock');
    expect(markup).toContain('₹84,500');
  });

  it('renders fallback values when optional inventory fields are missing', () => {
    const markup = renderToStaticMarkup(
      <InventoryItemDetailDrawer
        item={{
          id: 'inventory-2',
          itemCode: 'INV-002',
          name: 'Spare Monitor',
          serialNumber: '',
          specs: '',
          warrantyExpiresAt: '',
          status: '',
        }}
      />,
    );

    expect(markup).toContain('Asset ID / Tag:</b> Not set');
    expect(markup).toContain('Serial Number:</b> Not set');
    expect(markup).toContain('Status:</b> Unknown');
    expect(markup).toContain('Price / Cost:</b> Not set');
    expect(markup).toContain('Audit history is not available in this panel.');
  });
});