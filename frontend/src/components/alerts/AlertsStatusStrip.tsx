import { RefreshCw } from 'lucide-react';

interface AlertsStatusStripProps {
  loading: boolean;
  alertsError: string;
  hasAlertsData: boolean;
  totalAlertsLabel: string;
  onRefresh: () => void;
}

export function AlertsStatusStrip({ loading, alertsError, hasAlertsData, totalAlertsLabel, onRefresh }: AlertsStatusStripProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Alerts
        </button>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm">
          {alertsError ? alertsError : totalAlertsLabel}
        </div>
      </div>

      {alertsError && !hasAlertsData ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{alertsError}</div>
      ) : null}
    </>
  );
}