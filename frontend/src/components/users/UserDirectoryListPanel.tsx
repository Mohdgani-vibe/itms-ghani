import type { ReactNode } from 'react';

interface UserDirectoryListPanelProps {
  loading: boolean;
  isEmpty: boolean;
  rows: ReactNode;
  pagination: ReactNode;
}

export default function UserDirectoryListPanel({
  loading,
  isEmpty,
  rows,
  pagination,
}: UserDirectoryListPanelProps) {
  return (
    <>
      <div className="space-y-3">
        {loading ? <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">Loading user directory...</div> : null}
        {!loading && isEmpty ? <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">No users matched the current filters.</div> : null}
        {rows}
      </div>
      {pagination}
    </>
  );
}