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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-zinc-950">All Alerts</h2>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-end">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
          Review the full live alert queue with extracted feed cards. Selecting a row opens the existing detail drawer for acknowledgements, resolutions, and remote actions.
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Severity filter</div>
          <select
            value={severityFilter}
            onChange={(event) => onSeverityFilterChange(event.target.value)}
            className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm"
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