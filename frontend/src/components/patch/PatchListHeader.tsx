import type { ComponentType } from 'react';
import { actionButtonStyles } from '../../lib/buttonStyles';

interface PatchListHeaderProps {
  basePath: string;
  navigate: (path: string) => void;
  canOperate: boolean;
  runningPatch: boolean;
  selectedDepartment: string;
  totalDevices: number;
  PlayIcon: ComponentType<{ className?: string }>;
  onRunDepartmentPatch: () => void;
}

export default function PatchListHeader({
  basePath,
  navigate,
  canOperate,
  runningPatch,
  selectedDepartment,
  totalDevices,
  PlayIcon,
  onRunDepartmentPatch,
}: PatchListHeaderProps) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(8,15,26,0.96)_0%,_rgba(17,24,39,0.98)_52%,_rgba(30,41,59,0.98)_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.22),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.16),_transparent_24%),linear-gradient(135deg,_rgba(8,15,26,0.92)_0%,_rgba(17,24,39,0.9)_52%,_rgba(30,41,59,0.84)_100%)] p-6 lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-100">
              Patch Device Runway
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Patch devices with more signal and less admin clutter.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review the active device queue, keep department scope visible, and launch Salt patch or console actions from a cleaner operations surface.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              <span className="rounded-full border border-sky-400/20 bg-white/5 px-3 py-1">Device queue</span>
              <span className="rounded-full border border-amber-400/20 bg-white/5 px-3 py-1">Scoped rollout control</span>
              <span className="rounded-full border border-emerald-400/20 bg-white/5 px-3 py-1">Report reopen path</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 shadow-sm backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Scope</div>
              <div className="mt-2 text-lg font-black text-white">{selectedDepartment === 'all' ? 'All Departments' : selectedDepartment}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 shadow-sm backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Managed Devices</div>
              <div className="mt-2 text-lg font-black text-white">{totalDevices}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 shadow-sm backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mode</div>
              <div className="mt-2 text-lg font-black text-white">{canOperate ? 'Active Control' : 'Read Only'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => navigate(`${basePath}/patch`)} className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-bold text-slate-100 shadow-sm transition hover:bg-white/14">
            Dashboard
          </button>
          <button type="button" onClick={onRunDepartmentPatch} disabled={!canOperate || runningPatch || totalDevices === 0} className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold shadow-sm transition disabled:opacity-60 ${actionButtonStyles.add}`}>
            <PlayIcon className="mr-2 h-4 w-4" />
            {runningPatch ? 'Running department patch...' : `Run ${selectedDepartment === 'all' ? 'All Departments' : selectedDepartment} Patch`}
          </button>
        </div>
      </div>
    </section>
  );
}