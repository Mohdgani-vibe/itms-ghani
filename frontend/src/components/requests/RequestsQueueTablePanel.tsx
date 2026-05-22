import type { ReactNode } from 'react';

export interface RequestsQueueTablePanelProps {
  canSelectAll?: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  rows: ReactNode;
  selectedDetail: ReactNode;
}

export default function RequestsQueueTablePanel({
  canSelectAll = true,
  allSelected,
  onToggleAll,
  rows,
  selectedDetail,
}: RequestsQueueTablePanelProps) {
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 shadow-sm">
        <table className="min-w-full divide-y divide-emerald-100">
          <thead className="bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)]">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  disabled={!canSelectAll}
                  className="h-4 w-4 rounded border-emerald-200 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">Request</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 xl:table-cell">Requester</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 xl:table-cell">Assignee</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 lg:table-cell">Updated</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100 bg-white">{rows}</tbody>
        </table>
      </div>
      {selectedDetail}
    </>
  );
}