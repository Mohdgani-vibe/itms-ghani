import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

import { actionButtonStyles } from '../../lib/buttonStyles';

interface AlertsDashboardSourceGridCard {
  source: string;
  label: string;
  description: string;
  accentClassName: string;
  icon: ReactNode;
  scannedCount: number;
  issueCount: number;
  issueLabel: string;
  alertCount: number;
  systemsAffected: number;
  healthStatus: string;
  healthTone: 'healthy' | 'warning' | 'critical';
  riskScore: number;
  lastScanLabel: string;
  sparklineValues: number[];
  departmentCount: number;
  affectedDepartmentCount: number;
  affectedDepartmentPercent: number;
  fixedRatePercent: number;
}

interface AlertsDashboardSourceGridProps {
  cards: AlertsDashboardSourceGridCard[];
  formatNumber: (value?: number | null) => string;
  onOpenSource: (source: string) => void;
}

function healthToneClassName(tone: AlertsDashboardSourceGridCard['healthTone']) {
  if (tone === 'critical') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function sourceArticleClassName(source: string) {
  if (source === 'openscap') {
    return 'hover:border-indigo-200/70';
  }
  if (source === 'clamav') {
    return 'hover:border-rose-200/70';
  }
  return 'hover:border-sky-200/70';
}

function sourceTopAccentClassName(source: string) {
  if (source === 'openscap') {
    return 'bg-[linear-gradient(90deg,_rgba(99,102,241,0.96)_0%,_rgba(129,140,248,0.78)_50%,_rgba(224,231,255,0.42)_100%)]';
  }
  if (source === 'clamav') {
    return 'bg-[linear-gradient(90deg,_rgba(244,63,94,0.96)_0%,_rgba(251,113,133,0.78)_50%,_rgba(255,228,230,0.42)_100%)]';
  }
  return 'bg-[linear-gradient(90deg,_rgba(14,165,233,0.96)_0%,_rgba(56,189,248,0.78)_50%,_rgba(219,234,254,0.42)_100%)]';
}

function sourceBadgeClassName(source: string) {
  if (source === 'openscap') {
    return 'border-indigo-100/80 bg-indigo-50/70 text-indigo-700';
  }
  if (source === 'clamav') {
    return 'border-rose-100/80 bg-rose-50/70 text-rose-700';
  }
  return 'border-sky-100/80 bg-sky-50/70 text-sky-700';
}

function sourceMetricTintClassName(source: string) {
  if (source === 'openscap') {
    return 'border-indigo-100/80 bg-indigo-50/36';
  }
  if (source === 'clamav') {
    return 'border-rose-100/80 bg-rose-50/36';
  }
  return 'border-sky-100/80 bg-sky-50/36';
}

function sourceFooterBadgeClassName(source: string) {
  if (source === 'openscap') {
    return 'border-white/75 bg-indigo-50/75 text-indigo-700';
  }
  if (source === 'clamav') {
    return 'border-white/75 bg-rose-50/75 text-rose-700';
  }
  return 'border-white/75 bg-sky-50/75 text-sky-700';
}

export function AlertsDashboardSourceGrid({ cards, formatNumber, onOpenSource }: AlertsDashboardSourceGridProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {cards.map((card) => (
        <article key={card.source} className={`group overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.68)_0%,_rgba(248,251,255,0.52)_100%)] p-4 shadow-[0_22px_48px_rgba(15,23,42,0.11)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(15,23,42,0.14)] ${sourceArticleClassName(card.source)}`}>
          <div className={`mb-4 h-1.5 rounded-full opacity-90 transition group-hover:opacity-100 ${sourceTopAccentClassName(card.source)}`} />
          <button type="button" onClick={() => onOpenSource(card.source)} className="w-full text-left">
            <div className="flex items-start gap-4">
              <div className={`rounded-[18px] border border-white/70 p-3 shadow-sm backdrop-blur-xl ${card.accentClassName}`}>
                {card.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] backdrop-blur-lg ${sourceBadgeClassName(card.source)}`}>Source</div>
                    <h2 className="mt-2 text-xl font-black text-zinc-950">{card.label}</h2>
                    <p className="mt-1 text-sm leading-5 text-zinc-500">{card.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${healthToneClassName(card.healthTone)}`}>{card.healthStatus}</span>
                    <span className="rounded-full border border-white/75 bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 backdrop-blur-lg">Risk {card.riskScore}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[18px] border border-white/80 bg-white/60 px-3 py-3 shadow-sm backdrop-blur-xl">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.scannedCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Scanned</div>
              </div>
              <div className="rounded-[18px] border border-white/80 bg-white/60 px-3 py-3 shadow-sm backdrop-blur-xl">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.issueCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{card.issueLabel}</div>
              </div>
              <div className="rounded-[18px] border border-white/80 bg-white/60 px-3 py-3 shadow-sm backdrop-blur-xl">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.alertCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Alerts</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-[18px] border px-3 py-3 shadow-sm backdrop-blur-xl ${sourceMetricTintClassName(card.source)}`}>
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Departments with findings</div>
                <div className="mt-2 text-sm font-black text-zinc-900">{formatNumber(card.affectedDepartmentCount)}/{formatNumber(card.departmentCount)}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{card.affectedDepartmentPercent}% of current department scope</div>
              </div>
              <div className={`rounded-[18px] border px-3 py-3 shadow-sm backdrop-blur-xl ${sourceMetricTintClassName(card.source)}`}>
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Systems passing</div>
                <div className="mt-2 text-sm font-black text-zinc-900">{card.fixedRatePercent}%</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">Healthy systems in the current scan set</div>
              </div>
            </div>
          </button>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-white/60 px-3 py-3 backdrop-blur-xl">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Last scan</div>
              <div className="truncate text-sm font-semibold text-zinc-700">{card.lastScanLabel}</div>
            </div>
            <div className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] backdrop-blur-lg md:inline-flex ${sourceFooterBadgeClassName(card.source)}`}>
              Full source view
            </div>
            <button type="button" onClick={() => onOpenSource(card.source)} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${actionButtonStyles.add}`}>
              <ArrowRight className="h-4 w-4" />
              View Alerts
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}