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
      <div className="grid gap-2.5 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-blue-200 bg-white/95 px-3.5 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <div className="rounded-[18px] border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 text-sm font-semibold text-zinc-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
              <Activity className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
              {liveLabel}
            </span>
            <span>{alertsError ? alertsError : totalAlertsLabel}</span>
            <span className="text-zinc-400">Updated {lastUpdatedLabel}</span>
          </div>
        </div>
        <div className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm font-bold text-zinc-700 shadow-sm">
          <BellRing className="h-4 w-4 text-blue-600" />
          {notificationCount}
        </div>
      </div>

      {alertsError && !hasAlertsData ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{alertsError}</div>
      ) : null}
    </>
  );
}