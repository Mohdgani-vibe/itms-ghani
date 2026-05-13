const PATCH_RING_OPTIONS = [
  { value: 'pilot', label: 'Pilot' },
  { value: 'standard', label: 'Standard' },
  { value: 'broad', label: 'Broad' },
  { value: 'critical', label: 'Critical' },
] as const;

interface LookupOption {
  id: string;
  name: string;
}

interface PatchDepartmentRing {
  match: string;
  ring: string;
}

interface WorkflowPatchPolicyState {
  patchWindowEnabled: boolean;
  patchWindowStart: string;
  patchWindowEnd: string;
  patchAllowedRings: string[];
  patchDepartmentRings: PatchDepartmentRing[];
}

interface SettingsPatchPolicyPanelProps {
  canEditWorkflowSettings: boolean;
  workflowSettings: WorkflowPatchPolicyState;
  departments: LookupOption[];
  getDepartmentRing: (departmentName: string) => string;
  onWorkflowSettingsChange: (patch: Partial<WorkflowPatchPolicyState>) => void;
  onDepartmentRingChange: (departmentName: string, ring: string) => void;
}

export default function SettingsPatchPolicyPanel({
  canEditWorkflowSettings,
  workflowSettings,
  departments,
  getDepartmentRing,
  onWorkflowSettingsChange,
  onDepartmentRingChange,
}: SettingsPatchPolicyPanelProps) {
  const toggleAllowedRing = (ring: string) => {
    const next = workflowSettings.patchAllowedRings.includes(ring)
      ? workflowSettings.patchAllowedRings.filter((value) => value !== ring)
      : [...workflowSettings.patchAllowedRings, ring];
    onWorkflowSettingsChange({ patchAllowedRings: next });
  };

  return (
    <section className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <div className="text-sm font-bold text-zinc-900">Patch Policy</div>
        <p className="mt-1 text-sm text-zinc-500">Restrict live patch execution to approved time windows and rollout rings, then map departments into those rings.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <span className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={workflowSettings.patchWindowEnabled}
              onChange={(event) => onWorkflowSettingsChange({ patchWindowEnabled: event.target.checked })}
              disabled={!canEditWorkflowSettings}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block font-semibold text-zinc-900">Enforce patch approval window</span>
              <span className="mt-1 block text-xs text-zinc-500">When enabled, ITMS blocks patch actions outside the configured server-local time window and records the denial in audit logs.</span>
            </span>
          </span>
        </label>

        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-700">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Window Start</span>
            <input
              type="time"
              value={workflowSettings.patchWindowStart}
              onChange={(event) => onWorkflowSettingsChange({ patchWindowStart: event.target.value })}
              disabled={!canEditWorkflowSettings}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label className="text-sm text-zinc-700">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Window End</span>
            <input
              type="time"
              value={workflowSettings.patchWindowEnd}
              onChange={(event) => onWorkflowSettingsChange({ patchWindowEnd: event.target.value })}
              disabled={!canEditWorkflowSettings}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Allowed Live Rings</div>
        <p className="mt-1 text-xs text-zinc-500">Select which rollout rings can run patches now. Leave all unchecked to allow every ring.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PATCH_RING_OPTIONS.map((option) => {
            const active = workflowSettings.patchAllowedRings.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleAllowedRing(option.value)}
                disabled={!canEditWorkflowSettings}
                className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${active ? 'border-sky-300 bg-sky-100 text-sky-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department Ring Mapping</div>
        <p className="mt-1 text-xs text-zinc-500">Use department-to-ring assignments as the fleet grouping control for phased patch rollout. Departments without an explicit mapping default to the standard ring.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">No departments available yet. Create departments first, then map them into patch rings here.</div>
          ) : (
            departments.map((department) => (
              <label key={department.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <span className="block font-semibold text-zinc-900">{department.name}</span>
                <select
                  value={getDepartmentRing(department.name)}
                  onChange={(event) => onDepartmentRingChange(department.name, event.target.value)}
                  disabled={!canEditWorkflowSettings}
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Standard (default)</option>
                  {PATCH_RING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ))
          )}
        </div>
      </div>
    </section>
  );
}