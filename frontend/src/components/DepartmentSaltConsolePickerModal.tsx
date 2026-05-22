import { createPortal } from 'react-dom';
import { TerminalSquare, X } from 'lucide-react';

import { actionButtonStyles } from '../lib/buttonStyles';

export interface DepartmentConsoleDevice {
  id: string;
  hostname: string;
  osName?: string | null;
  minionId?: string;
  department?: { name?: string } | null;
  user?: { fullName?: string } | null;
}

interface DepartmentSaltConsolePickerModalProps {
  open: boolean;
  title: string;
  devices: DepartmentConsoleDevice[];
  busyDeviceId?: string;
  onSelect: (device: DepartmentConsoleDevice) => void;
  onClose: () => void;
}

export default function DepartmentSaltConsolePickerModal({
  open,
  title,
  devices,
  busyDeviceId = '',
  onSelect,
  onClose,
}: DepartmentSaltConsolePickerModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="department-salt-console-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(163,230,53,0.12),_transparent_24%),linear-gradient(135deg,_#f6fdf8_0%,_#ffffff_58%,_#f6fbf7_100%)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Department Salt Console</div>
              <h2 id="department-salt-console-picker-title" className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{title}</h2>
              <p className="mt-1 text-sm text-zinc-600">Choose the system that should open the Salt console for this department view. Each card includes the asset ID and Salt terminal target when available.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  {devices.length} device{devices.length === 1 ? '' : 's'} available
                </div>
                <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Department Scope
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className={`inline-flex items-center rounded-2xl px-3.5 py-2.5 text-sm font-bold shadow-sm transition ${actionButtonStyles.add}`}>
              <X className="mr-1.5 h-4 w-4" /> Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-6 py-5">
          {devices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-500 shadow-sm">
              No Salt-enabled systems are available in the current department view.
            </div>
          ) : (
            <div className="grid gap-3">
              {devices.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => onSelect(device)}
                disabled={busyDeviceId !== ''}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fdf9_100%)] px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/60 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-bold text-zinc-950">{device.hostname}</div>
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                      Asset ID {device.id}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{device.department?.name || 'Unassigned department'}</span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">{device.osName || 'Unknown OS'}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">{device.user?.fullName || 'No assigned user'}</div>
                  {device.minionId ? (
                    <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      <TerminalSquare className="mr-1.5 h-3 w-3 shrink-0" />
                      <span className="truncate">{device.minionId}</span>
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      Salt target pending
                    </div>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700 shadow-sm">
                  <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                  {busyDeviceId === device.id ? 'Opening...' : 'Open Console'}
                </span>
              </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}