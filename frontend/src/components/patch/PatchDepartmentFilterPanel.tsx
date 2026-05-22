interface PatchDepartmentFilterPanelProps {
  selectedDepartment: string;
  departmentOptions: string[];
  totalDevices: number;
  onSelectedDepartmentChange: (value: string) => void;
}

export default function PatchDepartmentFilterPanel({
  selectedDepartment,
  departmentOptions,
  totalDevices,
  onSelectedDepartmentChange,
}: PatchDepartmentFilterPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Department Filter</div>
      <h2 className="mt-2 text-lg font-black text-slate-950">Scope the rollout</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Focus the device runway on one department before opening consoles or launching department-wide Salt actions.</p>
      <select value={selectedDepartment} onChange={(event) => onSelectedDepartmentChange(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-300">
        {departmentOptions.map((department) => (
          <option key={department} value={department}>{department === 'all' ? 'All departments' : department}</option>
        ))}
      </select>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{totalDevices} managed device(s) assigned to this department.</div>
    </section>
  );
}