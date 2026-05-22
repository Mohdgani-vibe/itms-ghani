import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

interface PatchDeviceTablePanelProps {
  searchQuery: string;
  totalLabel: string;
  loading: boolean;
  isEmpty: boolean;
  onSearchQueryChange: (value: string) => void;
  rows: ReactNode;
  pagination: ReactNode;
}

export default function PatchDeviceTablePanel({
  searchQuery,
  totalLabel,
  loading,
  isEmpty,
  onSearchQueryChange,
  rows,
  pagination,
}: PatchDeviceTablePanelProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#ffffff_140px,_#f8fafc_100%)] shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_100%)] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Device Queue</div>
            <div className="mt-1 text-lg font-black text-slate-950">Managed patch devices</div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full rounded-2xl shadow-sm lg:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
            placeholder="Search Hostname, Department..."
          />
        </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{totalLabel}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-emerald-50/70">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Asset Info</th>
              <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Department</th>
              <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Patch Group</th>
              <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Compliance</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-14 text-center text-sm text-slate-500">Loading device patch statuses...</td></tr>
            ) : isEmpty ? (
              <tr><td colSpan={5} className="px-6 py-14 text-center text-sm text-slate-500">No managed devices found.</td></tr>
            ) : rows}
          </tbody>
        </table>
      </div>
      {pagination}
    </section>
  );
}