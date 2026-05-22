import type { ReactNode } from 'react';

interface RequestSelectedDetailPanelProps {
  children: ReactNode;
}

export default function RequestSelectedDetailPanel({ children }: RequestSelectedDetailPanelProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 shadow-sm">
      <div className="border-b border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Selected Request</div>
        <div className="mt-1 text-sm text-zinc-600">Table view is for scanning. Full request controls stay available below for the selected row.</div>
      </div>
      {children}
    </div>
  );
}