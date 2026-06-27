import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Monitor, Wrench } from 'lucide-react';
import { actionButtonStyles } from '../../lib/buttonStyles';

interface DeviceDetailOverviewCard {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface DeviceDetailOverviewProps {
  hostname: string;
  assetId: string;
  deviceType?: string | null;
  osName?: string | null;
  computeAsset: boolean;
  canOperate: boolean;
  startingTerminal: boolean;
  canStartTerminal: boolean;
  canOpenPatchConsole: boolean;
  maintenanceUntil?: string | null;
  onBack: () => void;
  onStartTerminal: () => void;
  onRemoteDesktop?: () => void;
  onOpenSaltConsole: () => void;
  onToggleMaintenance: () => void;
  error: string;
  successMessage: string;
  overviewCards: DeviceDetailOverviewCard[];
  detailSections: ReadonlyArray<readonly [string, string]>;
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
}

export default function DeviceDetailOverview({
  hostname,
  assetId,
  deviceType,
  osName,
  computeAsset,
  canOperate,
  startingTerminal,
  canStartTerminal,
  canOpenPatchConsole,
  maintenanceUntil,
  onBack,
  onStartTerminal,
  onRemoteDesktop,
  onOpenSaltConsole,
  onToggleMaintenance,
  error,
  successMessage,
  overviewCards,
  detailSections,
  activeSection,
  onSelectSection,
}: DeviceDetailOverviewProps) {
  const isInMaintenance = maintenanceUntil && new Date(maintenanceUntil) > new Date();
  return (
    <>
      <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(163,230,53,0.12),_transparent_24%),linear-gradient(135deg,_#f6fdf8_0%,_#ffffff_58%,_#f6fbf7_100%)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <button type="button" onClick={onBack} className="rounded-2xl border border-zinc-200 bg-white p-2.5 text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                Device Workspace
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">{hostname}</h1>
              <p className="mt-1 text-sm text-zinc-600">{assetId} • {deviceType || 'Device'}{computeAsset ? ` • ${osName || 'Unknown OS'}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  {computeAsset ? 'Compute Asset' : 'Inventory Asset'}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  {detailSections.length} sections
                </span>
              </div>
            </div>
          </div>
          {computeAsset && canOperate ? <div className="flex flex-wrap gap-2.5 lg:justify-end">
            <button type="button" onClick={onToggleMaintenance} className={`rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-sm transition ${isInMaintenance ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'}`}>
              <Wrench className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
              {isInMaintenance ? 'In Maintenance' : 'Maintenance Mode'}
            </button>
            <button type="button" onClick={onStartTerminal} disabled={startingTerminal || !canStartTerminal} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60">
              {startingTerminal ? 'Opening SSH terminal...' : 'Open SSH Terminal'}
            </button>
            {onRemoteDesktop && (
              <button type="button" onClick={onRemoteDesktop} className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-100">
                <Monitor className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
                Remote Desktop
              </button>
            )}
            <button type="button" onClick={onOpenSaltConsole} disabled={!canOpenPatchConsole} className={`rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}>
              Open Salt Console
            </button>
          </div> : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">{successMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{card.label}</span>
              <card.icon className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="text-xl font-black text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      {detailSections.length ? <div className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-zinc-200 bg-white/95 px-2.5 py-2.5 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1.5">
          {detailSections.map(([sectionId, label]) => (
            <button
              key={sectionId}
              type="button"
              onClick={() => onSelectSection(sectionId)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${activeSection === sectionId ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-zinc-200 bg-white text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div> : null}
    </>
  );
}