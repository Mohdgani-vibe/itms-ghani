import { TerminalSquare } from 'lucide-react';
import { actionButtonStyles } from '../../lib/buttonStyles';
import type { DeviceTerminalSessionRecord } from './types';

interface TerminalAccessPanelProps {
  canOperate: boolean;
  canStartTerminal: boolean;
  startingTerminal: boolean;
  terminalBlockedReason: string | null;
  sidebarLoading: boolean;
  terminalSessions: DeviceTerminalSessionRecord[];
  onStartTerminal: () => void;
  formatDate: (value?: string | null) => string;
}

export default function TerminalAccessPanel({
  canOperate,
  canStartTerminal,
  startingTerminal,
  terminalBlockedReason,
  sidebarLoading,
  terminalSessions,
  onStartTerminal,
  formatDate,
}: TerminalAccessPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">
      <TerminalSquare className="mr-2 h-4 w-4 text-brand-600" /> SSH Terminal
    </div>
    <p className="mt-2 text-sm text-zinc-500">Open an SSH terminal for this asset and review recent session history.</p>
    {canOperate ? (
      <button type="button" onClick={onStartTerminal} disabled={startingTerminal || !canStartTerminal} className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}>
        {startingTerminal ? 'Opening terminal...' : 'Open SSH Terminal'}
      </button>
    ) : null}
    {canOperate && terminalBlockedReason ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">{terminalBlockedReason}</div> : null}
    <div className="mt-4 space-y-3">
      {sidebarLoading ? <div className="text-sm text-zinc-500">Loading sessions...</div> : null}
      {!sidebarLoading && terminalSessions.length === 0 ? <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">No terminal sessions recorded for this asset.</div> : null}
      {terminalSessions.map((sessionEntry) => (
        <div key={sessionEntry.id} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
          <div className="text-sm font-semibold text-zinc-900">{sessionEntry.status}</div>
          <div className="mt-1 text-xs text-zinc-500">{sessionEntry.requestedBy || 'Unknown user'} • {formatDate(sessionEntry.createdAt)}</div>
        </div>
      ))}
    </div>
  </div>;
}