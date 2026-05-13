import { ShieldAlert } from 'lucide-react';
import Pagination from '../Pagination';

type AuditModule = 'all' | 'access' | 'assets' | 'gatepass' | 'chat' | 'terminal' | 'requests' | 'announcements' | 'alerts' | 'settings';

interface AuditRecord {
  id: string;
  action: string;
  entityId: string;
  entityType: string;
  createdAt: string;
  summary: string;
  module?: string;
  actor?: { fullName: string; email: string } | null;
  subject?: { fullName: string } | null;
}

interface UserAuditListProps {
  auditLoading: boolean;
  auditItems: AuditRecord[];
  auditPage: number;
  auditTotal: number;
  auditPageSize: number;
  basePath: string;
  getAuditModule: (entry: AuditRecord) => AuditModule;
  resolveAuditEntityPath: (basePath: string, entry: AuditRecord) => string;
  formatAuditModuleLabel: (value: AuditModule) => string;
  onAuditModuleFilterChange: (value: AuditModule) => void;
  onAuditActionFilterChange: (value: string) => void;
  onAuditSearchQueryChange: (value: string) => void;
  onNavigate: (path: string) => void;
  onAuditPageChange: (page: number) => void;
}

export default function UserAuditList({
  auditLoading,
  auditItems,
  auditPage,
  auditTotal,
  auditPageSize,
  basePath,
  getAuditModule,
  resolveAuditEntityPath,
  formatAuditModuleLabel,
  onAuditModuleFilterChange,
  onAuditActionFilterChange,
  onAuditSearchQueryChange,
  onNavigate,
  onAuditPageChange,
}: UserAuditListProps) {
  return <>
    <div className="divide-y divide-zinc-100">
      {auditLoading ? <div className="px-6 py-10 text-center text-sm text-zinc-500">Loading audit activity...</div> : null}
      {!auditLoading && auditItems.length === 0 ? <div className="px-6 py-10 text-center text-sm text-zinc-500">No audit activity matched the current filters.</div> : null}

      {auditItems.map((entry) => {
        const module = getAuditModule(entry);
        const entityPath = resolveAuditEntityPath(basePath, entry);
        return (
          <div key={entry.id} className="px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAuditModuleFilterChange(module)}
                    className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                  >
                    {formatAuditModuleLabel(module)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAuditActionFilterChange(entry.action)}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-200"
                  >
                    {entry.action}
                  </button>
                  {module === 'alerts' ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : null}
                </div>

                <div className="mt-3 text-sm font-bold text-zinc-900">{entry.summary}</div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onAuditSearchQueryChange(entry.actor?.fullName || '')}
                    className="rounded-xl bg-zinc-50 px-3 py-3 text-left hover:bg-zinc-100"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Actor</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{entry.actor?.fullName || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-zinc-500">{entry.actor?.email || 'No email recorded'}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (entityPath) {
                        onNavigate(entityPath);
                        return;
                      }
                      onAuditSearchQueryChange(entry.entityId);
                    }}
                    className="rounded-xl bg-zinc-50 px-3 py-3 text-left hover:bg-zinc-100"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Subject</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{entry.subject?.fullName || 'System / none'}</div>
                    <div className="mt-1 text-xs text-zinc-500">Entity ID: {entry.entityId}</div>
                    <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-brand-700">{entityPath ? 'Open related record' : 'Filter by entity id'}</div>
                  </button>
                </div>
              </div>
              <div className="text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <div>{entry.entityType.replaceAll('_', ' ')}</div>
                <div className="mt-1 normal-case text-zinc-400">{new Date(entry.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    <div className="border-t border-zinc-100 px-6 py-4">
      <Pagination
        currentPage={auditPage}
        totalItems={auditTotal}
        pageSize={auditPageSize}
        onPageChange={onAuditPageChange}
        itemLabel="audit events"
      />
    </div>
  </>;
}