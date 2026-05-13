import { RefreshCw, TerminalSquare } from 'lucide-react';

import { PATCH_DEVICE_READ_ONLY_REASON, patchDeviceActionsReadOnly } from './patchDeviceActions';

interface PatchDepartmentSystem {
  id: string;
  hostname: string;
  osName?: string | null;
  status?: string | null;
  patchStatus: string;
  department?: { name?: string } | null;
  user?: { fullName?: string } | null;
}

interface PatchDepartmentRunPanelProps {
  runningPatch: boolean;
  canOperate: boolean;
  openingConsoleDeviceId: string;
  totalDevices: number;
  actionableDeviceCount: number;
  departmentSystemsLabel: string;
  loading: boolean;
  departmentSystems: PatchDepartmentSystem[];
  onRunDepartmentPatch: () => void;
  onOpenDepartmentSaltConsole: () => void;
  onOpenDevice: (deviceId: string) => void;
  onRunPatchForDevice: (device: PatchDepartmentSystem) => void;
  onOpenConsoleForDevice: (device: PatchDepartmentSystem) => void;
}

export default function PatchDepartmentRunPanel({
  runningPatch,
  canOperate,
  openingConsoleDeviceId,
  totalDevices,
  actionableDeviceCount,
  departmentSystemsLabel,
  loading,
  departmentSystems,
  onRunDepartmentPatch,
  onOpenDepartmentSaltConsole,
  onOpenDevice,
  onRunPatchForDevice,
  onOpenConsoleForDevice,
}: PatchDepartmentRunPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f7fbff_100%)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Department Run</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">Salt patch execution</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Launch the current department scope, then inspect the live report or drop into a Salt console for the same systems.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Actionable</div>
          <div className="mt-1 text-2xl font-black text-slate-950">{actionableDeviceCount}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={onRunDepartmentPatch} disabled={!canOperate || runningPatch || actionableDeviceCount === 0} className="inline-flex items-center rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
          <RefreshCw className="mr-2 h-4 w-4" />
          {runningPatch ? 'Running...' : 'Run Department Patch'}
        </button>
        <button
          type="button"
          onClick={onOpenDepartmentSaltConsole}
          disabled={!canOperate || openingConsoleDeviceId !== '' || actionableDeviceCount === 0}
          className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <TerminalSquare className="mr-2 h-4 w-4" />
          {openingConsoleDeviceId ? 'Opening...' : 'Open Department Salt Console'}
        </button>
      </div>
      {canOperate && actionableDeviceCount < totalDevices ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{PATCH_DEVICE_READ_ONLY_REASON}</div> : null}
      <div className="mt-6 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{departmentSystemsLabel}</div>
            <p className="mt-1 text-sm text-slate-600">Open the Salt console or start a patch run for any system in the current department view.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{totalDevices} system(s)</span>
        </div>
        {loading ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Loading systems for this department...</div>
        ) : departmentSystems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No managed systems found for the current department filter.</div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {departmentSystems.map((device) => (
              <div key={`department-system-${device.id}`} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
                {patchDeviceActionsReadOnly(device.status) ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{PATCH_DEVICE_READ_ONLY_REASON}</div> : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => onOpenDevice(device.id)} className="truncate text-left text-sm font-semibold text-slate-900 hover:text-brand-700">
                      {device.hostname}
                    </button>
                    <div className="mt-1 text-xs text-slate-500">{device.osName || 'Unknown OS'}{device.user?.fullName ? ` • ${device.user.fullName}` : ''}</div>
                    <div className="mt-1 text-xs text-slate-500">{device.department?.name || 'Unassigned department'}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${device.patchStatus === 'up_to_date' ? 'bg-emerald-100 text-emerald-800' : device.patchStatus === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                    {device.patchStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onRunPatchForDevice(device)}
                    disabled={!canOperate || openingConsoleDeviceId === device.id || patchDeviceActionsReadOnly(device.status)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {openingConsoleDeviceId === device.id ? 'Opening...' : 'Run Patch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenConsoleForDevice(device)}
                    disabled={!canOperate || openingConsoleDeviceId === device.id || patchDeviceActionsReadOnly(device.status)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                    Open Salt Console
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalDevices > departmentSystems.length ? (
          <div className="mt-3 text-xs text-slate-500">Showing the first {departmentSystems.length} systems here. Use the full device table below for the rest.</div>
        ) : null}
      </div>
    </section>
  );
}