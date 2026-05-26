import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MonitorSmartphone, Play, RotateCcw, TerminalSquare } from 'lucide-react';

import { apiRequest } from '../lib/api';
import PatchRunReportModal from './PatchRunReportModal';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, createPatchRunRunningEntry, type PatchRunExecutionResponse, type PatchRunReport } from '../lib/patchReports';

const TERMINAL_HISTORY_LIMIT = 12;

interface TerminalPresetGroup {
  label: string;
  commands: string[];
}

interface TerminalPolicy {
  allowedCommands: string[];
  presetCommands: string[];
  presetGroups?: TerminalPresetGroup[];
  blockedExamples?: string[];
  restrictions: string[];
}

interface TerminalTargetResponse {
  assetId: string;
  assetName?: string | null;
  hostname: string;
  assetTag: string;
  departmentName?: string | null;
  locationName?: string | null;
  minionId: string;
  connected: boolean;
  policy?: TerminalPolicy;
}

interface TerminalCommandResponse {
  command: string;
  stdout: string;
  stderr: string;
  retcode: number | string;
}

function parsePatchStateCommand(command: string) {
  const normalized = command.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }

  const stateCommand = normalized.startsWith('salt-call ')
    ? normalized.slice('salt-call '.length).trim()
    : normalized;

  const statePrefixes = ['state ', 'state.apply ', 'state.sls '];
  const statePrefix = statePrefixes.find((prefix) => stateCommand.startsWith(prefix));
  if (!statePrefix) {
    return '';
  }

  const stateName = stateCommand.slice(statePrefix.length).trim();
  if (!stateName) {
    return '';
  }

  if (stateName === 'patch' || stateName === 'patch.run' || stateName.startsWith('patch.')) {
    return stateName;
  }

  return '';
}

function formatPatchHistoryOutput(row: PatchRunReport['rows'][number]) {
  if (row.packageChanges.length > 0) {
    return row.packageChanges.map((change) => {
      if (change.fromVersion && change.toVersion) {
        return `${change.name}: ${change.fromVersion} -> ${change.toVersion}`;
      }
      if (change.toVersion) {
        return `${change.name}: + ${change.toVersion}`;
      }
      if (change.fromVersion) {
        return `${change.name}: ${change.fromVersion} -> removed`;
      }
      return change.name;
    }).join('\n');
  }

  if (row.updatedItems.length > 0) {
    return row.updatedItems.join('\n');
  }

  return row.message;
}

interface TerminalEntry extends TerminalCommandResponse {
  id: string;
  createdAt: string;
}

interface TerminalConsoleViewProps {
  minionId: string;
  embedded?: boolean;
  prefilledCommand?: string;
  onBack?: () => void;
}

function historyStorageKey(minionId: string) {
  return `itms_terminal_history_${minionId}`;
}

function terminalErrorHint(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized.includes('blocked shell pattern')) {
    return 'Run one approved command at a time. Remove pipes, redirects, chaining operators, sudo, downloads, and interactive utilities.';
  }
  if (normalized.includes('command is not allowed in the terminal console')) {
    return 'Start with one of the allowed shell tools shown in the sidebar, or use a Salt state in the form state.apply <state_name>.';
  }
  if (normalized.includes('only read-only systemctl commands are allowed')) {
    return 'Use systemctl status, show, list-units, or list-unit-files. Restart, stop, enable, and other mutating actions are blocked.';
  }
  if (normalized.includes('only read-only journalctl commands are allowed')) {
    return 'Use read-only journalctl forms such as -n, -u, or --since. Rotation and vacuum operations are blocked.';
  }
  if (normalized.includes('only simple salt state names are allowed')) {
    return 'Use a simple Salt state name such as state.apply patch.run. Spaces, shell operators, and chained commands are blocked.';
  }
  return '';
}

export default function TerminalConsoleView({ minionId, embedded = false, prefilledCommand = '', onBack }: TerminalConsoleViewProps) {
  const [target, setTarget] = useState<TerminalTargetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showEmbeddedPresets, setShowEmbeddedPresets] = useState(false);
  const [command, setCommand] = useState('');
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState('');
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [targetReloadNonce, setTargetReloadNonce] = useState(0);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const sessionRecordedAssetIdRef = useRef('');

  useEffect(() => {
    setTarget(null);
    setLoading(true);
    setRunning(false);
    setShowEmbeddedPresets(false);
    setEntries([]);
    setHistory([]);
    setHistoryIndex(-1);
    setError('');
    setPatchReport(null);
    setCommand(prefilledCommand.trim());
    sessionRecordedAssetIdRef.current = '';
  }, [minionId, prefilledCommand]);

  const refreshTarget = () => {
    setError('');
    setTargetReloadNonce((current) => current + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const loadTarget = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await apiRequest<TerminalTargetResponse>(`/api/terminal/targets/${encodeURIComponent(minionId)}`);
        if (!cancelled) {
          setTarget(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load terminal target');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (minionId) {
      void loadTarget();
    } else {
      setLoading(false);
      setError('Terminal target is missing.');
    }

    return () => {
      cancelled = true;
    };
  }, [minionId, targetReloadNonce]);

  useEffect(() => {
    const assetId = target?.assetId || '';
    if (!assetId || sessionRecordedAssetIdRef.current === assetId) {
      return;
    }

    let cancelled = false;

    const recordTerminalSession = async () => {
      try {
        await apiRequest('/api/terminal/session', {
          method: 'POST',
          body: JSON.stringify({ deviceId: assetId }),
        });
        if (!cancelled) {
          sessionRecordedAssetIdRef.current = assetId;
        }
      } catch (requestError) {
        if (!cancelled) {
          setError((current) => current || (requestError instanceof Error ? requestError.message : 'Failed to start terminal session'));
        }
      }
    };

    void recordTerminalSession();

    return () => {
      cancelled = true;
    };
  }, [target?.assetId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !minionId) {
      return;
    }
    try {
      const storedHistory = window.localStorage.getItem(historyStorageKey(minionId));
      const parsedHistory = storedHistory ? JSON.parse(storedHistory) : [];
      setHistory(Array.isArray(parsedHistory) ? parsedHistory.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []);
    } catch {
      setHistory([]);
    }
    setHistoryIndex(-1);
  }, [minionId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !minionId) {
      return;
    }
    window.localStorage.setItem(historyStorageKey(minionId), JSON.stringify(history.slice(0, TERMINAL_HISTORY_LIMIT)));
  }, [history, minionId]);

  useEffect(() => {
    if (!outputRef.current) {
      return;
    }
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [entries]);

  const shellPrompt = useMemo(() => `${target?.hostname || minionId}$`, [minionId, target?.hostname]);
  const targetDepartmentLabel = useMemo(() => (target?.departmentName || '').trim() || 'Unassigned department', [target?.departmentName]);
  const targetLocationLabel = useMemo(() => (target?.locationName || '').trim() || 'Unknown location', [target?.locationName]);
  const targetAssetName = useMemo(() => (target?.assetName || '').trim() || (target?.hostname || minionId), [minionId, target?.assetName, target?.hostname]);
  const presetCommands = useMemo(() => target?.policy?.presetCommands ?? [], [target?.policy?.presetCommands]);
  const presetGroups = useMemo(() => target?.policy?.presetGroups ?? [], [target?.policy?.presetGroups]);
  const blockedExamples = useMemo(() => target?.policy?.blockedExamples ?? [], [target?.policy?.blockedExamples]);
  const allowedCommands = useMemo(() => target?.policy?.allowedCommands ?? [], [target?.policy?.allowedCommands]);
  const restrictions = useMemo(() => target?.policy?.restrictions ?? [], [target?.policy?.restrictions]);
  const errorHint = useMemo(() => terminalErrorHint(error), [error]);
  const connectionMessage = useMemo(() => {
    if (loading || !target || target.connected) {
      return '';
    }

    return 'This Salt target is linked but not currently connected to the master. You can review presets and history here, but command execution stays disabled until the minion reconnects.';
  }, [loading, target]);
  const runDisabled = loading || running || !command.trim() || !target?.connected;
  const runButtonLabel = running ? 'Running...' : target?.connected ? 'Run' : 'Unavailable';

  const applyHistoryEntry = (nextIndex: number) => {
    if (history.length === 0) {
      return;
    }
    if (nextIndex < 0) {
      setHistoryIndex(-1);
      setCommand('');
      return;
    }
    const boundedIndex = Math.min(nextIndex, history.length - 1);
    setHistoryIndex(boundedIndex);
    setCommand(history[boundedIndex] || '');
  };

  const clearHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
    if (typeof window !== 'undefined' && minionId) {
      window.localStorage.removeItem(historyStorageKey(minionId));
    }
  };

  const runCommand = async () => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand || !target?.connected || running) {
      return;
    }

    const patchStateName = parsePatchStateCommand(trimmedCommand);

    if (patchStateName && target?.assetId) {
      try {
        setRunning(true);
        setError('');
        const requestedAt = new Date().toISOString();
        setPatchReport({
          ...createPatchRunProgressReport(target.hostname || target.minionId, requestedAt, 1),
          rows: [createPatchRunRunningEntry({ id: target.assetId, hostname: target.hostname || target.minionId })],
        });
        const response = await apiRequest<PatchRunExecutionResponse>(`/api/assets/${target.assetId}/patch`, {
          method: 'POST',
          body: JSON.stringify(
            patchStateName === 'patch' || patchStateName === 'patch.run'
              ? { action: 'system-update' }
              : { action: 'custom-state', state: patchStateName },
          ),
        });
        const row = createPatchRunReportEntry({ id: target.assetId, hostname: target.hostname || target.minionId }, response);
        const report = createPatchRunReport(target.hostname || target.minionId, requestedAt, [row]);
        setPatchReport(report);
        setEntries((current) => [...current, {
          id: `${Date.now()}-${current.length}`,
          createdAt: new Date().toISOString(),
          command: trimmedCommand,
              stdout: formatPatchHistoryOutput(row),
          stderr: '',
          retcode: row.status === 'success' ? 0 : 1,
        }]);
        setHistory((current) => [trimmedCommand, ...current.filter((entry) => entry !== trimmedCommand)].slice(0, TERMINAL_HISTORY_LIMIT));
        setHistoryIndex(-1);
        setCommand('');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to execute patch update');
      } finally {
        setRunning(false);
      }
      return;
    }

    try {
      setRunning(true);
      setError('');
      const result = await apiRequest<TerminalCommandResponse>(`/api/terminal/targets/${encodeURIComponent(target.minionId)}/execute`, {
        method: 'POST',
        body: JSON.stringify({ command: trimmedCommand }),
      });
      setEntries((current) => [...current, { ...result, id: `${Date.now()}-${current.length}`, createdAt: new Date().toISOString() }]);
      setHistory((current) => [trimmedCommand, ...current.filter((entry) => entry !== trimmedCommand)].slice(0, TERMINAL_HISTORY_LIMIT));
      setHistoryIndex(-1);
      setCommand('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to execute command');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-zinc-950 text-zinc-100`}>
      <div className={`mx-auto flex ${embedded ? 'h-full max-w-none flex-col px-0 py-0' : 'min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8'}`}>
        {!embedded ? (
          <section className="overflow-hidden rounded-[30px] border border-zinc-800 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(16,185,129,0.16),_transparent_24%),linear-gradient(135deg,_rgba(9,12,20,0.98)_0%,_rgba(15,23,42,0.98)_52%,_rgba(17,24,39,0.96)_100%)] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.36)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  <TerminalSquare className="h-3.5 w-3.5" /> Terminal Console
                </div>
                <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-white">{targetAssetName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Host {target?.hostname || minionId}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Asset ID {target?.assetId || 'pending'}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Asset Tag {target?.assetTag || 'pending'}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Salt Target {target?.minionId || minionId}</span>
                  <span className={`rounded-full border px-3 py-1 ${target?.connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{target?.connected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={refreshTarget} disabled={loading} className="inline-flex items-center rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-2.5 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <RotateCcw className="mr-2 h-4 w-4" /> Refresh
                </button>
                {onBack ? (
                  <button type="button" onClick={onBack} className="inline-flex items-center rounded-2xl border border-zinc-700 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Department</div>
                <div className="mt-2 text-lg font-black text-white">{targetDepartmentLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Location</div>
                <div className="mt-2 text-lg font-black text-white">{targetLocationLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Session Mode</div>
                <div className="mt-2 text-lg font-black text-white">Salt terminal</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Execution</div>
                <div className="mt-2 text-lg font-black text-white">{target?.connected ? 'Commands enabled' : 'Waiting for minion'}</div>
              </div>
            </div>
          </section>
        ) : null}

        {embedded ? (
          <div className="mb-2 rounded-[20px] border border-zinc-800 bg-zinc-900/85 px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 overflow-x-auto">
                <div className="flex min-w-max items-center gap-2 text-xs text-zinc-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-white">{target?.hostname || minionId}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{target?.minionId || minionId}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Asset {target?.assetId || 'pending'}</span>
                  <span className={`rounded-full border px-2.5 py-1 ${target?.connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{target?.connected ? 'Connected' : loading ? 'Connecting' : 'Disconnected'}</span>
                </div>
              </div>
              <button type="button" onClick={refreshTarget} disabled={loading} className="inline-flex shrink-0 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            {connectionMessage ? <div className="mt-2 rounded-xl border border-amber-900/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">{connectionMessage}</div> : null}
          </div>
        ) : null}

        <div className={`grid min-h-0 flex-1 gap-5 ${embedded ? 'grid-cols-1' : 'mt-5 lg:grid-cols-[300px_minmax(0,1fr)]'}`}>
          {!embedded ? (
          <aside className={`min-h-0 overflow-y-auto rounded-[28px] border border-zinc-800 bg-zinc-900 shadow-sm ${embedded ? 'p-4' : 'p-5'}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <MonitorSmartphone className="h-4 w-4 text-emerald-400" /> Session
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">System</div>
                <div className="mt-1">{targetAssetName}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Asset ID</div>
                <div className="mt-1">{target?.assetId || 'Pending'}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
                <div className="mt-1">{targetDepartmentLabel}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Location</div>
                <div className="mt-1">{targetLocationLabel}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Mode</div>
                <div className="mt-1">Salt-backed command console</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Access</div>
                <div className="mt-1">IT Team and Super Admin</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Execution</div>
                <div className="mt-1">Each command runs independently through Salt and returns stdout, stderr, and exit code.</div>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
              This is not a PTY shell. SSH access is not provided here. Interactive programs like top, vim, sudo password prompts, or SSH sessions will not behave like a local terminal.
            </div>
            {allowedCommands.length > 0 ? (
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
                <div className="font-bold uppercase tracking-wider text-zinc-500">Allowed Tools</div>
                <div className="mt-2 text-zinc-300">{allowedCommands.join(', ')}</div>
              </div>
            ) : null}
            {restrictions.length > 0 ? (
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
                <div className="font-bold uppercase tracking-wider text-zinc-500">Policy</div>
                <div className="mt-2 space-y-2">
                  {restrictions.map((restriction) => (
                    <div key={restriction}>{restriction}</div>
                  ))}
                </div>
              </div>
            ) : null}
            {blockedExamples.length > 0 ? (
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
                <div className="font-bold uppercase tracking-wider text-zinc-500">Blocked Examples</div>
                <div className="mt-2 space-y-2 text-zinc-300">
                  {blockedExamples.map((example) => (
                    <div key={example}>{example}</div>
                  ))}
                </div>
              </div>
            ) : null}
            {connectionMessage ? <div className="mt-5 rounded-xl border border-amber-900/70 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">{connectionMessage}</div> : null}
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Recent Commands</div>
                {history.length > 0 ? <button type="button" onClick={clearHistory} className="text-xs font-semibold text-zinc-400 hover:text-zinc-200">Clear</button> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {history.length === 0 ? <div className="text-xs text-zinc-500">No command history for this device yet.</div> : null}
                {history.map((entry) => (
                  <button key={entry} type="button" onClick={() => { setCommand(entry); setHistoryIndex(-1); }} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800">
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          </aside>
          ) : null}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
            {presetGroups.length > 0 || presetCommands.length > 0 ? (
              <div className={`border-b border-zinc-800 bg-zinc-900 ${embedded ? 'px-4 py-3' : 'max-h-56 overflow-y-auto px-5 py-4'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Quick Presets</div>
                  {embedded ? (
                    <button
                      type="button"
                      onClick={() => setShowEmbeddedPresets((current) => !current)}
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800"
                    >
                      {showEmbeddedPresets ? 'Hide' : 'Show'}
                    </button>
                  ) : null}
                </div>
                {!embedded || showEmbeddedPresets ? (
                  presetGroups.length > 0 ? (
                    <div className={`mt-3 ${embedded ? 'max-h-28 space-y-3 overflow-y-auto pr-1' : 'space-y-4'}`}>
                      {presetGroups.map((group) => (
                        <div key={group.label}>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</div>
                          <div className="flex flex-wrap gap-2">
                            {group.commands.map((preset) => (
                              <button key={`${group.label}:${preset}`} type="button" onClick={() => { setCommand(preset); setHistoryIndex(-1); }} className={`rounded-lg border border-zinc-700 bg-zinc-950 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 ${embedded ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`mt-3 flex flex-wrap gap-2 ${embedded ? 'max-h-28 overflow-y-auto pr-1' : ''}`}>
                      {presetCommands.map((preset) => (
                        <button key={preset} type="button" onClick={() => { setCommand(preset); setHistoryIndex(-1); }} className={`rounded-lg border border-zinc-700 bg-zinc-950 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 ${embedded ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            ) : null}
            <div ref={outputRef} className={`flex-1 space-y-4 overflow-auto bg-[#09090b] font-mono text-sm ${embedded ? 'min-h-[620px] px-4 py-4 lg:min-h-[640px]' : 'min-h-[320px] px-5 py-5'}`}>
              {loading ? <div className="text-zinc-400">Loading terminal target...</div> : null}
              {connectionMessage ? <div className="rounded-xl border border-amber-900/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">Salt target offline. Execution is disabled until the minion reconnects to the master.</div> : null}
              {!loading && entries.length === 0 ? <div className="text-zinc-500">Run a command to start this terminal session.</div> : null}
              {entries.map((entry) => (
                <div key={entry.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="text-emerald-400">{shellPrompt} {entry.command}</div>
                  {entry.stdout ? <pre className="overflow-x-auto whitespace-pre-wrap break-words text-zinc-100">{entry.stdout}</pre> : null}
                  {entry.stderr ? <pre className="overflow-x-auto whitespace-pre-wrap break-words text-rose-300">{entry.stderr}</pre> : null}
                  <div className="text-xs text-zinc-500">exit code: {String(entry.retcode)} • {new Date(entry.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-900 px-5 py-4">
              {error ? (
                <div className="mb-3 rounded-xl border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
                  <div>{error}</div>
                  {errorHint ? <div className="mt-2 text-xs text-rose-100/90">{errorHint}</div> : null}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-400">{shellPrompt}</div>
                <input
                  type="text"
                  value={command}
                  onChange={(event) => {
                    setCommand(event.target.value);
                    setHistoryIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void runCommand();
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      applyHistoryEntry(historyIndex + 1);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      applyHistoryEntry(historyIndex - 1);
                    }
                  }}
                  disabled={loading || running || !target?.connected}
                  placeholder={target?.connected ? 'Enter a command' : 'Target is not connected'}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                />
                <button type="button" onClick={() => void runCommand()} disabled={runDisabled} className={`inline-flex items-center rounded-xl px-4 py-3 text-sm font-bold ${target?.connected ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400' : 'bg-zinc-800 text-zinc-400'} disabled:opacity-60`}>
                  <Play className="mr-2 h-4 w-4" /> {runButtonLabel}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <PatchRunReportModal report={patchReport} onClose={() => setPatchReport(null)} />
    </div>
  );
}