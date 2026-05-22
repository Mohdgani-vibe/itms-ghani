import type { ReactNode } from 'react';
import { Activity, ArrowRight, ShieldAlert, TerminalSquare } from 'lucide-react';

import { actionButtonStyles } from '../../lib/buttonStyles';
import { AlertsSparklineChart } from './AlertsSparklineChart';

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
  onOpenConsole: (source: string) => void;
  onInvestigate: (source: string) => void;
}

function healthToneClassName(tone: AlertsDashboardSourceGridCard['healthTone']) {
  if (tone === 'critical') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function AlertsDashboardSourceGrid({ cards, formatNumber, onOpenSource, onOpenConsole, onInvestigate }: AlertsDashboardSourceGridProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {cards.map((card) => (
        <article key={card.source} className="group rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
          <button type="button" onClick={() => onOpenSource(card.source)} className="w-full text-left">
            <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3 ${card.accentClassName}`}>
              {card.icon}
            </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-950">{card.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{card.description}</p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${healthToneClassName(card.healthTone)}`}>{card.healthStatus}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xl font-bold text-zinc-900">{formatNumber(card.scannedCount)}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Scanned</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xl font-bold text-zinc-900">{formatNumber(card.issueCount)}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{card.issueLabel}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xl font-bold text-zinc-900">{formatNumber(card.alertCount)}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Alerts</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xl font-bold text-zinc-900">{formatNumber(card.systemsAffected)}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Affected</div>
            </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_140px]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Threat trend</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-700">Last scan {card.lastScanLabel}</div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-700 shadow-sm">Risk {card.riskScore}</div>
                </div>
                <div className="mt-4">
                  <AlertsSparklineChart values={card.sparklineValues} />
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Active alerts</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">{formatNumber(card.alertCount)}</div>
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
                  <Activity className="h-3.5 w-3.5 text-sky-500" />
                  Live module telemetry
                </div>
              </div>
            </div>
          </button>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => onOpenSource(card.source)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${actionButtonStyles.add}`}>
              <ArrowRight className="h-4 w-4" />
              View Alerts
            </button>
            <button type="button" onClick={() => onOpenConsole(card.source)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50">
              <TerminalSquare className="h-4 w-4" />
              Open Console
            </button>
            <button type="button" onClick={() => onInvestigate(card.source)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800">
              <ShieldAlert className="h-4 w-4" />
              Investigate
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}