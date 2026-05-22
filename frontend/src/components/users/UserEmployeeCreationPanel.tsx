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

interface RoleOption {
  id: string;
  name: string;
}

interface EmployeeFormState {
  fullName: string;
  email: string;
  employeeCode: string;
  departmentId: string;
  branchId: string;
  role: string;
  initialPassword: string;
}

interface UserEmployeeCreationPanelProps {
  defaultEntityId: string;
  defaultEntityLabel: string;
  creatingEmployee: boolean;
  activeEntityOptions: EntityOption[];
  availableRoleOptions: RoleOption[];
  departmentOptions: LookupOption[];
  branchOptions: LookupOption[];
  employeeForm: EmployeeFormState;
  formatRoleNameLabel: (value: string) => string;
  onSubmit: (event: React.FormEvent) => void;
  onSelectedEmployeeEntityChange: (value: string) => void;
  onEmployeeFormFieldChange: (field: keyof EmployeeFormState, value: string) => void;
}

export default function UserEmployeeCreationPanel({
  defaultEntityId,
  defaultEntityLabel,
  creatingEmployee,
  activeEntityOptions,
  availableRoleOptions,
  departmentOptions,
  branchOptions,
  employeeForm,
  formatRoleNameLabel,
  onSubmit,
  onSelectedEmployeeEntityChange,
  onEmployeeFormFieldChange,
}: UserEmployeeCreationPanelProps) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Add Employee</div>
      <h2 className="mt-2 text-xl font-bold text-zinc-900">Create a new employee account</h2>
      <p className="mt-1 text-sm text-zinc-500">Manual employee creation uses the selected entity and keeps CSV tools in their own tab.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Entity</div>
          <select value={defaultEntityId} onChange={(event) => onSelectedEmployeeEntityChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" disabled={creatingEmployee || activeEntityOptions.length === 0}>
            <option value="">Select entity</option>
            {activeEntityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.full_name} ({entity.short_code})</option>)}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Full Name</div>
          <input value={employeeForm.fullName} onChange={(event) => onEmployeeFormFieldChange('fullName', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Email</div>
          <input type="email" value={employeeForm.email} onChange={(event) => onEmployeeFormFieldChange('email', event.target.value)} placeholder="employee@zerodha.com" className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee ID</div>
          <input value={employeeForm.employeeCode} onChange={(event) => onEmployeeFormFieldChange('employeeCode', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Role</div>
          <select value={employeeForm.role} onChange={(event) => onEmployeeFormFieldChange('role', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            {availableRoleOptions.map((role) => (
              <option key={role.id} value={role.name}>{formatRoleNameLabel(role.name)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
          <select value={employeeForm.departmentId} onChange={(event) => onEmployeeFormFieldChange('departmentId', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="">Select department</option>
            {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Branch</div>
          <select value={employeeForm.branchId} onChange={(event) => onEmployeeFormFieldChange('branchId', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            <option value="">Select branch</option>
            {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-zinc-700 md:col-span-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Initial Password</div>
          <input type="password" value={employeeForm.initialPassword} onChange={(event) => onEmployeeFormFieldChange('initialPassword', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900" />
        </label>
      </div>
      <button type="submit" disabled={creatingEmployee || !defaultEntityId} className={`mt-5 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}>{creatingEmployee ? 'Creating...' : 'Create Employee'}</button>
    </form>
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Entity</div>
      <div className="mt-2 text-sm text-zinc-700">{defaultEntityLabel || 'No entity available yet'}</div>
      <p className="mt-3 text-sm text-zinc-500">Choose the target entity before creating the employee. Department and branch selections are optional.</p>
    </div>
  </div>;
}