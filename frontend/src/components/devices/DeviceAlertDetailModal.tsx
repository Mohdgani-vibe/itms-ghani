import { actionButtonStyles } from '../../lib/buttonStyles';
import type { DeviceAlertRecord } from './types';

function renderAlertTitle(alert: Pick<DeviceAlertRecord, 'source' | 'title'>) {
  if (alert.source.toLowerCase() === 'clamav') {
    return alert.title.replace(/^ClamAV\b/i, 'ClamScan');
  }
  return alert.title;
}

interface DeviceAlertDetailModalProps {
  selectedAlert: DeviceAlertRecord | null;
  hostname: string;
  assetId: string;
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
  departmentName?: string | null;
  alertDialogRef: React.RefObject<HTMLDivElement | null>;
  alertCloseButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  severityBadgeClassName: (severity: string) => string;
  alertSourceLabel: (source: string) => string;
  alertStatusBadgeClassName: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  alertStatusLabel: (alert: Pick<DeviceAlertRecord, 'acknowledged' | 'resolved'>) => string;
  formatDate: (value?: string | null) => string;
}

export default function DeviceAlertDetailModal({
  selectedAlert,
  hostname,
  assetId,
  assignedUserName,
  assignedUserEmail,
  departmentName,
  alertDialogRef,
  alertCloseButtonRef,
  onClose,
  severityBadgeClassName,
  alertSourceLabel,
  alertStatusBadgeClassName,
  alertStatusLabel,
  formatDate,
}: DeviceAlertDetailModalProps) {
  if (!selectedAlert) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div ref={alertDialogRef} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-zinc-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="device-alert-detail-title" aria-describedby="device-alert-detail-body" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(135deg,_#f4fdf7_0%,_#ffffff_58%,_#fff8ef_100%)] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${severityBadgeClassName(selectedAlert.severity)}`}>{selectedAlert.severity || 'unknown'}</span>
              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700">{alertSourceLabel(selectedAlert.source)}</span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${alertStatusBadgeClassName(selectedAlert)}`}>{alertStatusLabel(selectedAlert)}</span>
            </div>
            <h2 id="device-alert-detail-title" className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{renderAlertTitle(selectedAlert)}</h2>
            <p id="device-alert-detail-body" className="mt-2 max-w-3xl whitespace-pre-line text-sm text-zinc-600">{selectedAlert.detail || 'No detail provided.'}</p>
          </div>
          <button ref={alertCloseButtonRef} type="button" onClick={onClose} className={`rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition ${actionButtonStyles.add}`}>Close</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            Device Alert Investigation
          </div>
          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            {hostname || assetId || 'Unknown Asset'}
          </div>
        </div>
        </div>

        <div className="px-6 py-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">System Name</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{hostname || '-'}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Asset ID</div>
            <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{assetId || '-'}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Source</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{alertSourceLabel(selectedAlert.source)}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Assigned User</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{assignedUserName || '-'}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Email</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{assignedUserEmail || '-'}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Department</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{departmentName || '-'}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Created</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{formatDate(selectedAlert.createdAt)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Current Status</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{alertStatusLabel(selectedAlert)}</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}