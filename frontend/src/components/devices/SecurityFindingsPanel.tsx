import { ShieldCheck } from 'lucide-react';
import type { DeviceAlertRecord } from './types';

function renderAlertTitle(alert: Pick<DeviceAlertRecord, 'source' | 'title'>) {
  if (alert.source.toLowerCase() === 'clamav') {
    return alert.title.replace(/^ClamAV\b/i, 'ClamScan');
  }
  return alert.title;
}

interface SecurityFindingsPanelProps {
  title: string;
  description: string;
  alerts: DeviceAlertRecord[];
  loading: boolean;
  emptyMessage: string;
  onSelectAlert: (alert: DeviceAlertRecord) => void;
  alertStatusBadgeClassName: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  alertStatusLabel: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  severityBadgeClassName: (severity: string) => string;
  alertSourceLabel: (source: string) => string;
  formatDate: (value?: string | null) => string;
}

export default function SecurityFindingsPanel({
  title,
  description,
  alerts,
  loading,
  emptyMessage,
  onSelectAlert,
  alertStatusBadgeClassName,
  alertStatusLabel,
  severityBadgeClassName,
  alertSourceLabel,
  formatDate,
}: SecurityFindingsPanelProps) {
  const latestAlert = alerts[0] ?? null;

  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">
        <ShieldCheck className="mr-2 h-4 w-4 text-brand-600" /> {title}
      </div>
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">{alerts.length} recent</span>
    </div>
    <p className="mt-2 text-sm text-zinc-500">{description}</p>
    <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Latest Finding</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-zinc-900">{latestAlert ? renderAlertTitle(latestAlert) : `No recent ${title.toLowerCase()}`}</div>
        {latestAlert ? <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${alertStatusBadgeClassName(latestAlert)}`}>{alertStatusLabel(latestAlert)}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>{latestAlert ? formatDate(latestAlert.createdAt) : 'No timestamp available'}</span>
        {latestAlert ? <span className={`rounded-full px-2 py-0.5 font-bold ${severityBadgeClassName(latestAlert.severity)}`}>{latestAlert.severity}</span> : null}
      </div>
    </div>
    <div className="mt-4 space-y-3">
      {loading ? <div className="text-sm text-zinc-500">Loading {title.toLowerCase()}...</div> : null}
      {!loading && alerts.length === 0 ? <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">{emptyMessage}</div> : null}
      {alerts.slice(0, 4).map((alert) => (
        <button key={alert.id} type="button" onClick={() => onSelectAlert(alert)} className="block w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left transition hover:border-zinc-200 hover:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{renderAlertTitle(alert)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{formatDate(alert.createdAt)}</span>
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-bold text-zinc-600">{alertSourceLabel(alert.source)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${severityBadgeClassName(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${alertStatusBadgeClassName(alert)}`}>
                {alertStatusLabel(alert)}
              </span>
            </div>
          </div>
          <div className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-zinc-600">{alert.detail}</div>
          <div className="mt-2 text-xs font-medium text-zinc-400">Click for full details</div>
        </button>
      ))}
    </div>
  </div>;
}