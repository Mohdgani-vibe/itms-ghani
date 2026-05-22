import { actionButtonStyles } from '../../lib/buttonStyles';

interface LookupOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  short_code: string;
  full_name: string;
}

interface UserEditFormState {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  entityId: string;
  departmentId: string;
  branchId: string;
  role: string;
  status: 'active' | 'inactive';
  nextPassword: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface UserEditorDialogProps {
  editingUser: UserEditFormState | null;
  userEditorMode: 'edit' | 'reset-password';
  savingEditedUser: boolean;
  availableRoleOptions: RoleOption[];
  activeEntityOptions: EntityOption[];
  departmentOptions: LookupOption[];
  branchOptions: LookupOption[];
  formatRoleNameLabel: (value: string) => string;
  onClose: () => void;
  onSave: () => void;
  onFieldChange: (field: keyof UserEditFormState, value: string) => void;
}

export default function UserEditorDialog({
  editingUser,
  userEditorMode,
  savingEditedUser,
  availableRoleOptions,
  activeEntityOptions,
  departmentOptions,
  branchOptions,
  formatRoleNameLabel,
  onClose,
  onSave,
  onFieldChange,
}: UserEditorDialogProps) {
  if (!editingUser) {
    return null;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4">
    <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-user-dialog-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="edit-user-dialog-title" className="text-lg font-bold text-zinc-900">{userEditorMode === 'reset-password' ? 'Reset Password' : 'Edit User'}</h2>
          <p className="mt-1 text-sm text-zinc-500">{userEditorMode === 'reset-password' ? 'Set a new temporary password for this user without leaving the directory.' : 'Update the user record directly from the Users page.'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={savingEditedUser}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
        >
          Close
        </button>
      </div>

      {userEditorMode === 'edit' ? (
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Full Name</div>
          <input value={editingUser.fullName} onChange={(event) => onFieldChange('fullName', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Email</div>
          <input type="email" value={editingUser.email} onChange={(event) => onFieldChange('email', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee ID</div>
          <input value={editingUser.employeeCode} onChange={(event) => onFieldChange('employeeCode', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Role</div>
          <select value={editingUser.role} onChange={(event) => onFieldChange('role', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            {availableRoleOptions.map((role) => (
              <option key={role.id} value={role.name}>{formatRoleNameLabel(role.name)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Entity</div>
          <select value={editingUser.entityId} onChange={(event) => onFieldChange('entityId', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="">Select entity</option>
            {activeEntityOptions.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.full_name} ({entity.short_code})</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
          <select value={editingUser.departmentId} onChange={(event) => onFieldChange('departmentId', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="">Select department</option>
            {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Branch</div>
          <select value={editingUser.branchId} onChange={(event) => onFieldChange('branchId', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="">Select branch</option>
            {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</div>
          <select value={editingUser.status} onChange={(event) => onFieldChange('status', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      ) : (
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">User</div>
        <div className="mt-2 text-lg font-bold text-zinc-900">{editingUser.fullName}</div>
        <div className="mt-1 text-sm text-zinc-600">{editingUser.email}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Employee ID</div>
        <div className="mt-1 text-sm font-semibold text-zinc-900">{editingUser.employeeCode || 'Not set'}</div>
      </div>
      )}

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Password Reset</div>
        <p className="mt-2 text-sm text-amber-900">Leave this blank to keep the current password. Enter a new temporary password only when you want to reset sign-in for this user.</p>
        <label className="mt-4 block text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">New Temporary Password</div>
          <input
            type="password"
            value={editingUser.nextPassword}
            onChange={(event) => onFieldChange('nextPassword', event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="Enter a strong temporary password"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={savingEditedUser}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={savingEditedUser || (userEditorMode === 'reset-password' && !editingUser.nextPassword.trim())}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.save}`}
        >
          {savingEditedUser ? 'Saving...' : userEditorMode === 'reset-password' ? 'Reset Password' : 'Save User'}
        </button>
      </div>
    </div>
  </div>;
}