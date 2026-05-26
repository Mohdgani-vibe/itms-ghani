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

export function AlertsDashboardSourceGrid({ cards, formatNumber, onOpenSource }: AlertsDashboardSourceGridProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {cards.map((card) => (
        <article key={card.source} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:shadow-[0_22px_42px_rgba(15,23,42,0.11)]">
          <button type="button" onClick={() => onOpenSource(card.source)} className="w-full text-left">
            <div className="flex items-start gap-4">
              <div className={`rounded-[18px] p-3 shadow-sm ${card.accentClassName}`}>
                {card.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Source</div>
                    <h2 className="mt-2 text-xl font-black text-zinc-950">{card.label}</h2>
                    <p className="mt-1 text-sm leading-5 text-zinc-500">{card.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${healthToneClassName(card.healthTone)}`}>{card.healthStatus}</span>
                    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">Risk {card.riskScore}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[18px] border border-white/90 bg-white/95 px-3 py-3 shadow-sm">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.scannedCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Scanned</div>
              </div>
              <div className="rounded-[18px] border border-white/90 bg-white/95 px-3 py-3 shadow-sm">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.issueCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{card.issueLabel}</div>
              </div>
              <div className="rounded-[18px] border border-white/90 bg-white/95 px-3 py-3 shadow-sm">
                <div className="text-lg font-black text-zinc-900">{formatNumber(card.alertCount)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Alerts</div>
              </div>
            </div>
          </button>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white/80 px-3 py-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Last scan</div>
              <div className="truncate text-sm font-semibold text-zinc-700">{card.lastScanLabel}</div>
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