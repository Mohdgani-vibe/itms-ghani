import { Clock, RefreshCw, ShieldAlert, ShieldCheck, TerminalSquare } from 'lucide-react';

import { actionButtonStyles } from '../../lib/buttonStyles';
import { PATCH_DEVICE_READ_ONLY_REASON, patchDeviceActionsReadOnly } from './patchDeviceActions';

interface PatchDeviceRowProps {
  hostname: string;
  osName?: string | null;
  userFullName?: string | null;
  departmentName?: string | null;
  patchGroupName?: string | null;
  deviceStatus?: string | null;
  patchStatus: string;
  canOperate: boolean;
  isOpeningConsole: boolean;
  onOpenDevice: () => void;
  onRunPatch: () => void;
  onOpenConsole: () => void;
}

export default function PatchDeviceRow({
  hostname,
  osName,
  userFullName,
  departmentName,
  patchGroupName,
  deviceStatus,
  patchStatus,
  canOperate,
  isOpeningConsole,
  onOpenDevice,
  onRunPatch,
  onOpenConsole,
}: PatchDeviceRowProps) {
  const actionsReadOnly = patchDeviceActionsReadOnly(deviceStatus);

  return (
    <tr className="transition-colors hover:bg-emerald-50/40">
      <td className="px-6 py-4 whitespace-nowrap">
        <button type="button" onClick={onOpenDevice} className="text-sm font-bold text-slate-900 transition hover:text-brand-700">{hostname}</button>
        <div className="mt-1 text-xs text-slate-500">{osName} • {userFullName || 'Unassigned'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-slate-900">{departmentName || 'Unknown'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{patchGroupName || 'Default Ring'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {patchStatus === 'up_to_date' && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
          {patchStatus === 'pending' && <Clock className="h-5 w-5 text-amber-500" />}
          {patchStatus === 'failed' && <ShieldAlert className="h-5 w-5 text-red-500" />}
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${patchStatus === 'up_to_date' ? 'bg-emerald-100 text-emerald-800' : patchStatus === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
            {patchStatus.replace('_', ' ')}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[180px]">
          <button
            type="button"
            onClick={onRunPatch}
            disabled={!canOperate || isOpeningConsole || actionsReadOnly}
            className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> {isOpeningConsole ? 'Opening...' : 'Run Patch'}
          </button>
          <button
            type="button"
            onClick={onOpenConsole}
            disabled={!canOperate || isOpeningConsole || actionsReadOnly}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <TerminalSquare className="mr-1.5 h-4 w-4" /> Open Salt Console
          </button>
          {actionsReadOnly ? <div className="text-[11px] text-amber-700">{PATCH_DEVICE_READ_ONLY_REASON}</div> : null}
        </div>
      </td>
    </tr>
  );
}