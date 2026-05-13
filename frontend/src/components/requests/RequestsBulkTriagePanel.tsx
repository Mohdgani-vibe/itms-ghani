interface BulkFeedback {
  tone: 'success' | 'warning';
  actionLabel: string;
  successCount: number;
  failureCount: number;
  failedRequestIds: string[];
  movedOutOfViewCount?: number;
  movedToStatusLabel?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface RequestsBulkTriagePanelProps {
  bulkSelectedCount: number;
  bulkAssigneeId: string;
  bulkStatus: string;
  bulkSaving: boolean;
  bulkFeedback: BulkFeedback | null;
  assigneeOptions: SelectOption[];
  statusOptions: SelectOption[];
  onAssigneeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAssignSelected: () => void;
  onUpdateStatus: () => void;
  onShowMovedStatusResults: () => void;
}

export default function RequestsBulkTriagePanel({
  bulkSelectedCount,
  bulkAssigneeId,
  bulkStatus,
  bulkSaving,
  bulkFeedback,
  assigneeOptions,
  statusOptions,
  onAssigneeChange,
  onStatusChange,
  onAssignSelected,
  onUpdateStatus,
  onShowMovedStatusResults,
}: RequestsBulkTriagePanelProps) {
  return (
    <>
      <div className="mb-4 rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_rgba(240,249,255,0.9)_100%)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Bulk Triage</div>
            <div className="mt-1 text-sm text-zinc-600">Select multiple rows to assign an owner or move the queue state in one action.</div>
          </div>
          <div className="text-sm font-semibold text-zinc-900">{bulkSelectedCount} selected</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto_auto]">
          <select value={bulkAssigneeId} onChange={(event) => onAssigneeChange(event.target.value)} className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm">
            <option value="">Assign selected requests</option>
            {assigneeOptions.map((user) => <option key={user.value} value={user.value}>{user.label}</option>)}
          </select>
          <select value={bulkStatus} onChange={(event) => onStatusChange(event.target.value)} className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm">
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <button type="button" onClick={onAssignSelected} disabled={bulkSaving || !bulkSelectedCount || !bulkAssigneeId} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60">
            Assign Selected
          </button>
          <button type="button" onClick={onUpdateStatus} disabled={bulkSaving || !bulkSelectedCount} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">
            {bulkSaving ? 'Applying...' : 'Update Status'}
          </button>
        </div>
        {bulkFeedback ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${bulkFeedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="font-bold">
              {bulkFeedback.failureCount
                ? `${bulkFeedback.actionLabel} completed with partial results`
                : `${bulkFeedback.actionLabel} completed successfully`}
            </div>
            <div className="mt-1">
              {bulkFeedback.successCount} request{bulkFeedback.successCount === 1 ? '' : 's'} succeeded
              {bulkFeedback.failureCount ? `, ${bulkFeedback.failureCount} failed and remain selected for follow-up.` : '.'}
            </div>
            {bulkFeedback.movedOutOfViewCount ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span>
                  {bulkFeedback.movedOutOfViewCount} updated request{bulkFeedback.movedOutOfViewCount === 1 ? '' : 's'} no longer match the current status filter.
                </span>
                <button
                  type="button"
                  onClick={onShowMovedStatusResults}
                  className="rounded-full border border-current/20 bg-white px-3 py-1 font-bold uppercase tracking-wider hover:bg-white/80"
                >
                  Show {bulkFeedback.movedToStatusLabel || ''}
                </button>
              </div>
            ) : null}
            {bulkFeedback.failedRequestIds.length ? (
              <div className="mt-2 text-xs font-semibold uppercase tracking-wider">
                Failed IDs: {bulkFeedback.failedRequestIds.map((requestId) => requestId.slice(0, 8)).join(', ')}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs text-zinc-600 lg:hidden">
        <div className="font-semibold text-zinc-900">Compact table mode</div>
        <div>Requester, assignee, and updated details collapse into each row on smaller screens.</div>
      </div>
    </>
  );
}