interface Props {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (v: string) => void;
  departments: { name: string; count: number }[];
}

export default function InventoryDirectoryFiltersPanel({ searchQuery, setSearchQuery, departmentFilter, setDepartmentFilter, departments }: Props) {
  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded">
      <input
        className="border rounded px-2 py-1"
        placeholder="Search inventory..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
      <select
        className="border rounded px-2 py-1"
        value={departmentFilter}
        onChange={e => setDepartmentFilter(e.target.value)}
      >
        <option value="all">All Departments</option>
        {departments.map(d => (
          <option key={d.name} value={d.name}>{d.name} ({d.count})</option>
        ))}
      </select>
    </div>
  );
}
