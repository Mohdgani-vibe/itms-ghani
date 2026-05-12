import type { ReactNode } from 'react';

import { renderAlertDetailPreview } from './AlertsDisplay';
import type { AlertsRelatedRecord } from './types';

interface AlertsRelatedFindingsPanelProps {
  relatedAlerts: AlertsRelatedRecord[];
  relatedAlertsLoading: boolean;
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
  renderSeverityDotClassName,
  renderAlertStatusClassName,
  renderAlertStatusLabel,
  renderSourceBadgeClassName,
  renderSourceIcon,
  renderSourceLabel,
  formatRelativeTime,
}: AlertsRelatedFindingsPanelProps) {
  return (
    <aside className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="text-sm font-bold text-zinc-900">Asset Findings</div>
          <div className="mt-1 text-xs text-zinc-500">Other recent issues on this same asset.</div>
        </div>
        {relatedAlerts.length > 0 ? <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700 shadow-sm">{relatedAlerts.length}</span> : null}
      </div>
      <div className="mt-4 space-y-3">
        {relatedAlertsLoading ? <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">Loading related findings...</div> : null}
        {!relatedAlertsLoading && relatedAlerts.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">No additional findings on this asset.</div> : null}
        {relatedAlerts.map((item) => {
          const relatedAlertRecord = { ...item, deviceId: item.id };

          return (
            <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${renderSeverityDotClassName(relatedAlertRecord)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${renderAlertStatusClassName(relatedAlertRecord)}`}>{renderAlertStatusLabel(relatedAlertRecord)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${renderSourceBadgeClassName(item.source)}`}>{renderSourceIcon(item.source, 'h-3 w-3')}{renderSourceLabel(item.source)}</span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{renderAlertDetailPreview({ ...item, deviceId: item.id } as AlertsRelatedRecord & { deviceId: string }, 160)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}