interface RequestDetailOverviewPanelProps {
  requestIdLabel: string;
  typeLabel: string;
  statusLabel: string;
  statusClassName: string;
  freshnessLabel: string;
  freshnessClassName: string;
  commentsLabel: string;
  title: string;
  description: string;
  requesterName: string;
  assigneeName: string;
  updatedAtLabel: string;
  createdAtLabel: string;
}

export default function RequestDetailOverviewPanel({
  requestIdLabel,
  typeLabel,
  statusLabel,
  statusClassName,
  freshnessLabel,
  freshnessClassName,
  commentsLabel,
  title,
  description,
  requesterName,
  assigneeName,
  updatedAtLabel,
  createdAtLabel,
}: RequestDetailOverviewPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_rgba(240,253,244,0.9)_100%)] p-4 shadow-sm lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 ring-1 ring-emerald-100">{requestIdLabel}</span>
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 ring-1 ring-emerald-100">{typeLabel}</span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName}`}>{statusLabel}</span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${freshnessClassName}`}>{freshnessLabel}</span>
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 ring-1 ring-emerald-100">{commentsLabel}</span>
        </div>
        <h2 className="mt-3 text-lg font-black tracking-tight text-zinc-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[310px] lg:grid-cols-1">
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Requester</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{requesterName}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Assignee</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{assigneeName}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Updated</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{updatedAtLabel}</div>
          <div className="mt-1 text-xs text-zinc-500">Created {createdAtLabel}</div>
        </div>
      </div>
    </div>
  );
}