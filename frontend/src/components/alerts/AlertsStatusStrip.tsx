import { Activity, BellRing, RefreshCw } from 'lucide-react';

interface AlertsStatusStripProps {
  loading: boolean;
  alertsError: string;
  hasAlertsData: boolean;
  totalAlertsLabel: string;
  liveLabel: string;
  lastUpdatedLabel: string;
  notificationCount: number;
  onRefresh: () => void;
}

export function AlertsStatusStrip({ loading, alertsError, hasAlertsData, totalAlertsLabel, liveLabel, lastUpdatedLabel, notificationCount, onRefresh }: AlertsStatusStripProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Alerts
        </button>
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-zinc-700">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              <Activity className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
              {liveLabel}
            </span>
            <span>{alertsError ? alertsError : totalAlertsLabel}</span>
            <span className="text-zinc-400">Last updated {lastUpdatedLabel}</span>
          </div>
        </div>
        <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 shadow-sm">
          <BellRing className="h-4 w-4 text-sky-600" />
          {notificationCount} notifications
        </div>
      </div>

      {alertsError && !hasAlertsData ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{alertsError}</div>
      ) : null}
    </>
  );
}