import { Download, FolderOpen, Funnel, Search } from 'lucide-react';

import { actionButtonStyles } from '../../lib/buttonStyles';

type PatchRunReportDateRange = 'all' | '7d' | '30d' | '90d';
type PatchRunReportSort = 'newest' | 'oldest' | 'most-failures' | 'most-successes';

interface PatchRunReportSummaryItem {
  id: string;
  scopeLabel: string;
  failedCount: number;
  completedAt: string;
  successCount: number;
  rowCount: number;
  departments: string[];
  requestedBy?: string | null;
}

interface PatchRecentReportsPanelProps {
  reportDepartmentFilter: string;
  reportDepartmentOptions: string[];
  reportDateRange: PatchRunReportDateRange;
  reportSearchQuery: string;
  reportSort: PatchRunReportSort;
  filteredReportCount: number;
  showAllReports: boolean;
  visibleRecentReports: PatchRunReportSummaryItem[];
  openingReportId: string;
  downloadingReportId: string;
  onReportDepartmentFilterChange: (value: string) => void;
  onReportDateRangeChange: (value: PatchRunReportDateRange) => void;
  onReportSearchQueryChange: (value: string) => void;
  onReportSortChange: (value: PatchRunReportSort) => void;
  onResetFilters: () => void;
  onToggleShowAllReports: () => void;
  onOpenReport: (reportId: string) => void;
  onDownloadReport: (reportId: string) => void;
}

export default function PatchRecentReportsPanel({
  reportDepartmentFilter,
  reportDepartmentOptions,
  reportDateRange,
  reportSearchQuery,
  reportSort,
  filteredReportCount,
  showAllReports,
  visibleRecentReports,
  openingReportId,
  downloadingReportId,
  onReportDepartmentFilterChange,
  onReportDateRangeChange,
  onReportSearchQueryChange,
  onReportSortChange,
  onResetFilters,
  onToggleShowAllReports,
  onOpenReport,
  onDownloadReport,
}: PatchRecentReportsPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent Reports</div>
      <h2 className="mt-2 text-lg font-black text-slate-950">Saved patch runs</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Keep recent execution history close to the device queue without turning this page into a full archive screen.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500">
          Department
          <select value={reportDepartmentFilter} onChange={(event) => onReportDepartmentFilterChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            {reportDepartmentOptions.map((department) => (
              <option key={department} value={department}>{department === 'all' ? 'All departments' : department}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Date range
          <select value={reportDateRange} onChange={(event) => onReportDateRangeChange(event.target.value as PatchRunReportDateRange)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Sort
          <select value={reportSort} onChange={(event) => onReportSortChange(event.target.value as PatchRunReportSort)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most-failures">Most failures</option>
            <option value="most-successes">Most successes</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 sm:col-span-2">
          Search
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input
              type="text"
              value={reportSearchQuery}
              onChange={(event) => onReportSearchQueryChange(event.target.value)}
              placeholder="Search scope, department, requester"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900"
            />
          </div>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Funnel className="h-3.5 w-3.5" />
        {filteredReportCount} report(s) match the current filters.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Reset Filters
        </button>
        {filteredReportCount > 5 ? (
          <button
            type="button"
            onClick={onToggleShowAllReports}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {showAllReports ? 'Show Less' : `Show All (${filteredReportCount})`}
          </button>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {filteredReportCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No saved patch reports yet.</div>
        ) : visibleRecentReports.map((reportItem) => (
          <div key={reportItem.id} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{reportItem.scopeLabel}</div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${reportItem.failedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {reportItem.failedCount > 0 ? `${reportItem.failedCount} failed` : 'all successful'}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{new Date(reportItem.completedAt).toLocaleString()} • {reportItem.successCount}/{reportItem.rowCount} succeeded</div>
            <div className="mt-2 text-xs text-slate-500">{reportItem.departments.join(', ') || 'Unassigned'}{reportItem.requestedBy ? ` • ${reportItem.requestedBy}` : ''}</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenReport(reportItem.id)}
                disabled={openingReportId === reportItem.id}
                className={`inline-flex items-center rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.save}`}
              >
                <FolderOpen className="mr-1.5 h-4 w-4" />
                {openingReportId === reportItem.id ? 'Opening...' : 'Open report'}
              </button>
              <button
                type="button"
                onClick={() => onDownloadReport(reportItem.id)}
                disabled={downloadingReportId === reportItem.id}
                className={`inline-flex items-center rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {downloadingReportId === reportItem.id ? 'Downloading...' : 'Download CSV'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}