import { ArrowLeftRight, Download, PackagePlus, TrendingUp, Upload } from 'lucide-react';

import { actionButtonStyles } from '../../lib/buttonStyles';

type CsvActionLoading = 'template' | 'export' | '';

interface InventoryImportsPanelProps {
  csvActionLoading: CsvActionLoading;
  importingInventory: boolean;
  onDownloadTemplate: () => void;
  onExportInventory: () => void;
  onOpenImportPicker: () => void;
  onAddInventory: () => void;
  onOpenStockUpdate: () => void;
  onOpenStockTransfer: () => void;
}

export default function InventoryImportsPanel({
  csvActionLoading,
  importingInventory,
  onDownloadTemplate,
  onExportInventory,
  onOpenImportPicker,
  onAddInventory,
  onOpenStockUpdate,
  onOpenStockTransfer,
}: InventoryImportsPanelProps) {
  const actionsDisabled = csvActionLoading !== '' || importingInventory;

  return <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] p-5 shadow-sm shadow-emerald-100/60">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Import / Export</div>
        <h2 className="mt-2 text-xl font-bold text-zinc-900">Inventory CSV tools</h2>
        <p className="mt-1 text-sm text-zinc-600">Download the inventory template, export current stock, import a CSV file, add an item, or launch stock operations from one place.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownloadTemplate}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'template' ? 'Downloading...' : 'Download Template'}
        </button>
        <button
          type="button"
          onClick={onExportInventory}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'export' ? 'Exporting...' : 'Export Inventory'}
        </button>
        <button
          type="button"
          onClick={onOpenImportPicker}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <Upload className="mr-2 h-4 w-4" />
          {importingInventory ? 'Importing...' : 'Import CSV'}
        </button>
        <button
          type="button"
          onClick={onAddInventory}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          Add Item
        </button>
        <button
          type="button"
          onClick={onOpenStockUpdate}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Update Stock
        </button>
        <button
          type="button"
          onClick={onOpenStockTransfer}
          disabled={actionsDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transfer Stock
        </button>
      </div>
    </div>
  </div>;
}