import { Clock3, Filter, Search, Sparkles, UserPlus } from 'lucide-react';

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All request types' },
  { value: 'device_enrollment', label: 'Enrollment reviews' },
  { value: 'other', label: 'Other requests' },
] as const;

type QueueViewMode = 'list' | 'table';

interface RequestSummary {
  pending: number;
  inProgress: number;
  resolved: number;
}

interface TypeCounts {
  all: number;
  device_enrollment: number;
  other: number;
}

interface RequestsQueueToolbarProps {
  searchQuery: string;
  typeFilter: string;
  statusFilter: string;
  totalRequests: number;
  requestSummary: RequestSummary;
  typeCounts: TypeCounts;
  activeTypeLabel: string;
  activeStatusLabel: string;
  viewMode: QueueViewMode;
  unassignedCount: number;
  needsReviewCount: number;
  recentActivityCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onViewModeChange: (value: QueueViewMode) => void;
}

export default function RequestsQueueToolbar({
  searchQuery,
  typeFilter,
  statusFilter,
  totalRequests,
  requestSummary,
  typeCounts,
  activeTypeLabel,
  activeStatusLabel,
  unassignedCount,
  needsReviewCount,
  recentActivityCount,
  hasActiveFilters,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onViewModeChange,
}: RequestsQueueToolbarProps) {
  return (
    <section className="rounded-[24px] border border-sky-100 bg-white/95 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, requester, assignee, request id"
            className="w-full rounded-[20px] border border-sky-100 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 shadow-sm"
          />
        </div>

        <label className="min-w-0 xl:w-[220px] xl:flex-none">
          <span className="sr-only">Request type</span>
          <select
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value)}
            className="w-full rounded-[20px] border border-sky-100 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} {typeCounts[option.value as keyof TypeCounts]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 xl:w-[220px] xl:flex-none">
          <span className="sr-only">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="w-full rounded-[20px] border border-sky-100 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm"
          >
            {[
              { value: 'all', label: 'All', count: totalRequests },
              { value: 'pending', label: 'Pending', count: requestSummary.pending },
              { value: 'in_progress', label: 'In Progress', count: requestSummary.inProgress },
              { value: 'resolved', label: 'Resolved', count: requestSummary.resolved },
            ].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-zinc-600 xl:flex-none xl:whitespace-nowrap">
          Showing <span className="font-bold text-zinc-900">{activeTypeLabel}</span> with <span className="font-bold text-zinc-900">{activeStatusLabel}</span>{searchQuery.trim() ? <span> for search <span className="font-bold text-zinc-900">{searchQuery.trim()}</span></span> : null}.
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-zinc-600">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="inline-flex rounded-full border border-sky-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 transition hover:bg-sky-50"
            >
              List View
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 transition hover:bg-sky-50"
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Unassigned</div>
            <UserPlus className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-950">{unassignedCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Requests still waiting for an owner.</div>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Active Today</div>
            <Clock3 className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-950">{recentActivityCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Requests updated in the last 24 hours.</div>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Needs Review</div>
            <Sparkles className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-950">{needsReviewCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Enrollments and unowned tickets to handle first.</div>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Filtered View</div>
            <Filter className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-950">{hasActiveFilters ? 1 : 0}</div>
          <div className="mt-1 text-xs text-zinc-500">{hasActiveFilters ? 'Custom filters are narrowing the queue.' : 'Viewing the full queue with default filters.'}</div>
        </div>
      </div>
    </section>
  );
}