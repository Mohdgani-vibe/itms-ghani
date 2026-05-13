import { Play } from 'lucide-react';

import { getSaltActionOption, SALT_ACTION_OPTIONS, type SaltActionValue } from '../../lib/salt';
import type { DevicePatchJobRecord } from './types';

interface SaltUpdatesPanelProps {
  saltTarget: string;
  selectedSaltAction: SaltActionValue;
  customSaltInput: string;
  runningPatch: boolean;
  canOperate: boolean;
  canOpenPatchConsole: boolean;
  patchActionButtonLabel: string;
  patchBlockedReason: string;
  sidebarLoading: boolean;
  patchJobs: DevicePatchJobRecord[];
  onSelectedSaltActionChange: (value: SaltActionValue) => void;
  onCustomSaltInputChange: (value: string) => void;
  onRunPatch: () => void;
  formatDate: (value?: string | null) => string;
}

export default function SaltUpdatesPanel({
  saltTarget,
  selectedSaltAction,
  customSaltInput,
  runningPatch,
  canOperate,
  canOpenPatchConsole,
  patchActionButtonLabel,
  patchBlockedReason,
  sidebarLoading,
  patchJobs,
  onSelectedSaltActionChange,
  onCustomSaltInputChange,
  onRunPatch,
  formatDate,
}: SaltUpdatesPanelProps) {
  const actionOption = getSaltActionOption(selectedSaltAction);

  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">
      <Play className="mr-2 h-4 w-4 text-brand-600" /> Salt Updates
    </div>
    <p className="mt-2 text-sm text-zinc-500">Queue a Salt-driven patch run for this asset and review recent Salt update jobs.</p>
    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
      Salt target: <span className="font-semibold text-zinc-900">{saltTarget}</span>
    </div>
    {canOperate ? (
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Salt action</label>
          <select value={selectedSaltAction} onChange={(event) => onSelectedSaltActionChange(event.target.value as SaltActionValue)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
            {SALT_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="mt-2 text-xs text-zinc-500">{actionOption.description}</p>
        </div>
        {actionOption.inputLabel ? (
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{actionOption.inputLabel}</label>
            <input
              type="text"
              value={customSaltInput}
              onChange={(event) => onCustomSaltInputChange(event.target.value)}
              placeholder={actionOption.inputPlaceholder}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
        ) : null}
      </div>
    ) : (
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
        Auditor access is read-only. Salt actions and command inputs are hidden, but recent Salt job history stays visible for verification.
      </div>
    )}
    {canOperate ? (
      <button type="button" onClick={onRunPatch} disabled={runningPatch || !canOpenPatchConsole} className="mt-4 w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60">
        {runningPatch ? 'Queueing Salt action...' : patchActionButtonLabel}
      </button>
    ) : null}
    {canOperate && patchBlockedReason ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">{patchBlockedReason}</div> : null}
    <div className="mt-4 space-y-3">
      {sidebarLoading ? <div className="text-sm text-zinc-500">Loading patch jobs...</div> : null}
      {!sidebarLoading && patchJobs.length === 0 ? <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">No recent Salt update jobs for this asset.</div> : null}
      {patchJobs.map((job) => (
        <div key={job.id} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
          <div className="text-sm font-semibold text-zinc-900">{job.jid}</div>
          <div className="mt-1 text-xs text-zinc-500">{job.scope} • {job.status} • {formatDate(job.createdAt)}</div>
        </div>
      ))}
    </div>
  </div>;
}