import { ChevronRight, Mail } from 'lucide-react';

interface UserDirectoryCardRecord {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  status: string;
  department?: { name?: string } | null;
  branch?: { name?: string } | null;
  _count?: { assets: number };
}

interface UserDirectoryCardProps {
  user: UserDirectoryCardRecord;
  active: boolean;
  isSuperAdmin: boolean;
  isCurrentSessionUser: boolean;
  selectedForBulk: boolean;
  accessSummary: string;
  portalLabels: string[];
  userActionLoading: boolean;
  onSelect: () => void;
  onToggleBulkSelection: (checked: boolean) => void;
  onOpenProfile: () => void;
  onQuickEdit: () => void;
  onResetPassword: () => void;
  onManageAccess: () => void;
  onToggleStatus: () => void;
}

export default function UserDirectoryCard({
  user,
  active,
  isSuperAdmin,
  isCurrentSessionUser,
  selectedForBulk,
  accessSummary,
  portalLabels,
  userActionLoading,
  onSelect,
  onToggleBulkSelection,
  onOpenProfile,
  onQuickEdit,
  onResetPassword,
  onManageAccess,
  onToggleStatus,
}: UserDirectoryCardProps) {
  return <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
    className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-colors ${active ? 'border-sky-300 bg-sky-100/70' : 'border-zinc-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {isSuperAdmin ? (
          <input
            type="checkbox"
            checked={selectedForBulk}
            disabled={isCurrentSessionUser}
            onChange={(event) => onToggleBulkSelection(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
          />
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-left text-lg font-bold text-zinc-900 hover:text-brand-700">
              {user.fullName}
            </div>
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{user.employeeCode}</div>
          <div className="mt-2 flex items-center text-sm text-brand-700 hover:text-brand-800">
            <Mail className="mr-2 h-4 w-4" />
            {user.email}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Assets</div>
        <div className="mt-2 text-xl font-bold text-zinc-900">{user._count?.assets || 0}</div>
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="rounded-xl bg-zinc-50 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{user.department?.name || 'Unassigned'}</div>
      </div>
      <div className="rounded-xl bg-zinc-50 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Location</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{user.branch?.name || 'Unassigned'}</div>
      </div>
      <div className="rounded-xl bg-zinc-50 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Access</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{accessSummary}</div>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between">
      <div className="flex flex-wrap gap-2">
        {portalLabels.map((portal) => (
          <span key={portal} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700 ring-1 ring-zinc-200">
            {portal}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenProfile();
        }}
        className="inline-flex items-center text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        Open profile
        <ChevronRight className="ml-1 h-4 w-4" />
      </button>
    </div>

    {isSuperAdmin ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onQuickEdit();
          }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
        >
          Quick Edit
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onResetPassword();
          }}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          Reset Password
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onManageAccess();
          }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
        >
          Manage Access
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus();
          }}
          disabled={userActionLoading || isCurrentSessionUser}
          className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60 ${user.status === 'active' ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
        >
          {userActionLoading ? 'Updating...' : user.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
        </button>
      </div>
    ) : null}
  </div>;
}