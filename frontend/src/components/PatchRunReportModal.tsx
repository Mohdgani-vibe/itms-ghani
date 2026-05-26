import { CheckCircle2, Download, RefreshCw, XCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { downloadPatchRunReportCsv, downloadPatchRunReportPdf, normalizePatchRunReport, type PatchRunReport } from '../lib/patchReports';

interface PatchRunReportModalProps {
  report: PatchRunReport | null;
  onClose: () => void;
}

function renderUpdatedItems(updatedItems: string[], status: PatchRunReport['rows'][number]['status']) {
  if (updatedItems.length > 0) {
    return updatedItems.join(', ');
  }
  if (status === 'running') {
    return 'Collecting package changes...';
  }
  return 'No package changes reported';
}

function renderPackageChanges(row: PatchRunReport['rows'][number]) {
  if (row.packageChanges.length > 0) {
    return (
      <div className="space-y-2">
        {row.packageChanges.map((change) => (
          <div key={`${row.deviceId}-${change.name}-${change.fromVersion || ''}-${change.toVersion || ''}`} className="rounded-xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-3 py-3 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">{change.name}</div>
            <div className="mt-1 text-xs text-zinc-600">
              {change.fromVersion && change.toVersion ? `${change.fromVersion} -> ${change.toVersion}` : change.toVersion ? `+ ${change.toVersion}` : change.fromVersion ? `${change.fromVersion} -> removed` : 'Version details unavailable'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="text-sm text-zinc-600">{renderUpdatedItems(row.updatedItems, row.status)}</div>;
}

function renderPatchError(message: string, status: PatchRunReport['rows'][number]['status']) {
  if (status === 'failed') {
    return message || 'Patch run failed';
  }
  if (status === 'running') {
    return 'Waiting for Salt result...';
  }
  return message || 'Completed successfully';
}

export default function PatchRunReportModal({ report, onClose }: PatchRunReportModalProps) {
  const normalizedReport = normalizePatchRunReport(report);

  if (!normalizedReport || typeof document === 'undefined') {
    return null;
  }

  const processedCount = normalizedReport.rows.filter((row) => row.status !== 'running').length;
  const totalCount = normalizedReport.totalCount || normalizedReport.rows.length;
  const isRunning = normalizedReport.inProgress === true;
  const hasUpdatedRows = normalizedReport.rows.some((row) => row.updatedItems.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-[6px]">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="patch-run-report-title">
        <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_54%,_#fff8ef_100%)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
                Patch Report
              </div>
              <h2 id="patch-run-report-title" className="mt-3 text-2xl font-black tracking-tight text-zinc-950">Patch Run Report</h2>
              <p className="mt-1 text-sm text-zinc-600">{normalizedReport.scopeLabel} • {processedCount}/{totalCount} device(s) processed</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50">
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Success</div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-emerald-900">
                <CheckCircle2 className="h-5 w-5" />
                {normalizedReport.successCount}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">Failed</div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-rose-900">
                <XCircle className="h-5 w-5" />
                {normalizedReport.failedCount}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{isRunning ? 'Progress' : 'Completed'}</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                {isRunning ? `${processedCount}/${totalCount} finished` : new Date(normalizedReport.completedAt).toLocaleString()}
              </div>
            </div>
          </div>
          {isRunning ? (
            <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm">
              Patch update is running now. This popup will keep filling with device results as each patch call finishes.
            </div>
          ) : null}
        </div>

        <div className="overflow-auto bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-6 py-5">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">System</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">Updated Items</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {normalizedReport.rows.map((row) => (
                <tr key={row.deviceId} className="transition hover:bg-sky-50/30">
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm font-semibold text-zinc-900">{row.hostname}</div>
                    <div className="mt-1 text-xs text-zinc-500">{row.department}</div>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${row.status === 'success' ? 'bg-emerald-100 text-emerald-800' : row.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">{renderPackageChanges(row)}</td>
                  <td className={`px-4 py-3 align-top text-sm ${row.status === 'failed' ? 'text-rose-700' : 'text-zinc-600'}`}>{renderPatchError(row.message, row.status)}</td>
                </tr>
              ))}
              {normalizedReport.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">{isRunning ? 'Waiting for device patch results...' : 'No patch results available.'}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] px-6 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Export report outputs</div>
          <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={isRunning || !hasUpdatedRows} onClick={() => downloadPatchRunReportCsv(normalizedReport, 'updated')} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60">
            <Download className="mr-2 h-4 w-4" />
            Download Updated CSV
          </button>
          <button type="button" disabled={isRunning} onClick={() => { void downloadPatchRunReportPdf(normalizedReport); }} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </button>
          <button type="button" disabled={isRunning} onClick={() => downloadPatchRunReportCsv(normalizedReport)} className="inline-flex items-center rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60">
            <Download className="mr-2 h-4 w-4" />
            Download Full CSV Report
          </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}