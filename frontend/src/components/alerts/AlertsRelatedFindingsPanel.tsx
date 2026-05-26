import type { ReactNode } from 'react';

import { renderAlertDetailPreview } from './AlertsDisplay';
import type { AlertsRelatedRecord } from './types';

interface AlertsRelatedFindingsPanelProps {
  relatedAlerts: AlertsRelatedRecord[];
  relatedAlertsLoading: boolean;
  darkMode?: boolean;
  renderSeverityDotClassName: (alert: AlertsRelatedRecord & { deviceId: string }) => string;
  renderAlertStatusClassName: (alert: AlertsRelatedRecord & { deviceId: string }) => string;
  renderAlertStatusLabel: (alert: AlertsRelatedRecord & { deviceId: string }) => string;
  renderSourceBadgeClassName: (value: string) => string;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
  renderSourceLabel: (value: string) => string;
  formatRelativeTime: (value: string) => string;
}

export function AlertsRelatedFindingsPanel({
  relatedAlerts,
  relatedAlertsLoading,
  darkMode = false,
  renderSeverityDotClassName,
  renderAlertStatusClassName,
  renderAlertStatusLabel,
  renderSourceBadgeClassName,
  renderSourceIcon,
  renderSourceLabel,
  formatRelativeTime,
}: AlertsRelatedFindingsPanelProps) {
  return (
    <aside className={`rounded-[24px] border p-4 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
      <div className={`flex items-center justify-between gap-3 border-b pb-3 ${darkMode ? 'border-white/10' : 'border-zinc-200'}`}>
        <div>
          <div className={`text-sm font-black ${darkMode ? 'text-white' : 'text-zinc-900'}`}>Asset Findings</div>
          <div className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Other recent issues on this same asset.</div>
        </div>
        {relatedAlerts.length > 0 ? <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] shadow-sm ${darkMode ? 'border-white/10 bg-slate-900 text-slate-200' : 'border-zinc-200 bg-white text-zinc-700'}`}>{relatedAlerts.length}</span> : null}
      </div>
      <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {relatedAlertsLoading ? <div className={`rounded-[24px] border p-4 text-sm shadow-sm ${darkMode ? 'border-white/10 bg-slate-900 text-slate-400' : 'border-zinc-200 bg-white text-zinc-500'}`}>Loading related findings...</div> : null}
        {!relatedAlertsLoading && relatedAlerts.length === 0 ? <div className={`rounded-[24px] border border-dashed p-4 text-sm shadow-sm ${darkMode ? 'border-white/10 bg-slate-900 text-slate-400' : 'border-zinc-200 bg-white text-zinc-500'}`}>No additional findings on this asset.</div> : null}
        {relatedAlerts.map((item) => {
          const relatedAlertRecord = { ...item, deviceId: item.id };

          return (
            <div key={item.id} className={`rounded-[24px] border p-3 shadow-sm transition hover:-translate-y-0.5 ${darkMode ? 'border-white/10 bg-slate-900 hover:border-sky-400/30' : 'border-zinc-200 bg-white hover:border-sky-200'}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${renderSeverityDotClassName(relatedAlertRecord)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`text-sm font-black ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{item.title}</div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${renderAlertStatusClassName(relatedAlertRecord)}`}>{renderAlertStatusLabel(relatedAlertRecord)}</span>
                  </div>
                  <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSourceBadgeClassName(item.source)}`}>{renderSourceIcon(item.source, 'h-3 w-3')}{renderSourceLabel(item.source)}</span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  <div className={`mt-2 line-clamp-2 text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>{renderAlertDetailPreview({ ...item, deviceId: item.id } as AlertsRelatedRecord & { deviceId: string }, 160)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}