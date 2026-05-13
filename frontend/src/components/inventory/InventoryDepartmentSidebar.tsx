interface Props {
  departments: { name: string; count: number }[];
  selected: string;
  onSelect: (name: string) => void;
}

export default function InventoryDepartmentSidebar({ departments, selected, onSelect }: Props) {
  return (
    <aside className="w-48 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Branches</div>
      <ul className="space-y-1">
        <li>
          <button
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${selected === 'all' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-transparent bg-white text-zinc-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
            onClick={() => onSelect('all')}
          >
            All ({departments.reduce((a, d) => a + d.count, 0)})
          </button>
        </li>
        {departments.map(d => (
          <li key={d.name}>
            <button
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${selected === d.name ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-transparent bg-white text-zinc-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
              onClick={() => onSelect(d.name)}
            >
              {d.name} ({d.count})
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
