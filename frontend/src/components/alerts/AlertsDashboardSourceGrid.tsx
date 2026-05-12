import type { ReactNode } from 'react';

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
  lastScanLabel: string;
}

interface AlertsDashboardSourceGridProps {
  cards: AlertsDashboardSourceGridCard[];
  formatNumber: (value?: number | null) => string;
  onOpenSource: (source: string) => void;
}

export function AlertsDashboardSourceGrid({ cards, formatNumber, onOpenSource }: AlertsDashboardSourceGridProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {cards.map((card) => (
        <article key={card.source} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3 ${card.accentClassName}`}>
              {card.icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-950">{card.label}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{card.description}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
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
          </div>
          <div className="mt-5 text-sm text-zinc-500">Last scan: {card.lastScanLabel}</div>
          <button
            type="button"
            onClick={() => onOpenSource(card.source)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-50"
          >
            Open Source
          </button>
        </article>
      ))}
    </div>
  );
}