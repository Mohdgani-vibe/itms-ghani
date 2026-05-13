interface RequestDetailInfoPanelProps {
  requesterName: string;
  assigneeName: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  canOpenRequester: boolean;
  canOpenAssignee: boolean;
  onOpenRequester: () => void;
  onOpenAssignee: () => void;
}

export default function RequestDetailInfoPanel({
  requesterName,
  assigneeName,
  createdAtLabel,
  updatedAtLabel,
  canOpenRequester,
  canOpenAssignee,
  onOpenRequester,
  onOpenAssignee,
}: RequestDetailInfoPanelProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_rgba(240,249,255,0.9)_100%)] p-4 shadow-sm sm:grid-cols-3">
      <div className="rounded-xl border border-sky-100 bg-white/90 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Requester</div>
        {canOpenRequester ? (
          <button type="button" onClick={onOpenRequester} className="mt-1 text-left text-sm font-semibold text-sky-700 hover:text-sky-800">
            {requesterName}
          </button>
        ) : (
          <div className="mt-1 text-sm font-semibold text-zinc-900">{requesterName}</div>
        )}
      </div>
      <div className="rounded-xl border border-sky-100 bg-white/90 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Assignee</div>
        {canOpenAssignee ? (
          <button type="button" onClick={onOpenAssignee} className="mt-1 text-left text-sm font-semibold text-sky-700 hover:text-sky-800">
            {assigneeName}
          </button>
        ) : (
          <div className="mt-1 text-sm font-semibold text-zinc-900">{assigneeName}</div>
        )}
      </div>
      <div className="rounded-xl border border-sky-100 bg-white/90 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Created</div>
        <div className="mt-1 text-sm font-semibold text-zinc-900">{createdAtLabel}</div>
        <div className="mt-1 text-xs text-zinc-500">Updated {updatedAtLabel}</div>
      </div>
    </div>
  );
}