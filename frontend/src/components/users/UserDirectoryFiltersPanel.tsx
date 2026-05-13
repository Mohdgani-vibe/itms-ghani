import { Search } from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  full_name: string;
  short_code: string;
}

interface BranchOption {
  id: string;
  name: string;
}

type UserStatusFilter = 'all' | 'active' | 'inactive';
type UserSystemAssignmentFilter = 'all' | 'assigned' | 'unassigned';

interface UserDirectoryFiltersPanelProps {
  searchQuery: string;
  userRoleFilter: string;
  userEntityFilter: string;
  userBranchFilter: string;
  userStatusFilter: UserStatusFilter;
  userSystemAssignmentFilter: UserSystemAssignmentFilter;
  hideUserSystemAssignmentFilter?: boolean;
  availableRoleOptions: RoleOption[];
  activeEntityOptions: EntityOption[];
  branchOptions: BranchOption[];
  formatRoleNameLabel: (roleName: string) => string;
  onSearchQueryChange: (value: string) => void;
  onUserRoleFilterChange: (value: string) => void;
  onUserEntityFilterChange: (value: string) => void;
  onUserBranchFilterChange: (value: string) => void;
  onUserStatusFilterChange: (value: UserStatusFilter) => void;
  onUserSystemAssignmentFilterChange: (value: UserSystemAssignmentFilter) => void;
}

export default function UserDirectoryFiltersPanel({
  searchQuery,
  userRoleFilter,
  userEntityFilter,
  userBranchFilter,
  userSystemAssignmentFilter,
  hideUserSystemAssignmentFilter = false,
  availableRoleOptions,
  activeEntityOptions,
  branchOptions,
  formatRoleNameLabel,
  onSearchQueryChange,
  onUserRoleFilterChange,
  onUserEntityFilterChange,
  onUserBranchFilterChange,
  onUserStatusFilterChange,
  onUserSystemAssignmentFilterChange,
}: UserDirectoryFiltersPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-4 text-sm text-zinc-900"
          placeholder="Search by employee name, employee ID, email, role, or department"
        />
      </div>
      <div className={`mt-4 grid gap-3 ${hideUserSystemAssignmentFilter ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
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
        {!hideUserSystemAssignmentFilter ? (
          <label className="text-sm text-zinc-700">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">System</div>
            <select value={userSystemAssignmentFilter} onChange={(event) => onUserSystemAssignmentFilterChange(event.target.value as UserSystemAssignmentFilter)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
              <option value="all">All users</option>
              <option value="assigned">Assigned systems</option>
              <option value="unassigned">Unassigned systems</option>
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}