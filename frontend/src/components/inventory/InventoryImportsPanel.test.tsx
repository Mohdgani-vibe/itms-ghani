import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryImportsPanel from './InventoryImportsPanel';

describe('InventoryImportsPanel', () => {
  it('renders inventory CSV and stock operation actions', () => {
    const markup = renderToStaticMarkup(
      <InventoryImportsPanel
        csvActionLoading="template"
        importingInventory={false}
        onDownloadTemplate={vi.fn()}
        onExportInventory={vi.fn()}
        onOpenImportPicker={vi.fn()}
        onAddInventory={vi.fn()}
        onOpenStockUpdate={vi.fn()}
        onOpenStockTransfer={vi.fn()}
      />,
    );

    expect(markup).toContain('Import / Export');
    expect(markup).toContain('Inventory CSV tools');
    expect(markup).toContain('Downloading...');
    expect(markup).toContain('Export Inventory');
    expect(markup).toContain('Import CSV');
    expect(markup).toContain('Add Item');
    expect(markup).toContain('Update Stock');
    expect(markup).toContain('Transfer Stock');
    expect(markup).toContain('disabled=""');
  });

  it('renders importing state for the CSV action set', () => {
    const markup = renderToStaticMarkup(
      <InventoryImportsPanel
        csvActionLoading=""
        importingInventory={true}
        onDownloadTemplate={vi.fn()}
        onExportInventory={vi.fn()}
        onOpenImportPicker={vi.fn()}
        onAddInventory={vi.fn()}
        onOpenStockUpdate={vi.fn()}
        onOpenStockTransfer={vi.fn()}
      />,
    );

    expect(markup).toContain('Importing...');
    expect(markup).toContain('disabled=""');
  });
});