import { AlertTriangle, CheckCircle2, ShieldAlert, TerminalSquare, Wrench } from 'lucide-react';

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
  const canShowTerminalAction = canResolve && !isAlertClosed && Boolean(selectedAlert.assetId);
  const canShowPatchAction = selectedAlertSource === 'openscap' && canResolve && !isAlertClosed && Boolean(selectedAlert.assetId);
  const terminalUnavailableMessage = terminalBlockedReason || (selectedAlertSource === 'terminal' ? selectedAlert.detail : '');
  const patchUnavailableMessage = patchBlockedReason || (selectedAlertSource === 'patch' ? selectedAlert.detail : '');
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
    if (selectedAlertSource === 'terminal') {
      return 'Terminal alerts show why direct SSH investigation is currently blocked and what needs to be restored before remote access can continue.';
    }
    if (selectedAlertSource === 'patch') {
      return 'Patch alerts show why Salt-backed remediation is currently blocked so operators can restore connectivity before retrying the patch workflow.';
    }
    return '';
  })();

  return (
    <>
      {(selectedAlertSource === 'openscap' || selectedAlertSource === 'wazuh' || selectedAlertSource === 'clamav' || selectedAlertSource === 'terminal' || selectedAlertSource === 'patch') ? (
        <div className={`mt-4 rounded-[28px] border px-5 py-5 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-zinc-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f7fbff_100%)] text-zinc-600'}`}>
          <div className="flex items-start gap-3">
            <div className={`rounded-2xl p-3 ${darkMode ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-50 text-sky-700'}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Alert Investigation</div>
              <div className={`mt-1 text-base font-bold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Response guidance for the selected finding</div>
              <p className="mt-2 text-sm leading-6">{sourceSummary}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className={`rounded-[28px] border px-5 py-5 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${darkMode ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-50 text-sky-700'}`}>
              <TerminalSquare className="h-5 w-5" />
            </div>
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Live access</div>
              <div className={`text-base font-bold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Terminal and remediation tools</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {selectedAlert.assetId ? <button type="button" onClick={onOpenAsset} className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-100 hover:bg-slate-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}>Open Asset</button> : null}
            {canShowTerminalAction ? <button type="button" onClick={onStartTerminal} disabled={detailActionLoading === 'terminal' || !selectedAssetCanStartTerminal} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-60"><TerminalSquare className="mr-2 inline h-4 w-4" />{detailActionLoading === 'terminal' ? 'Opening...' : 'Open SSH Terminal'}</button> : null}
            {canShowPatchAction ? <button type="button" onClick={onOpenSaltConsole} disabled={!selectedAssetCanOpenPatchConsole} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-60"><Wrench className="mr-2 inline h-4 w-4" />Open Salt Console</button> : null}
          </div>
          {(canShowTerminalAction && terminalUnavailableMessage) || ((canShowPatchAction && !selectedAssetCanRunPatch) || selectedAlertSource === 'patch') && patchUnavailableMessage ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {canShowTerminalAction && terminalUnavailableMessage ? (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Terminal session unavailable
                  </div>
                  <div className="mt-2 leading-6">{terminalUnavailableMessage}</div>
                </div>
              ) : null}
              {(((canShowPatchAction && !selectedAssetCanRunPatch) || selectedAlertSource === 'patch') && patchUnavailableMessage) ? (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Salt patch unavailable
                  </div>
                  <div className="mt-2 leading-6">{patchUnavailableMessage}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`rounded-[28px] border px-5 py-5 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${darkMode ? 'bg-emerald-500/15 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Response workflow</div>
              <div className={`text-base font-bold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Triage and closeout</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {canAcknowledge && !selectedAlert.acknowledged ? <button type="button" onClick={() => onAcknowledge(selectedAlert.id)} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 shadow-sm hover:bg-amber-100">Acknowledge</button> : null}
            {canResolve && !selectedAlert.resolved ? <button type="button" onClick={() => onResolve(selectedAlert.id)} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-100">Mark Resolved</button> : null}
          </div>
          <div className={`mt-4 rounded-[22px] border px-4 py-4 text-sm leading-6 ${darkMode ? 'border-white/10 bg-slate-950/45 text-slate-300' : 'border-zinc-200 bg-white/80 text-zinc-600'}`}>
            Keep the investigation in this drawer, open the selected asset only when you need more device context, and close the alert after terminal or patch validation is complete.
          </div>
        </div>
      </div>

      {isAlertClosed ? <div className={`mt-4 rounded-[24px] border px-4 py-3 text-sm shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-200' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>This alert is resolved. Response actions are read-only for closed findings.</div> : null}

      {readOnlyReview ? <div className="mt-4 rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">Auditor access is view-only for alert details. Operational actions remain restricted to IT operations and super admin users.</div> : null}

      {selectedAlertSource === 'openscap' && canResolve && !isAlertClosed && selectedAlert.assetId ? (
        <div className={`mt-4 grid gap-4 rounded-[28px] border px-5 py-5 shadow-sm sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]'}`}>
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Patch workflow</div>
            <div className={`mt-1 text-base font-bold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Salt remediation</div>
            <p className={`mt-2 text-sm leading-6 ${darkMode ? 'text-slate-400' : 'text-zinc-600'}`}>Pick the Salt action you want to run against the selected asset, then submit it directly from the investigation drawer.</p>
          </div>
          <div>
            <label className={`mb-1 block text-xs font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Salt action</label>
            <select value={selectedSaltAction} onChange={(event) => onSelectedSaltActionChange(event.target.value as SaltActionValue)} className={`w-full rounded-2xl border px-3 py-3 text-sm ${darkMode ? 'border-white/10 bg-slate-900 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}>
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
                className={`w-full rounded-2xl border px-3 py-3 text-sm ${darkMode ? 'border-white/10 bg-slate-900 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}
              />
            </div>
          ) : <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Run the selected Salt action against this asset from the alert panel.</div>}
          <div className="sm:col-span-2">
            <button type="button" onClick={onRunPatch} disabled={detailActionLoading === 'patch' || !selectedAssetCanRunPatch} className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-60">
              {detailActionLoading === 'patch' ? 'Queueing...' : selectedPatchActionLabel}
            </button>
          </div>
        </div>
      ) : null}

      {detailMessage ? <div className={`mt-4 rounded-[24px] border px-4 py-3 text-sm shadow-sm ${detailMessage.tone === 'success' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{detailMessage.text}</div> : null}
    </>
  );
}