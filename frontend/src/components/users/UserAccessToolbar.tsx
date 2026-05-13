type UserStatusFilter = 'all' | 'active' | 'inactive';

interface LookupOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  short_code: string;
  full_name: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface UserAccessToolbarProps {
  userRoleFilter: string;
  userEntityFilter: string;
  userBranchFilter: string;
  userStatusFilter: UserStatusFilter;
  availableRoleOptions: RoleOption[];
  activeEntityOptions: EntityOption[];
  branchOptions: LookupOption[];
  allVisibleBulkUsersSelected: boolean;
  bulkSelectableUsersCount: number;
  selectedBulkUsersCount: number;
  formatRoleNameLabel: (value: string) => string;
  onUserRoleFilterChange: (value: string) => void;
  onUserEntityFilterChange: (value: string) => void;
  onUserBranchFilterChange: (value: string) => void;
  onUserStatusFilterChange: (value: UserStatusFilter) => void;
  onToggleSelectAllVisibleUsers: (checked: boolean) => void;
  onDeactivateSelected: () => void;
  onReactivateSelected: () => void;
}

export default function UserAccessToolbar({
  userRoleFilter,
  userEntityFilter,
  userBranchFilter,
  availableRoleOptions,
  activeEntityOptions,
  branchOptions,
  allVisibleBulkUsersSelected,
  bulkSelectableUsersCount,
  selectedBulkUsersCount,
  formatRoleNameLabel,
  onUserRoleFilterChange,
  onUserEntityFilterChange,
  onUserBranchFilterChange,
  onUserStatusFilterChange,
  onToggleSelectAllVisibleUsers,
  onDeactivateSelected,
  onReactivateSelected,
}: UserAccessToolbarProps) {
  return <div className="lg:col-span-2 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
    <div className="grid w-full gap-3 md:grid-cols-3">
      <label className="text-sm text-zinc-700">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Role</div>
        <select value={userRoleFilter} onChange={(event) => onUserRoleFilterChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
          <option value="all">All roles</option>
          {availableRoleOptions.map((role) => <option key={role.id} value={role.name}>{formatRoleNameLabel(role.name)}</option>)}
        </select>
      </label>
      <label className="text-sm text-zinc-700">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Entity</div>
        <select value={userEntityFilter} onChange={(event) => onUserEntityFilterChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
          <option value="all">All entities</option>
          {activeEntityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.full_name} ({entity.short_code})</option>)}
        </select>
      </label>
      <label className="text-sm text-zinc-700">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Branch</div>
        <select value={userBranchFilter} onChange={(event) => onUserBranchFilterChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
          <option value="all">All branches</option>
          {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>
    </div>
    {(['all', 'active', 'inactive'] as UserStatusFilter[]).map((status) => (
      <button
        key={status}
        type="button"
        onClick={() => onUserStatusFilterChange(status)}
        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-50"
      >
        {status === 'all' ? 'All Users' : status === 'active' ? 'Active Users' : 'Inactive Users'}
      </button>
    ))}
    <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
      <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700">
        <input
          type="checkbox"
          checked={allVisibleBulkUsersSelected}
          onChange={(event) => onToggleSelectAllVisibleUsers(event.target.checked)}
          disabled={bulkSelectableUsersCount === 0}
          className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        Select all users on this page
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDeactivateSelected}
          disabled={selectedBulkUsersCount === 0}
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          Deactivate Selected
        </button>
        <button
          type="button"
          onClick={onReactivateSelected}
          disabled={selectedBulkUsersCount === 0}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          Reactivate Selected
        </button>
      </div>
    </div>
  </div>;
}