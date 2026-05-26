import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

import Pagination from '../Pagination';
import type { AlertsListRecord } from './types';
import { parseClamAVAlertFacts, renderAlertDetailPreview, renderClamAVMetricSummary } from './AlertsDisplay';

interface AlertsFeedPaneProps {
  loading: boolean;
  alerts: AlertsListRecord[];
  selectedAlertId?: string;
  readOnlyReview?: boolean;
  onSelectAlert: (alert: AlertsListRecord, alerts: AlertsListRecord[]) => void;
  totalAlerts: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  renderSystemName: (alert: AlertsListRecord) => string;
  renderAlertStatusClassName: (alert: AlertsListRecord) => string;
  renderAlertStatusLabel: (alert: AlertsListRecord) => string;
  renderSeverityDotClassName: (alert: AlertsListRecord) => string;
  formatRelativeTime: (value: string) => string;
  renderSourceBadgeClassName: (value: string) => string;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
  renderSourceLabel: (value: string) => string;
  renderAlertAsset: (alert: AlertsListRecord) => string;
}

export function AlertsFeedPane({
  loading,
  alerts,
  selectedAlertId,
  readOnlyReview = false,
  onSelectAlert,
  totalAlerts,
  currentPage,
  pageSize,
  onPageChange,
  renderSystemName,
  renderAlertStatusClassName,
  renderAlertStatusLabel,
  renderSeverityDotClassName,
  formatRelativeTime,
  renderSourceBadgeClassName,
  renderSourceIcon,
  renderSourceLabel,
  renderAlertAsset,
}: AlertsFeedPaneProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] lg:max-h-[calc(100vh-15rem)] lg:min-h-[42rem] lg:overflow-hidden">
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#eef7ff_100%)] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Live queue</div>
            <div className="mt-2 text-sm font-black text-zinc-900">Alert Feed</div>
            <div className="mt-1 text-xs text-zinc-500">{readOnlyReview ? 'Review incidents by source and inspect the selected asset from the detail panel.' : 'Review incidents by source, inspect the selected asset, and act from the panel on the right.'}</div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 md:flex">
            <ShieldAlert className="h-4 w-4" />
            {totalAlerts} tracked
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 md:p-5 lg:max-h-[calc(100vh-24rem)] lg:overflow-y-auto">
        {loading ? <div className="rounded-[24px] border border-slate-200 bg-sky-50/40 p-6 text-sm text-zinc-500 shadow-sm">Loading alerts...</div> : null}
        {!loading && alerts.length === 0 ? <div className="rounded-[24px] border border-slate-200 bg-sky-50/40 p-6 text-sm text-zinc-500 shadow-sm">No alerts found.</div> : null}
        {alerts.map((alert) => {
          const isActive = selectedAlertId === alert.id;
          const clamavFacts = parseClamAVAlertFacts(alert);
          const clamavMetricSummary = renderClamAVMetricSummary(alert);
          return (
            <article
              key={alert.id}
              onClick={() => onSelectAlert(alert, alerts)}
              className={`cursor-pointer rounded-[24px] border px-4 py-4 shadow-sm transition ${isActive ? 'border-sky-300 bg-sky-50/80 shadow-md ring-1 ring-sky-100' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-md'}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${renderSeverityDotClassName(alert)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-black text-zinc-950">{renderSystemName(alert)}</h2>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${renderAlertStatusClassName(alert)}`}>{renderAlertStatusLabel(alert)}</span>
                      </div>
                        <div className="mt-1 text-sm font-medium text-zinc-700">{alert.title}</div>
                    </div>
                    <div className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{formatRelativeTime(alert.createdAt)}</div>
                  </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold shadow-sm ${renderSourceBadgeClassName(alert.source)}`}>{renderSourceIcon(alert.source)}{alert.sourceLabel || renderSourceLabel(alert.source)}</span>
                      <span className="font-medium text-zinc-500">{renderAlertAsset(alert)}</span>
                      {clamavFacts?.infectedFiles !== undefined ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">Infected {clamavFacts.infectedFiles}</span> : null}
                      {clamavFacts?.errorCount !== undefined ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">Errors {clamavFacts.errorCount}</span> : null}
                  </div>
                    {clamavMetricSummary ? <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{clamavMetricSummary}</div> : null}
                    <div className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">{renderAlertDetailPreview(alert, 180)}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalAlerts}
        pageSize={pageSize}
        onPageChange={onPageChange}
        itemLabel="alerts"
      />
    </div>
  );
}