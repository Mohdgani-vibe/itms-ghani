interface AlertsQueueOverviewCardProps {
  severityFilter: string;
  severityOptions: string[];
  onSeverityFilterChange: (value: string) => void;
  onBackToDashboard: () => void;
}

export function AlertsQueueOverviewCard({
  severityFilter,
  severityOptions,
  onSeverityFilterChange,
  onBackToDashboard,
}: AlertsQueueOverviewCardProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f6fbff_55%,_#eef7ff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Queue overview</div>
          <h2 className="mt-3 text-2xl font-black text-zinc-950">All Alerts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Review the full live alert queue, keep severity narrowed when needed, and jump back to the dashboard when you want the broader SOC posture view.</p>
        </div>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-100"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <div className="rounded-[24px] border border-white/90 bg-white/95 px-4 py-4 text-sm text-zinc-600 shadow-sm">
          Review the full live alert queue with extracted feed cards. Selecting a row opens the existing detail drawer for acknowledgements, resolutions, and remote actions.
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Severity filter</div>
          <select
            value={severityFilter}
            onChange={(event) => onSeverityFilterChange(event.target.value)}
            className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none"
          >
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All severities' : option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}