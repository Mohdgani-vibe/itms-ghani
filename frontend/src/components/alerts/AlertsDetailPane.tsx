import type { ReactNode } from 'react';
import { AlertsDetailActionsPanel } from './AlertsDetailActionsPanel';
import { parseClamAVAlertFacts, renderClamAVMetricSummary } from './AlertsDisplay';
import { AlertsDetailMetadataPanel } from './AlertsDetailMetadataPanel';

import type { SaltActionValue } from '../../lib/salt';
import { AlertsDetailEmptyState } from './AlertsDetailEmptyState';
import { AlertsRelatedFindingsPanel } from './AlertsRelatedFindingsPanel';
import { renderAlertDetailPreview } from './AlertsDisplay';
import type { AlertsListRecord, AlertsRelatedRecord } from './types';

interface AlertsDetailPaneProps {
  selectedAlert: AlertsListRecord | null;
  selectedAlertSource: string;
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
  selectedAlertSource,
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
  relatedAlerts,
  relatedAlertsLoading,
  onOpenAsset,
  onStartTerminal,
  onOpenSaltConsole,
  onAcknowledge,
  onResolve,
  onRunPatch,
  onSelectedSaltActionChange,
  onCustomSaltInputChange,
  renderSystemName,
  renderSeverityClassName,
  renderSourceBadgeClassName,
  renderSourceIcon,
  renderSourceLabel,
  renderAlertStatusClassName,
  renderAlertStatusLabel,
  renderAlertUser,
  renderSeverityDotClassName,
  formatRelativeTime,
  formatAbsoluteTime,
}: AlertsDetailPaneProps) {
  const clamavFacts = selectedAlert ? parseClamAVAlertFacts(selectedAlert) : null;
  const clamavMetricSummary = selectedAlert ? renderClamAVMetricSummary(selectedAlert) : '';

  return (
    <div className="min-h-[420px] overflow-hidden rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      {selectedAlert ? (
        <div aria-labelledby="alert-detail-title">
          <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_58%,_#fff8ef_100%)] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSeverityClassName(selectedAlert)}`}>{selectedAlert.severity || 'unknown'}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSourceBadgeClassName(selectedAlert.source)}`}>{renderSourceIcon(selectedAlert.source)}{selectedAlert.sourceLabel || renderSourceLabel(selectedAlert.source)}</span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${renderAlertStatusClassName(selectedAlert)}`}>{renderAlertStatusLabel(selectedAlert)}</span>
                {clamavFacts?.scannedFiles !== undefined ? <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700">Scanned {clamavFacts.scannedFiles}</span> : null}
                {clamavFacts?.infectedFiles !== undefined ? <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700">Infected {clamavFacts.infectedFiles}</span> : null}
              </div>
              <div className="mt-4 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                Alert Investigation
              </div>
              <h2 id="alert-detail-title" className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{selectedAlert.title}</h2>
              {clamavMetricSummary ? <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{clamavMetricSummary}</div> : null}
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{renderAlertDetailPreview(selectedAlert, 260)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-right shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Selected Asset</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedAlert.assetTag || selectedAlert.hostname || renderSystemName(selectedAlert)}</div>
              <div className="mt-1 text-xs text-zinc-500">{formatRelativeTime(selectedAlert.createdAt)}</div>
            </div>
          </div>
          </div>

          <div className="bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-6 py-5">
            <AlertsDetailActionsPanel
              selectedAlert={selectedAlert}
              selectedAlertSource={selectedAlertSource}
              readOnlyReview={readOnlyReview}
              canAcknowledge={canAcknowledge}
              canResolve={canResolve}
              detailActionLoading={detailActionLoading}
              detailMessage={detailMessage}
              selectedAssetCanStartTerminal={selectedAssetCanStartTerminal}
              selectedAssetCanOpenPatchConsole={selectedAssetCanOpenPatchConsole}
              selectedAssetCanRunPatch={selectedAssetCanRunPatch}
              terminalBlockedReason={terminalBlockedReason}
              patchBlockedReason={patchBlockedReason}
              selectedSaltAction={selectedSaltAction}
              customSaltInput={customSaltInput}
              selectedPatchActionLabel={selectedPatchActionLabel}
              onOpenAsset={onOpenAsset}
              onStartTerminal={onStartTerminal}
              onOpenSaltConsole={onOpenSaltConsole}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onRunPatch={onRunPatch}
              onSelectedSaltActionChange={onSelectedSaltActionChange}
              onCustomSaltInputChange={onCustomSaltInputChange}
            />

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
              <AlertsDetailMetadataPanel
                selectedAlert={selectedAlert}
                renderSystemName={renderSystemName}
                renderAlertUser={renderAlertUser}
                formatAbsoluteTime={formatAbsoluteTime}
              />

              <AlertsRelatedFindingsPanel
                relatedAlerts={relatedAlerts}
                relatedAlertsLoading={relatedAlertsLoading}
                renderSeverityDotClassName={renderSeverityDotClassName}
                renderAlertStatusClassName={renderAlertStatusClassName}
                renderAlertStatusLabel={renderAlertStatusLabel}
                renderSourceBadgeClassName={renderSourceBadgeClassName}
                renderSourceIcon={renderSourceIcon}
                renderSourceLabel={renderSourceLabel}
                formatRelativeTime={formatRelativeTime}
              />
            </div>
          </div>
        </div>
      ) : (
        <AlertsDetailEmptyState />
      )}
    </div>
  );
}