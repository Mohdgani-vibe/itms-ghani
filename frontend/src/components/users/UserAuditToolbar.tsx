import { Search } from 'lucide-react';

type AuditModule = 'all' | 'access' | 'assets' | 'gatepass' | 'chat' | 'terminal' | 'requests' | 'announcements' | 'alerts' | 'settings';

interface UserAuditToolbarProps {
  auditSearchQuery: string;
  auditModuleFilter: AuditModule;
  auditActionFilter: string;
  auditTotal: number;
  auditModuleCounts: Map<AuditModule, number>;
  accessAuditActionPresets: readonly string[];
  formatAuditModuleLabel: (value: AuditModule) => string;
  formatAuditActionLabel: (value: string) => string;
  onAuditSearchQueryChange: (value: string) => void;
  onAuditModuleFilterChange: (value: AuditModule) => void;
  onAuditActionFilterChange: (value: string) => void;
  onClearAuditActionFilter: () => void;
}

export default function UserAuditToolbar({
  auditSearchQuery,
  auditModuleFilter,
  auditActionFilter,
  auditTotal,
  auditModuleCounts,
  accessAuditActionPresets,
  formatAuditModuleLabel,
  formatAuditActionLabel,
  onAuditSearchQueryChange,
  onAuditModuleFilterChange,
  onAuditActionFilterChange,
  onClearAuditActionFilter,
}: UserAuditToolbarProps) {
  return <>
    <div className="border-b border-zinc-100 px-6 py-4">
      <h2 className="text-lg font-bold text-zinc-900">Audit Activity</h2>
      <p className="mt-1 text-sm text-zinc-500">Track who added assets, created gatepasses, ran patch jobs, or changed users.</p>
    </div>

    <div className="border-b border-zinc-100 px-6 py-4 space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={auditSearchQuery}
          onChange={(event) => onAuditSearchQueryChange(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-4 text-sm text-zinc-900"
          placeholder="Search by summary, actor, subject, action, or module"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'access', 'assets', 'gatepass', 'chat', 'terminal', 'requests', 'announcements', 'alerts', 'settings'] as AuditModule[]).map((module) => (
          <button
            key={module}
            type="button"
            onClick={() => onAuditModuleFilterChange(module)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${auditModuleFilter === module ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'}`}
          >
            {formatAuditModuleLabel(module)}
            <span className="ml-2 opacity-80">{module === 'all' ? auditTotal : (auditModuleCounts.get(module) || 0)}</span>
          </button>
        ))}
      </div>

      {(auditModuleFilter === 'all' || auditModuleFilter === 'access') ? (
        <div className="flex flex-wrap gap-2">
          {accessAuditActionPresets.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAuditActionFilterChange(action)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${auditActionFilter === action ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'}`}
            >
              {formatAuditActionLabel(action)}
            </button>
          ))}
        </div>
      ) : null}

      {auditActionFilter ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-3 text-sm text-brand-900">
          <span className="font-semibold">Action filter:</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">{formatAuditActionLabel(auditActionFilter)}</span>
          <button type="button" onClick={onClearAuditActionFilter} className="text-xs font-bold uppercase tracking-wider text-brand-700 hover:text-brand-800">
            Clear
          </button>
        </div>
      ) : null}
    </div>
  </>;
}