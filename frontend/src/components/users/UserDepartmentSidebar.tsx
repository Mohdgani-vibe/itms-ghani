interface DepartmentCount {
  name: string;
  count: number;
}

interface UserDepartmentSidebarProps {
  departmentFilter: string;
  directoryTotal: number;
  departmentCounts: DepartmentCount[];
  onDepartmentFilterChange: (value: string) => void;
}

export default function UserDepartmentSidebar({
  departmentFilter,
  directoryTotal,
  departmentCounts,
  onDepartmentFilterChange,
}: UserDepartmentSidebarProps) {
  return (
    <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Departments</div>
        <p className="mt-1 text-sm text-zinc-500">Filter users by department and review count per team.</p>
      </div>

      <button
        type="button"
        onClick={() => onDepartmentFilterChange('all')}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${departmentFilter === 'all' ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
      >
        <span>All Departments</span>
        <span>{directoryTotal}</span>
      </button>

      <div className="space-y-2">
        {departmentCounts.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => onDepartmentFilterChange(entry.name)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition ${departmentFilter === entry.name ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
          >
            <span>{entry.name}</span>
            <span>{entry.count}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}