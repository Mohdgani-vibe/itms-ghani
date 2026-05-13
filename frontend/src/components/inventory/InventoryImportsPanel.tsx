import { ArrowLeftRight, Download, PackagePlus, TrendingUp, Upload } from 'lucide-react';

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

  return <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-sky-100/60">
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
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'template' ? 'Downloading...' : 'Download Template'}
        </button>
        <button
          type="button"
          onClick={onExportInventory}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'export' ? 'Exporting...' : 'Export Inventory'}
        </button>
        <button
          type="button"
          onClick={onOpenImportPicker}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="mr-2 h-4 w-4" />
          {importingInventory ? 'Importing...' : 'Import CSV'}
        </button>
        <button
          type="button"
          onClick={onAddInventory}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          Add Item
        </button>
        <button
          type="button"
          onClick={onOpenStockUpdate}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Update Stock
        </button>
        <button
          type="button"
          onClick={onOpenStockTransfer}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transfer Stock
        </button>
      </div>
    </div>
  </div>;
}