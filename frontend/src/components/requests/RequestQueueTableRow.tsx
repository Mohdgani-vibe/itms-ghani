export interface RequestQueueTableRowProps {
  requestIdLabel: string;
  title: string;
  typeLabel: string;
  commentsLabel: string;
  statusLabel: string;
  statusClassName: string;
  updatedAtLabel: string;
  requesterName: string;
  requesterLabel?: string;
  assigneeName: string;
  isSelected: boolean;
  isEnrollmentRequest: boolean;
  isBulkSelected: boolean;
  canStart: boolean;
  canApproveAndOpen: boolean;
  hasLinkedDevice: boolean;
  enrollmentAsset: string;
  enrollmentOwner: string;
  enrollmentDepartment: string;
  deviceLinkLabel: string;
  inspectButtonClassName: string;
  onToggleBulkSelect: () => void;
  onInspect: () => void;
  onStart: () => void;
  onApproveAndOpen: () => void;
}

export default function RequestQueueTableRow({
  requestIdLabel,
  title,
  typeLabel,
  commentsLabel,
  statusLabel,
  statusClassName,
  updatedAtLabel,
  requesterName,
  requesterLabel,
  assigneeName,
  isSelected,
  isEnrollmentRequest,
  isBulkSelected,
  canStart,
  canApproveAndOpen,
  hasLinkedDevice,
  enrollmentAsset,
  enrollmentOwner,
  enrollmentDepartment,
  deviceLinkLabel,
  inspectButtonClassName,
  onToggleBulkSelect,
  onInspect,
  onStart,
  onApproveAndOpen,
}: RequestQueueTableRowProps) {
  const effectiveRequesterName = requesterName || requesterLabel || '-';
  const rowClassName = isEnrollmentRequest
    ? (isSelected ? 'bg-sky-50/80 ring-1 ring-inset ring-sky-200' : 'bg-sky-50/40 hover:bg-sky-50/70')
    : (isSelected ? 'bg-sky-50/70 ring-1 ring-inset ring-sky-100' : 'hover:bg-sky-50/40');

  return (
    <tr className={rowClassName}>
      <td className="px-4 py-4 align-top">
        <input
          type="checkbox"
          checked={isBulkSelected}
          onChange={onToggleBulkSelect}
          className="mt-1 h-4 w-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500"
        />
      </td>
      <td className="px-4 py-4 align-top">
        <button type="button" onClick={onInspect} className={`text-left ${isEnrollmentRequest ? 'rounded-xl border border-sky-200 bg-white/90 p-3 shadow-sm' : 'rounded-xl border border-sky-100 bg-white/90 p-3 shadow-sm hover:bg-sky-50/60'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {isEnrollmentRequest ? (
              <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Enrollment Review
              </span>
            ) : null}
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{requestIdLabel}</span>
          </div>
          <div className="mt-2 font-semibold text-zinc-900">{title}</div>
          {isEnrollmentRequest ? (
            <div className="mt-2 space-y-1 text-xs text-sky-800">
              <div><span className="font-bold uppercase tracking-wider text-sky-700">Asset</span> {enrollmentAsset}</div>
              <div><span className="font-bold uppercase tracking-wider text-sky-700">Owner</span> {enrollmentOwner}</div>
              <div><span className="font-bold uppercase tracking-wider text-sky-700">Department</span> {enrollmentDepartment}</div>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>{typeLabel}</span>
            <span>{commentsLabel}</span>
            {isEnrollmentRequest ? <span>{deviceLinkLabel}</span> : null}
          </div>
          <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2 xl:hidden">
            <div>
              <span className="font-bold uppercase tracking-wider text-zinc-500">Requester</span> {effectiveRequesterName}
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-zinc-500">Assignee</span> {assigneeName}
            </div>
            <div className="sm:col-span-2 lg:hidden">
              <span className="font-bold uppercase tracking-wider text-zinc-500">Updated</span> {updatedAtLabel}
            </div>
          </div>
        </button>
      </td>
      <td className="hidden px-4 py-4 text-sm text-zinc-700 xl:table-cell">{effectiveRequesterName}</td>
      <td className="hidden px-4 py-4 text-sm text-zinc-700 xl:table-cell">{assigneeName}</td>
      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName}`}>{statusLabel}</span></td>
      <td className="hidden px-4 py-4 text-sm text-zinc-700 lg:table-cell">{updatedAtLabel}</td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onInspect} className={inspectButtonClassName}>Inspect</button>
          {isEnrollmentRequest ? (
            <>
              <button type="button" onClick={onStart} disabled={!canStart} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60">Start</button>
              <button type="button" onClick={onApproveAndOpen} disabled={!canApproveAndOpen || !hasLinkedDevice} className="rounded-lg border border-sky-300 bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-60">{hasLinkedDevice ? 'Approve' : 'Await Device Sync'}</button>
            </>
          ) : (
            <button type="button" onClick={onStart} disabled={!canStart} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60">Start</button>
          )}
        </div>
      </td>
    </tr>
  );
}