import { ShieldAlert } from 'lucide-react';

export function AlertsDetailEmptyState() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-500">
      <div className="rounded-full bg-zinc-100 p-4 text-zinc-400">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <div className="text-base font-semibold text-zinc-700">Select an alert</div>
      <div className="max-w-sm">Pick any item from the feed to inspect asset context, compare related findings, and run the available response actions.</div>
    </div>
  );
}