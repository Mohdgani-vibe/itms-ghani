import { ShieldAlert } from 'lucide-react';

interface AlertsDetailEmptyStateProps {
  darkMode?: boolean;
}

export function AlertsDetailEmptyState({ darkMode = false }: AlertsDetailEmptyStateProps) {
  return (
    <div className={`flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
      <div className={`rounded-full p-4 ${darkMode ? 'bg-slate-900 text-slate-500' : 'bg-zinc-100 text-zinc-400'}`}>
        <ShieldAlert className="h-6 w-6" />
      </div>
      <div className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-zinc-700'}`}>Select an alert</div>
      <div className="max-w-sm">Pick any item from the feed to inspect asset context, compare related findings, and run the available response actions.</div>
    </div>
  );
}