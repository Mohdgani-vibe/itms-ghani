import { TerminalSquare } from 'lucide-react';

import { getSaltActionOption, SALT_ACTION_OPTIONS, type SaltActionValue } from '../../lib/salt';
import type { AlertsListRecord } from './types';

interface AlertsDetailActionsPanelProps {
  selectedAlert: AlertsListRecord;
  selectedAlertSource: string;
  darkMode?: boolean;
  readOnlyReview?: boolean;
  canAcknowledge: boolean;
  canResolve: boolean;
  detailActionLoading: string;
  detailMessage: { tone: 'success' | 'error'; text: string } | null;
  selectedAssetCanStartTerminal: boolean;
  selectedAssetCanOpenPatchConsole: boolean;
  selectedAssetCanRunPatch: boolean;
  terminalBlockedReason: string;
  patchBlockedReason: string;
  selectedSaltAction: SaltActionValue;
  customSaltInput: string;
  selectedPatchActionLabel: string;
  onOpenAsset: () => void;
  onStartTerminal: () => void;
  onOpenSaltConsole: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onRunPatch: () => void;
  onSelectedSaltActionChange: (value: SaltActionValue) => void;
  onCustomSaltInputChange: (value: string) => void;
}

export function AlertsDetailActionsPanel({
  selectedAlert,
  selectedAlertSource,
  darkMode = false,
  readOnlyReview = false,
  canAcknowledge,
  canResolve,
  detailActionLoading,
  detailMessage,
  selectedAssetCanStartTerminal,
  selectedAssetCanOpenPatchConsole,
  selectedAssetCanRunPatch,
  terminalBlockedReason,
  patchBlockedReason,
  selectedSaltAction,
  customSaltInput,
  selectedPatchActionLabel,
  onOpenAsset,
  onStartTerminal,
  onOpenSaltConsole,
  onAcknowledge,
  onResolve,
  onRunPatch,
  onSelectedSaltActionChange,
  onCustomSaltInputChange,
}: AlertsDetailActionsPanelProps) {
  const isAlertClosed = selectedAlert.resolved;
  const sourceSummary = (() => {
    if (readOnlyReview) {
      if (selectedAlertSource === 'openscap') {
        return 'OpenSCAP findings are available for audit inspection. Auditors can trace the linked asset and verify status without running remediation actions.';
      }
      if (selectedAlertSource === 'wazuh') {
        return 'Wazuh findings are available for audit inspection. Auditors can inspect the linked asset and evidence without opening response actions.';
      }
      if (selectedAlertSource === 'clamav') {
        return 'ClamScan findings are available for audit inspection. Auditors can inspect the linked asset and evidence without opening remediation actions.';
      }
      return '';
    }

    if (selectedAlertSource === 'openscap') {
      return 'OpenSCAP findings can be reviewed on the asset page, patched through the Salt-backed patch run, or investigated through a terminal session.';
    }
    if (selectedAlertSource === 'wazuh') {
      return 'Wazuh findings can be reviewed on the asset page or investigated through a terminal session.';
    }
    if (selectedAlertSource === 'clamav') {
      return 'ClamScan findings can be investigated through a terminal session and then resolved once the infected artifact is handled.';
    }
    return '';
  })();

  return (
    <>
      {(selectedAlertSource === 'openscap' || selectedAlertSource === 'wazuh' || selectedAlertSource === 'clamav') ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-zinc-200 bg-zinc-50/80 text-zinc-600'}`}>
          {sourceSummary}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2.5">
        {selectedAlert.assetId ? <button type="button" onClick={onOpenAsset} className={`rounded-lg border px-3 py-2 text-sm font-bold ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-100 hover:bg-slate-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}>Open Asset</button> : null}
        {canResolve && !isAlertClosed && selectedAlert.assetId ? <button type="button" onClick={onStartTerminal} disabled={detailActionLoading === 'terminal' || !selectedAssetCanStartTerminal} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-60"><TerminalSquare className="mr-2 inline h-4 w-4" />{detailActionLoading === 'terminal' ? 'Opening...' : 'Open SSH Terminal'}</button> : null}
        {canResolve && !isAlertClosed && selectedAlert.assetId && selectedAlertSource === 'openscap' ? <button type="button" onClick={onOpenSaltConsole} disabled={!selectedAssetCanOpenPatchConsole} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60">Open Salt Console</button> : null}
        {canAcknowledge && !selectedAlert.acknowledged ? <button type="button" onClick={() => onAcknowledge(selectedAlert.id)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100">Acknowledge</button> : null}
        {canResolve && !selectedAlert.resolved ? <button type="button" onClick={() => onResolve(selectedAlert.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">Mark Resolved</button> : null}
      </div>

      {isAlertClosed ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-200' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>This alert is resolved. Response actions are read-only for closed findings.</div> : null}

      {readOnlyReview ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Auditor access is view-only for alert details. Operational actions remain restricted to IT operations and super admin users.</div> : null}

      {canResolve && !isAlertClosed && selectedAlert.assetId && terminalBlockedReason ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Terminal Access</div>
          <div className="mt-2">{terminalBlockedReason}</div>
        </div>
      ) : null}

      {selectedAlertSource === 'openscap' && canResolve && !isAlertClosed && selectedAlert.assetId ? (
        <div className={`mt-4 grid gap-3 rounded-2xl border px-4 py-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-zinc-50'}`}>
          <div>
            <label className={`mb-1 block text-xs font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Salt action</label>
            <select value={selectedSaltAction} onChange={(event) => onSelectedSaltActionChange(event.target.value as SaltActionValue)} className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              {SALT_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className={`mt-2 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{getSaltActionOption(selectedSaltAction).description}</p>
          </div>
          {getSaltActionOption(selectedSaltAction).inputLabel ? (
            <div>
              <label className={`mb-1 block text-xs font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{getSaltActionOption(selectedSaltAction).inputLabel}</label>
              <input
                type="text"
                value={customSaltInput}
                onChange={(event) => onCustomSaltInputChange(event.target.value)}
                placeholder={getSaltActionOption(selectedSaltAction).inputPlaceholder}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}
              />
            </div>
          ) : <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Run the selected Salt action against this asset from the alert panel.</div>}
          <div className="sm:col-span-2">
            <button type="button" onClick={onRunPatch} disabled={detailActionLoading === 'patch' || !selectedAssetCanRunPatch} className="w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
              {detailActionLoading === 'patch' ? 'Queueing...' : selectedPatchActionLabel}
            </button>
          </div>
        </div>
      ) : null}

      {selectedAlertSource === 'openscap' && canResolve && !isAlertClosed && !selectedAssetCanRunPatch && patchBlockedReason ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{patchBlockedReason}</div> : null}

      {detailMessage ? <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${detailMessage.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{detailMessage.text}</div> : null}
    </>
  );
}