import { Download, Upload } from 'lucide-react';

type CsvActionLoading = 'template' | 'minimal-template' | 'export' | '';

interface UserImportsPanelProps {
  csvActionLoading: CsvActionLoading;
  importingUsers: boolean;
  onDownloadMinimalTemplate: () => void;
  onDownloadTemplate: () => void;
  onExportUsers: () => void;
  onOpenImportPicker: () => void;
}

export default function UserImportsPanel({
  csvActionLoading,
  importingUsers,
  onDownloadMinimalTemplate,
  onDownloadTemplate,
  onExportUsers,
  onOpenImportPicker,
}: UserImportsPanelProps) {
  const actionsDisabled = csvActionLoading !== '' || importingUsers;

  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Import / Export</div>
        <h2 className="mt-2 text-xl font-bold text-zinc-900">User CSV tools</h2>
        <p className="mt-1 text-sm text-zinc-600">Use the minimal or extended template, export current users, or import a CSV file.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownloadMinimalTemplate}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'minimal-template' ? 'Downloading...' : 'Download Minimal Template'}
        </button>
        <button
          type="button"
          onClick={onDownloadTemplate}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'template' ? 'Downloading...' : 'Download Extended Template'}
        </button>
        <button
          type="button"
          onClick={onExportUsers}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" />
          {csvActionLoading === 'export' ? 'Exporting...' : 'Export Users'}
        </button>
        <button
          type="button"
          onClick={onOpenImportPicker}
          disabled={actionsDisabled}
          className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="mr-2 h-4 w-4" />
          {importingUsers ? 'Importing...' : 'Import CSV'}
        </button>
      </div>
    </div>
  </div>;
}