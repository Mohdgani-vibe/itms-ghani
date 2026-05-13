import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryDirectoryListPanel from './InventoryDirectoryListPanel';

describe('InventoryDirectoryListPanel', () => {
  it('renders loading, error, and empty states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <InventoryDirectoryListPanel items={[]} loading={true} error="" onSelect={vi.fn()} />,
    );
    const errorMarkup = renderToStaticMarkup(
      <InventoryDirectoryListPanel items={[]} loading={false} error="Request failed" onSelect={vi.fn()} />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <InventoryDirectoryListPanel items={[]} loading={false} error="" onSelect={vi.fn()} />,
    );

    expect(loadingMarkup).toContain('Loading...');
    expect(errorMarkup).toContain('Request failed');
    expect(emptyMarkup).toContain('No inventory items found.');
  });

  it('renders inventory cards when items are available', () => {
    const markup = renderToStaticMarkup(
      <InventoryDirectoryListPanel
        items={[
          {
            id: 'item-1',
            name: 'Dell Latitude',
            itemCode: 'INV-1001',
            serialNumber: 'SN-001',
            status: 'assigned',
          } as never,
        ]}
        loading={false}
        error=""
        onSelect={vi.fn()}
      />,
    );

    expect(markup).toContain('Dell Latitude');
    expect(markup).toContain('INV-1001 | SN-001');
    expect(markup).toContain('assigned');
  });
});