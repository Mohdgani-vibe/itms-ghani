const PURPOSE_OPTIONS = [
  'Work from home',
  'Branch transfer',
  'Repair / RMA',
  'Vendor handover',
  'Temporary assignment',
  'Other',
] as const;

const formControlClassName = 'w-full rounded-xl border border-blue-100 bg-white px-4 py-3.5 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';
const formTextareaClassName = 'w-full rounded-xl border border-blue-100 bg-white px-4 py-3.5 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

interface LookupOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name?: string;
  fullName?: string;
  emp_id?: string;
  employeeCode?: string;
}

interface AssetSuggestion {
  key: string;
  assetRef: string;
  label: string;
}

interface GatepassForm {
  employeeUserId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  approverName: string;
  contactNumber: string;
  assetRef: string;
  assetType: string;
  serialNumber: string;
  expectedReturn: string;
  assetDescription: string;
  purpose: string;
  originBranch: string;
  recipientBranch: string;
  issueDate: string;
}

type GatepassFormErrors = Partial<Record<keyof GatepassForm, string>>;

function userDisplayName(user: UserOption) {
  return user.fullName || user.full_name || '';
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>;
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-900">
      {label}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </span>
  );
}

interface GatepassCreateFormProps {
  form: GatepassForm;
  formErrors: GatepassFormErrors;
  submitting: boolean;
  branches: LookupOption[];
  departmentNames: string[];
  employeeSuggestions: UserOption[];
  employeeLookupLoading: boolean;
  assetSuggestions: AssetSuggestion[];
  assetLookupLoading: boolean;
  assetDescriptionLocked: boolean;
  formatDisplayDate: (value: string) => string;
  onSubmit: (event: React.FormEvent) => void | Promise<void>;
  onFieldChange: (field: keyof GatepassForm, value: string) => void;
  onEmployeeLookupChange: (value: string) => void;
  onAssetLookupChange: (value: string) => void;
  onUnlockAssetDescription: () => void;
  onReset: () => void;
  onOpenPreview: () => void;
}

export default function GatepassCreateForm({
  form,
  formErrors,
  submitting,
  branches,
  departmentNames,
  employeeSuggestions,
  employeeLookupLoading,
  assetSuggestions,
  assetLookupLoading,
  assetDescriptionLocked,
  formatDisplayDate,
  onSubmit,
  onFieldChange,
  onEmployeeLookupChange,
  onAssetLookupChange,
  onUnlockAssetDescription,
  onReset,
  onOpenPreview,
}: GatepassCreateFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-[28px] border border-blue-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f9ff_100%)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Draft New Gatepass</h2>
          <p className="mt-0.5 text-sm text-zinc-600">Capture branch transfer details and issue the official gatepass.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-zinc-900">01</div>
          <div>
            <div className="text-sm font-bold text-zinc-950">Dispatch Details</div>
            <div className="mt-0.5 text-xs text-zinc-600">Set the branch and issue date for this movement pass.</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-1 xl:col-span-6">
            <label>
              <FieldLabel label="From Branch" required />
            </label>
            <select value={form.originBranch} onChange={(event) => onFieldChange('originBranch', event.target.value)} className={formControlClassName}>
              {branches.map((branch) => <option key={`origin-${branch.id}`} value={branch.name}>{branch.name}</option>)}
            </select>
            <FieldError message={formErrors.originBranch} />
          </div>

          <div className="md:col-span-1 xl:col-span-6">
            <label>
              <FieldLabel label="Receiver Branch" required />
            </label>
            <select value={form.recipientBranch} onChange={(event) => onFieldChange('recipientBranch', event.target.value)} className={formControlClassName}>
              {branches.map((branch) => <option key={`recipient-${branch.id}`} value={branch.name}>{branch.name}</option>)}
            </select>
            <FieldError message={formErrors.recipientBranch} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-zinc-900">02</div>
          <div>
            <div className="text-sm font-bold text-zinc-950">Recipient Details</div>
            <div className="mt-0.5 text-xs text-zinc-600">Identify who is taking the asset and who approves the movement.</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-2 xl:col-span-5">
            <label>
              <FieldLabel label="Employee Name" required />
            </label>
            <>
              <input
                list="gatepass-employee-suggestions"
                value={form.employeeName}
                onChange={(event) => onEmployeeLookupChange(event.target.value)}
                className={formControlClassName}
                placeholder="Search by employee name or ID"
              />
              <datalist id="gatepass-employee-suggestions">
                {employeeSuggestions.map((user) => {
                  const name = userDisplayName(user);
                  const code = user.employeeCode || user.emp_id || '';
                  return <option key={user.id} value={name}>{code ? `${name} - ${code}` : name}</option>;
                })}
              </datalist>
            </>
            {!formErrors.employeeName ? (
              <p className="mt-2 text-[11px] text-zinc-600">
                {form.employeeName.trim().length < 2
                  ? 'Type at least 2 characters to search employees.'
                  : employeeLookupLoading
                    ? 'Searching employees...'
                    : employeeSuggestions.length > 0
                      ? `${employeeSuggestions.length} employee suggestion${employeeSuggestions.length === 1 ? '' : 's'} ready.`
                      : 'No employee matches found for this search.'}
              </p>
            ) : null}
            <FieldError message={formErrors.employeeName} />
          </div>
          <div className="md:col-span-1 xl:col-span-3">
            <label>
              <FieldLabel label="Employee ID" required />
            </label>
            <input value={form.employeeCode} onChange={(event) => onFieldChange('employeeCode', event.target.value)} className={formControlClassName} placeholder="Employee code" />
            <FieldError message={formErrors.employeeCode} />
          </div>
          <div className="md:col-span-1 xl:col-span-4">
            <label>
              <FieldLabel label="Department" required />
            </label>
            <select value={form.departmentName} onChange={(event) => onFieldChange('departmentName', event.target.value)} className={formControlClassName}>
              <option value="">Select department</option>
              {departmentNames.map((departmentName) => <option key={departmentName} value={departmentName}>{departmentName}</option>)}
            </select>
            <FieldError message={formErrors.departmentName} />
          </div>
          <div className="md:col-span-1 xl:col-span-6">
            <label>
              <FieldLabel label="Approver Name" required />
            </label>
            <input value={form.approverName} onChange={(event) => onFieldChange('approverName', event.target.value)} className={formControlClassName} placeholder="Approver name" />
            <FieldError message={formErrors.approverName} />
          </div>
          <div className="md:col-span-1 xl:col-span-6">
            <label>
              <FieldLabel label="Contact Number" />
            </label>
            <input value={form.contactNumber} onChange={(event) => onFieldChange('contactNumber', event.target.value)} className={formControlClassName} placeholder="Contact number" />
            <FieldError message={formErrors.contactNumber} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-zinc-900">03</div>
          <div>
            <div className="text-sm font-bold text-zinc-950">Asset Details</div>
            <div className="mt-0.5 text-xs text-zinc-600">Choose the asset, complete the hardware details, and set the movement dates.</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-2 xl:col-span-5">
            <label>
              <FieldLabel label="Asset Tag / ID" required />
            </label>
            <>
              <input list="gatepass-asset-suggestions" value={form.assetRef} onChange={(event) => onAssetLookupChange(event.target.value)} className={formControlClassName} placeholder="Start typing asset tag, inventory code, or hostname" />
              <datalist id="gatepass-asset-suggestions">
                {assetSuggestions.map((asset) => <option key={asset.key} value={asset.assetRef}>{asset.label}</option>)}
              </datalist>
            </>
            <p className="mt-2 text-[11px] text-zinc-600">
              {form.assetRef.trim().length < 2
                ? 'Type at least 2 characters to search devices and inventory assets. A known asset auto-fills the hardware fields and from branch.'
                : assetLookupLoading
                  ? 'Searching assets...'
                  : assetSuggestions.length > 0
                    ? `${assetSuggestions.length} asset suggestion${assetSuggestions.length === 1 ? '' : 's'} ready. Choosing a known asset auto-fills the hardware fields and from branch.`
                    : 'No asset matches found for this search.'}
            </p>
            <FieldError message={formErrors.assetRef} />
          </div>
          <div className="md:col-span-1 xl:col-span-3">
            <label>
              <FieldLabel label="Asset Type" />
            </label>
            <input value={form.assetType} onChange={(event) => onFieldChange('assetType', event.target.value)} className={formControlClassName} placeholder="Workstation" />
          </div>
          <div className="md:col-span-1 xl:col-span-4">
            <label>
              <FieldLabel label="Serial Number" />
            </label>
            <input value={form.serialNumber} onChange={(event) => onFieldChange('serialNumber', event.target.value)} className={formControlClassName} placeholder="Serial or hostname" />
          </div>
          <div className="md:col-span-1 xl:col-span-4">
            <label>
              <FieldLabel label="Purpose" required />
            </label>
            <select value={form.purpose} onChange={(event) => onFieldChange('purpose', event.target.value)} className={formControlClassName}>
              {PURPOSE_OPTIONS.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
            </select>
            <FieldError message={formErrors.purpose} />
          </div>
          <div className="md:col-span-1 xl:col-span-4">
            <label>
              <FieldLabel label="Issue Date" required />
            </label>
            <input type="date" value={form.issueDate} onChange={(event) => onFieldChange('issueDate', event.target.value)} className={formControlClassName} />
            <p className="mt-1.5 text-[11px] text-zinc-600">Displays as {formatDisplayDate(form.issueDate)}.</p>
            <FieldError message={formErrors.issueDate} />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label>
              <FieldLabel label="Expected Return" />
            </label>
            <input type="date" value={form.expectedReturn} onChange={(event) => onFieldChange('expectedReturn', event.target.value)} className={formControlClassName} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label>
              <FieldLabel label="Asset Description" required />
            </label>
            {assetDescriptionLocked ? <button type="button" onClick={onUnlockAssetDescription} className="text-[11px] font-semibold text-zinc-900 hover:text-zinc-700">Unlock Edit</button> : null}
          </div>
          <textarea value={form.assetDescription} readOnly={assetDescriptionLocked} onChange={(event) => onFieldChange('assetDescription', event.target.value)} rows={3} className={`${formTextareaClassName} ${assetDescriptionLocked ? 'border-blue-100 bg-blue-50 text-zinc-900 focus:border-blue-100 focus:ring-0' : ''}`} placeholder="Describe the asset being moved" />
          {assetDescriptionLocked ? <p className="mt-1.5 text-[11px] text-zinc-600">Description came from the matched inventory record. Unlock edit if you need to override it.</p> : null}
          <FieldError message={formErrors.assetDescription} />
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button type="button" onClick={onReset} className="self-start rounded-lg px-2 py-1 text-sm font-semibold text-zinc-900 hover:bg-blue-50 hover:text-zinc-700">
            Clear Form
          </button>
          <div className="grid w-full gap-2.5 md:w-auto md:min-w-[420px] md:grid-cols-2">
            <button type="button" onClick={onOpenPreview} className="w-full rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-zinc-900 hover:bg-blue-50">
              Preview Draft
            </button>
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
              {submitting ? 'Generating...' : 'Generate Official Gatepass'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}