import { ShieldCheck } from 'lucide-react';
import type { DeviceAlertRecord } from './types';

interface OtherAlertsPanelProps {
  alerts: DeviceAlertRecord[];
  loading: boolean;
  onSelectAlert: (alert: DeviceAlertRecord) => void;
  alertSourceLabel: (source: string) => string;
  severityBadgeClassName: (severity: string) => string;
  alertStatusBadgeClassName: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  alertStatusLabel: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  formatDate: (value?: string | null) => string;
}

export default function OtherAlertsPanel({
  alerts,
  loading,
  onSelectAlert,
  alertSourceLabel,
  severityBadgeClassName,
  alertStatusBadgeClassName,
  alertStatusLabel,
  formatDate,
}: OtherAlertsPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">
        <ShieldCheck className="mr-2 h-4 w-4 text-brand-600" /> Other Alerts
      </div>
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">{alerts.length} recent</span>
    </div>
    <p className="mt-2 text-sm text-zinc-500">Operational and lifecycle alerts for this asset, excluding the dedicated Wazuh, ClamScan, and OpenSCAP findings shown above.</p>
    <div className="mt-4 space-y-3">
      {loading ? <div className="text-sm text-zinc-500">Loading alerts...</div> : null}
      {!loading && alerts.length === 0 ? <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">No additional operational alerts for this asset.</div> : null}
      {alerts.map((alert) => (
        <button key={alert.id} type="button" onClick={() => onSelectAlert(alert)} className="block w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left transition hover:border-zinc-200 hover:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{alert.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-bold text-zinc-600">{alertSourceLabel(alert.source)}</span>
                <span>{formatDate(alert.createdAt)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${severityBadgeClassName(alert.severity)}`}>{alert.severity}</span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${alertStatusBadgeClassName(alert)}`}>{alertStatusLabel(alert)}</span>
            </div>
          </div>
          <div className="mt-2 whitespace-pre-line text-sm text-zinc-600">{alert.detail}</div>
          <div className="mt-2 text-xs font-medium text-zinc-400">Click for full details</div>
        </button>
      ))}
    </div>
  </div>;
}