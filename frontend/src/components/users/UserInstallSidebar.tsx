import { Search } from 'lucide-react';
import Pagination from '../Pagination';

type UserStatusFilter = 'all' | 'active' | 'inactive';

interface RoleOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  short_code: string;
  full_name: string;
}

interface InstallUserRecord {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
}

interface UserInstallSidebarProps {
  searchQuery: string;
  userRoleFilter: string;
  userEntityFilter: string;
  userBranchFilter: string;
  userStatusFilter: UserStatusFilter;
  availableRoleOptions: RoleOption[];
  activeEntityOptions: EntityOption[];
  branchOptions: BranchOption[];
  installUsers: InstallUserRecord[];
  selectedUserId: string;
  installPage: number;
  installTotal: number;
  pageSize: number;
  formatRoleNameLabel: (value: string) => string;
  onSearchQueryChange: (value: string) => void;
  onUserRoleFilterChange: (value: string) => void;
  onUserEntityFilterChange: (value: string) => void;
  onUserBranchFilterChange: (value: string) => void;
  onUserStatusFilterChange: (value: UserStatusFilter) => void;
  onSelectUser: (userId: string) => void;
  onInstallPageChange: (page: number) => void;
}

export default function UserInstallSidebar({
  searchQuery,
  userRoleFilter,
  userEntityFilter,
  userBranchFilter,
  availableRoleOptions,
  activeEntityOptions,
  branchOptions,
  installUsers,
  selectedUserId,
  installPage,
  installTotal,
  pageSize,
  formatRoleNameLabel,
  onSearchQueryChange,
  onUserRoleFilterChange,
  onUserEntityFilterChange,
  onUserBranchFilterChange,
  onUserStatusFilterChange,
  onSelectUser,
  onInstallPageChange,
}: UserInstallSidebarProps) {
  return <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Users</div>
      <p className="mt-1 text-sm text-zinc-500">Select a user and run the full endpoint install from this single page.</p>
    </div>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-4 text-sm text-zinc-900"
        placeholder="Search user, employee ID, email, or department"
      />
    </div>

    <div className="grid gap-3">
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

    <div className="flex flex-wrap gap-2">
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

    <div className="space-y-2">
      {installUsers.map((user) => {
        const active = selectedUserId === user.id;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelectUser(user.id)}
            className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'}`}
          >
            <div className="text-sm font-bold">{user.fullName}</div>
            <div className="mt-1 text-xs text-zinc-500">{user.employeeCode} • {user.email}</div>
          </button>
        );
      })}
    </div>
    <Pagination
      currentPage={installPage}
      totalItems={installTotal}
      pageSize={pageSize}
      onPageChange={onInstallPageChange}
      itemLabel="users"
    />
  </aside>;
}