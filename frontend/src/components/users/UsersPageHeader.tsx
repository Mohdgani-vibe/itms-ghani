import type { ComponentType } from 'react';

type DirectoryTab = 'directory' | 'employee' | 'imports' | 'install' | 'audit' | 'access' | 'unassigned';

interface UsersPageHeaderProps {
  directoryTotal: number;
  departmentCount: number;
  assetTotal: number;
  auditTotal: number;
  unassignedTotal: number;
  activeTab: DirectoryTab;
  isSuperAdmin: boolean;
  isAuditor: boolean;
  UsersIcon: ComponentType<{ className?: string }>;
  onTabChange: (tab: DirectoryTab) => void;
}

export default function UsersPageHeader({
  directoryTotal,
  departmentCount,
  assetTotal,
  auditTotal,
  unassignedTotal,
  activeTab,
  isSuperAdmin,
  isAuditor,
  UsersIcon,
  onTabChange,
}: UsersPageHeaderProps) {
  return (
    <>
      <div className="overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_58%,_#f6fbf7_100%)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
              Directory Workspace
            </div>
            <h1 className="mt-4 flex items-center text-3xl font-black tracking-tight text-zinc-950">
              <UsersIcon className="mr-3 h-7 w-7 text-sky-700" />
              {isSuperAdmin ? 'Superadmin User Portal' : isAuditor ? 'Auditor User Portal' : 'User Portal'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              {isAuditor
                ? 'Review the user directory and assigned assets across your allowed entities.'
                : 'Manage portal roles, review assigned assets, and track audit activity for users and assets.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Users</div>
              <div className="mt-2 text-xl font-bold text-zinc-900">{directoryTotal}</div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Departments</div>
              <div className="mt-2 text-xl font-bold text-zinc-900">{departmentCount}</div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Assets</div>
              <div className="mt-2 text-xl font-bold text-zinc-900">{assetTotal}</div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Audit Events</div>
              <div className="mt-2 text-xl font-bold text-zinc-900">{auditTotal}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'directory', label: 'Directory' },
          ...(!isAuditor ? [{ id: 'employee', label: 'Add Employee' }, { id: 'imports', label: 'Import / Export' }, { id: 'install', label: 'Install Agents' }] : []),
          ...(!isAuditor ? [{ id: 'audit', label: 'Audit' }] : []),
          ...(isSuperAdmin ? [{ id: 'access', label: 'Portal Access' }, { id: 'unassigned', label: 'Unassigned', badge: unassignedTotal }] : []),
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id as DirectoryTab)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-sm transition ${activeTab === item.id ? 'border-emerald-200 bg-emerald-100 text-emerald-900' : 'border-zinc-200 bg-white text-emerald-700 hover:bg-emerald-50'}`}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? <span className={`inline-flex min-w-6 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-bold ${activeTab === item.id ? 'border-emerald-300 bg-white text-emerald-900' : 'border-emerald-200 bg-emerald-50 text-zinc-800'}`}>{item.badge}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}