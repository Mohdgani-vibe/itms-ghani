import type { ComponentType } from 'react';

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
    <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-sm shadow-sky-100/70">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_54%,_#fff8ef_100%)] p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
              Patch Operations
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Deployment & Devices</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review device patch readiness, launch department-wide Salt patch runs, and reopen saved reports from a single operations workspace.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Scope</div>
              <div className="mt-2 text-lg font-black text-slate-950">{selectedDepartment === 'all' ? 'All Departments' : selectedDepartment}</div>
            </div>
            <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Managed Devices</div>
              <div className="mt-2 text-lg font-black text-slate-950">{totalDevices}</div>
            </div>
            <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Mode</div>
              <div className="mt-2 text-lg font-black text-slate-950">{canOperate ? 'Active Control' : 'Read Only'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => navigate(`${basePath}/patch`)} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
            Dashboard
          </button>
          <button type="button" onClick={onRunDepartmentPatch} disabled={!canOperate || runningPatch || totalDevices === 0} className="inline-flex items-center justify-center rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
            <PlayIcon className="mr-2 h-4 w-4" />
            {runningPatch ? 'Running department patch...' : `Run ${selectedDepartment === 'all' ? 'All Departments' : selectedDepartment} Patch`}
          </button>
        </div>
      </div>
    </section>
  );
}