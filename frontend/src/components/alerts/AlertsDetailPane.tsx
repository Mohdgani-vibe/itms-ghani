import type { ReactNode } from 'react';
import { parseClamAVAlertFacts, renderClamAVMetricSummary } from './AlertsDisplay';

import type { SaltActionValue } from '../../lib/salt';
import { AlertsDetailEmptyState } from './AlertsDetailEmptyState';
import type { AlertsListRecord, AlertsRelatedRecord } from './types';

interface AlertsDetailPaneProps {
  selectedAlert: AlertsListRecord | null;
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
  relatedAlerts: AlertsRelatedRecord[];
  relatedAlertsLoading: boolean;
  onOpenAsset: () => void;
  onStartTerminal: () => void;
  onOpenSaltConsole: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onRunPatch: () => void;
  onSelectedSaltActionChange: (value: SaltActionValue) => void;
  onCustomSaltInputChange: (value: string) => void;
  renderSystemName: (alert: AlertsListRecord) => string;
  renderSeverityClassName: (alert: AlertsListRecord) => string;
  renderSourceBadgeClassName: (value: string) => string;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
  renderSourceLabel: (value: string) => string;
  renderAlertStatusClassName: (alert: AlertsListRecord) => string;
  renderAlertStatusLabel: (alert: AlertsListRecord) => string;
  renderAlertUser: (alert: AlertsListRecord) => string;
  renderSeverityDotClassName: (alert: AlertsListRecord) => string;
  formatRelativeTime: (value: string) => string;
  formatAbsoluteTime: (value: string) => string;
}

export function AlertsDetailPane({
  selectedAlert,
  darkMode = false,
  renderSystemName,
  renderSeverityClassName,
  renderSourceBadgeClassName,
  renderSourceIcon,
  renderSourceLabel,
  renderAlertStatusClassName,
  renderAlertStatusLabel,
  formatRelativeTime,
  formatAbsoluteTime,
}: AlertsDetailPaneProps) {
  const clamavFacts = selectedAlert ? parseClamAVAlertFacts(selectedAlert) : null;
  const clamavMetricSummary = selectedAlert ? renderClamAVMetricSummary(selectedAlert) : '';
  const errorDetail = selectedAlert
    ? (selectedAlert.detail || clamavFacts?.detail || 'No error detail provided.').trim()
    : '';

  return (
    <div className={`min-h-[420px] overflow-hidden rounded-[32px] border shadow-[0_24px_60px_rgba(15,23,42,0.12)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto ${darkMode ? 'border-white/10 bg-slate-950/90 text-white' : 'border-zinc-200 bg-white/95'}`}>
      {selectedAlert ? (
        <div aria-labelledby="alert-detail-title">
          <div className={`border-b px-6 py-6 ${darkMode ? 'border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.10),_transparent_24%),linear-gradient(135deg,_#08111f_0%,_#111827_58%,_#1f2937_100%)]' : 'border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_58%,_#fff8ef_100%)]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSeverityClassName(selectedAlert)}`}>{selectedAlert.severity || 'unknown'}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSourceBadgeClassName(selectedAlert.source)}`}>{renderSourceIcon(selectedAlert.source)}{selectedAlert.sourceLabel || renderSourceLabel(selectedAlert.source)}</span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderAlertStatusClassName(selectedAlert)}`}>{renderAlertStatusLabel(selectedAlert)}</span>
                {clamavFacts?.scannedFiles !== undefined ? <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700">Scanned {clamavFacts.scannedFiles}</span> : null}
                {clamavFacts?.infectedFiles !== undefined ? <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700">Infected {clamavFacts.infectedFiles}</span> : null}
              </div>
              <div className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'border-sky-400/20 bg-sky-500/15 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                Full Details
              </div>
              <h2 id="alert-detail-title" className={`mt-3 text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedAlert.title}</h2>
              {clamavMetricSummary ? <div className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{clamavMetricSummary}</div> : null}
              <p className={`mt-2 max-w-2xl text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>Full detail for the selected alert. Use the feed to switch to another issue.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className={`rounded-[22px] border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/45' : 'border-white/80 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Alert source</div>
                  <div className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedAlert.sourceLabel || renderSourceLabel(selectedAlert.source)}</div>
                </div>
                <div className={`rounded-[22px] border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/45' : 'border-white/80 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Current state</div>
                  <div className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{renderAlertStatusLabel(selectedAlert)}</div>
                </div>
                <div className={`rounded-[22px] border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/45' : 'border-white/80 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Last seen</div>
                  <div className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{formatRelativeTime(selectedAlert.createdAt)}</div>
                </div>
              </div>
            </div>
            <div className={`rounded-[24px] border px-4 py-3 text-right shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-white/95'}`}>
              <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Selected Asset</div>
              <div className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{selectedAlert.assetTag || selectedAlert.hostname || renderSystemName(selectedAlert)}</div>
              <div className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{formatRelativeTime(selectedAlert.createdAt)}</div>
            </div>
          </div>
          </div>

          <div className={`${darkMode ? 'bg-[linear-gradient(180deg,_#0b1220_0%,_#111827_100%)]' : 'bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'} px-6 py-5`}>
            <div className={`rounded-[28px] border px-5 py-5 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-white'}`}>
              <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Full Details</div>
              <div className={`mt-3 rounded-[22px] border px-4 py-4 text-sm leading-7 shadow-sm ${darkMode ? 'border-white/10 bg-slate-900/70 text-slate-200' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] text-zinc-700'}`}>
                <div className="whitespace-pre-wrap break-words">{errorDetail}</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[18px] border px-4 py-3 ${darkMode ? 'border-white/10 bg-slate-900/70' : 'border-zinc-200 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Affected Asset</div>
                  <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{selectedAlert.assetTag || selectedAlert.hostname || renderSystemName(selectedAlert)}</div>
                </div>
                <div className={`rounded-[18px] border px-4 py-3 ${darkMode ? 'border-white/10 bg-slate-900/70' : 'border-zinc-200 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Created</div>
                  <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{formatAbsoluteTime(selectedAlert.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AlertsDetailEmptyState darkMode={darkMode} />
      )}
    </div>
  );
}