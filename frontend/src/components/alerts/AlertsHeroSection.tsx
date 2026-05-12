import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

import type { AlertsDashboardModuleCard } from './types';

interface AlertsHeroSectionProps {
  feedLabel: string;
  totalAlerts: number;
  openCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  sourceCountMap: Map<string, number>;
  moduleCards?: AlertsDashboardModuleCard[];
  sourceFilter: string;
  readOnlyReview?: boolean;
  onSelectSourceFilter: (value: string) => void;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
}

function moduleCardChrome(statusColor: AlertsDashboardModuleCard['statusColor']) {
  if (statusColor === 'red') {
    return 'border-rose-200 bg-rose-50/90';
  }
  if (statusColor === 'yellow') {
    return 'border-amber-200 bg-amber-50/90';
  }
  return 'border-emerald-200 bg-emerald-50/90';
}

function moduleCardDot(statusColor: AlertsDashboardModuleCard['statusColor']) {
  if (statusColor === 'red') {
    return 'bg-rose-500';
  }
  if (statusColor === 'yellow') {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

function moduleCardMetricLabels(source: AlertsDashboardModuleCard['source']) {
  if (source === 'clamav') {
    return {
      scanned: 'Systems Scanned',
      clean: 'Clean Systems',
      error: 'Infected Systems',
    };
  }

  return {
    scanned: 'Systems Scanned',
    clean: 'Clean Systems',
    error: 'Error Systems',
  };
}

export function AlertsHeroSection({
  feedLabel,
  totalAlerts,
  openCount,
  acknowledgedCount,
  resolvedCount,
  sourceCountMap,
  moduleCards = [],
  sourceFilter,
  readOnlyReview = false,
  onSelectSourceFilter,
  renderSourceIcon,
}: AlertsHeroSectionProps) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,_#fafaf9_0%,_#ffffff_52%,_#eefbf3_100%)] px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
              <ShieldAlert className="mr-2 h-3.5 w-3.5" />
              {feedLabel}
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Alerts</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{readOnlyReview ? 'Review endpoint, hardening, malware, patching, and file-watch events in one read-only queue tailored for audit checks.' : 'Track endpoint, hardening, malware, patching, and file-watch events in one queue that matches the requests workspace layout.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[500px]">
            <div className="rounded-xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total</div>
              <div className="mt-1.5 text-2xl font-black text-zinc-950">{totalAlerts}</div>
            </div>
            <div className="rounded-xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Open</div>
              <div className="mt-1.5 text-2xl font-black text-zinc-950">{openCount}</div>
            </div>
            <div className="rounded-xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Acknowledged</div>
              <div className="mt-1.5 text-2xl font-black text-zinc-950">{acknowledgedCount}</div>
            </div>
            <div className="rounded-xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Resolved</div>
              <div className="mt-1.5 text-2xl font-black text-zinc-950">{resolvedCount}</div>
            </div>
          </div>

          <div className="grid gap-2 pt-2 md:grid-cols-3 xl:min-w-[720px]">
              {moduleCards.map((entry) => {
                const metricLabels = moduleCardMetricLabels(entry.source);

                return (
                <button
                  key={entry.source}
                  type="button"
                  onClick={() => onSelectSourceFilter(entry.source)}
                  className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition ${sourceFilter === entry.source ? 'border-brand-300 bg-brand-50 text-brand-800' : `${moduleCardChrome(entry.statusColor)} text-zinc-700 hover:bg-white`}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {renderSourceIcon(entry.source, 'h-3.5 w-3.5')}
                      <span className="truncate">{entry.label}</span>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${moduleCardDot(entry.statusColor)}`} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-zinc-600">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{metricLabels.scanned}</div>
                      <div className="mt-1 text-lg font-black text-zinc-950">{entry.totalSystemsScanned}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{metricLabels.clean}</div>
                      <div className="mt-1 text-lg font-black text-emerald-700">{entry.cleanSystemsCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{metricLabels.error}</div>
                      <div className="mt-1 text-lg font-black text-rose-700">{entry.errorSystemsCount}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>Queue {sourceCountMap.get(entry.source) || 0}</span>
                    <span>{entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : 'No scans yet'}</span>
                  </div>
                </button>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}