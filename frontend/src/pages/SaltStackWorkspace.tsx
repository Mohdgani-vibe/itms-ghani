import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';

import TerminalConsoleView from '../components/TerminalConsoleView';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import { loadAuthoredSaltTemplates, saveAuthoredSaltTemplates, type AuthoredSaltTemplate } from '../lib/saltTemplates';

interface SaltWorkspaceAsset {
  id: string;
  hostname: string;
  saltMinionId?: string | null;
  departmentName?: string | null;
  connected: boolean;
  patchStatus?: string | null;
}

interface SaltWorkspaceResponse {
  assets: SaltWorkspaceAsset[];
  recentExecutions?: unknown[];
  executionPolicy?: {
    allowedCommands?: string[];
  };
  summary?: {
    totalAssets?: number;
    connectedTargets?: number;
    linkedTargets?: number;
    pendingActions?: number;
  };
  integrations: {
    saltApiConfigured: boolean;
  };
}

interface SaltWorkspaceExecutionRow {
  deviceId?: string;
  hostname: string;
  department: string;
  minionId?: string;
  status: string;
  patchStatus?: string;
  action: string;
  message: string;
  updatedItems: string[];
  packageChanges: Array<{ name: string; fromVersion?: string | null; toVersion?: string | null }>;
  alreadyLatest?: string[];
  failedPackages?: string[];
  rebootRequired?: boolean;
  startTime?: string;
  durationSeconds?: number;
}

interface SaltWorkspaceExecutionLog {
  minionId?: string;
  hostname?: string;
  function?: string;
  stateName?: string;
  status?: string;
  packages?: Array<{ name: string; fromVersion?: string | null; toVersion?: string | null }>;
  startedAt?: string;
  durationMs?: number;
  error?: string | null;
  message?: string;
  department?: string;
}

interface SaltWorkspaceRunResult {
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount?: number;
  failedCount?: number;
  rows?: SaltWorkspaceExecutionRow[];
  logs?: SaltWorkspaceExecutionLog[];
  stdout?: string;
  raw?: unknown;
}

interface SaltWorkspaceTemplatesApiResponse {
  templates?: AuthoredSaltTemplate[];
  updatedAt?: string;
}

interface SaltFunctionOption {
  id: string;
  label: string;
  helper: string;
  defaultArguments?: string;
}

const SALT_FUNCTION_OPTIONS: SaltFunctionOption[] = [
  { id: 'test.ping', label: 'test.ping', helper: 'Verify that the selected Salt minion responds to the master.' },
  { id: 'test.version', label: 'test.version', helper: 'Return the Salt version running on the selected minion.' },
  { id: 'grains.items', label: 'grains.items', helper: 'Inspect the grains inventory collected from the endpoint.' },
  { id: 'disk.usage', label: 'disk.usage', helper: 'Check disk usage across the selected Salt target.' },
  { id: 'status.uptime', label: 'status.uptime', helper: 'Return uptime details from the selected endpoint.' },
  { id: 'pkg.upgrades', label: 'pkg.upgrades', helper: 'List packages that currently have upgrades pending.' },
  { id: 'pkg.uptodate', label: 'pkg.uptodate', helper: 'Apply package updates to the selected Salt scope.' },
  { id: 'cmd.run', label: 'cmd.run', helper: 'Run one guarded shell command directly against the selected Salt target.', defaultArguments: 'hostname' },
  { id: 'state.apply', label: 'state.apply', helper: 'Run one saved Salt state from Patch > Automation.' },
  { id: 'service.status', label: 'service.status', helper: 'Check the status of a single service.', defaultArguments: 'salt-minion' },
  { id: 'network.interfaces', label: 'network.interfaces', helper: 'Return network interface data for the selected endpoint.' },
  { id: 'cmd.script', label: 'cmd.script', helper: 'Run one saved guarded shell command from Patch > Automation through the backend command path.' },
];

const TERMINAL_BLOCKED_FRAGMENTS = ['&&', '||', ';', '|', '>', '<', '`', '$(', '${', 'sudo ', ' su ', ' ssh ', 'scp ', 'sftp ', 'rm ', 'mkfs', 'shutdown', 'reboot', 'poweroff', 'passwd', 'useradd', 'usermod', 'groupadd', 'chmod ', 'chown ', 'tee ', 'curl ', 'wget ', 'nc ', 'ncat ', 'python ', 'python3 ', 'perl ', 'ruby ', 'bash ', 'sh ', 'zsh ', 'fish ', 'vi ', 'vim ', 'nano ', ' top ', ' htop ', ' less ', ' more '];

function validateGuardedShellCommand(command: string, allowedCommands: string[]) {
  const trimmed = command.trim();
  if (!trimmed) {
    return 'Create a .sh command template from Patch before running cmd.script.';
  }
  if (/\r|\n/.test(trimmed)) {
    return 'cmd.script only supports one guarded shell command. Multi-line scripts are blocked.';
  }

  const lowerCommand = ` ${trimmed.toLowerCase()} `;
  if (TERMINAL_BLOCKED_FRAGMENTS.some((fragment) => lowerCommand.includes(fragment))) {
    return 'cmd.script only supports one guarded shell command. Remove pipes, chaining, redirects, downloads, interpreters, and interactive tools.';
  }

  const fields = trimmed.split(/\s+/).filter(Boolean);
  const rootCommand = (fields[0] || '').toLowerCase();
  if (!rootCommand || (allowedCommands.length > 0 && !allowedCommands.includes(rootCommand))) {
    return 'cmd.script must start with one approved shell command from the backend terminal policy.';
  }

  if (rootCommand === 'systemctl' && fields.length > 1) {
    const subcommand = (fields[1] || '').toLowerCase();
    if (subcommand !== 'status' && subcommand !== 'show' && subcommand !== 'list-units' && subcommand !== 'list-unit-files') {
      return 'cmd.script only allows read-only systemctl commands.';
    }
  }

  if (rootCommand === 'journalctl') {
    const hasBlockedJournalctlFlag = fields.slice(1).some((field) => field.startsWith('--vacuum') || field.toLowerCase() === '--setup-keys' || field.toLowerCase() === '--rotate');
    if (hasBlockedJournalctlFlag) {
      return 'cmd.script only allows read-only journalctl commands.';
    }
  }

  return '';
}

function parseSaltTerminalArguments(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatSaltTargetModeLabel(value: 'single' | 'multiple' | 'department' | 'all') {
  switch (value) {
    case 'single':
      return 'Single system';
    case 'multiple':
      return 'Multiple systems';
    case 'department':
      return 'Department';
    case 'all':
      return 'All systems';
    default:
      return 'Single system';
  }
}

function normalizeExecutionStatus(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'success') {
    return 'success';
  }
  if (normalized === 'failed' || normalized === 'error' || normalized === 'no_response') {
    return 'failed';
  }
  if (normalized === 'queued' || normalized === 'running' || normalized === 'pending') {
    return 'running';
  }
  return 'unknown';
}

function buildFunctionPreview(functionName: string, argumentLine: string) {
  const trimmedFunction = functionName.trim();
  const trimmedArguments = argumentLine.trim();
  if (!trimmedFunction) {
    return '';
  }
  return trimmedArguments ? `${trimmedFunction} ${trimmedArguments}` : trimmedFunction;
}

function pickDefaultSaltAsset(assets: SaltWorkspaceAsset[]) {
  return assets.find((asset) => asset.connected && asset.saltMinionId)
    || assets.find((asset) => asset.saltMinionId)
    || assets[0]
    || null;
}

function normalizeDepartmentName(value?: string | null) {
  return value?.trim() || 'Unassigned';
}

export default function SaltStackWorkspace() {
  const location = useLocation();
  const session = getStoredSession();
  const role = (session?.user.role || '').toLowerCase();
  const canOperate = role === 'super_admin' || role === 'it_team';
  const requestedAssetId = useMemo(() => new URLSearchParams(location.search).get('assetId')?.trim() || '', [location.search]);

  const [workspace, setWorkspace] = useState<SaltWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departmentSelectionMode, setDepartmentSelectionMode] = useState<'single' | 'multiple'>('single');
  const [targetMode, setTargetMode] = useState<'single' | 'multiple' | 'department' | 'all'>('single');
  const [targetsValue, setTargetsValue] = useState('');
  const [targetDepartmentValue, setTargetDepartmentValue] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('test.ping');
  const [functionArgumentsInput, setFunctionArgumentsInput] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [executionError, setExecutionError] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [executionLogs, setExecutionLogs] = useState<SaltWorkspaceExecutionLog[]>([]);
  const [executionRows, setExecutionRows] = useState<SaltWorkspaceExecutionRow[]>([]);
  const [lastExecution, setLastExecution] = useState<SaltWorkspaceRunResult | null>(null);
  const [authoredTemplates, setAuthoredTemplates] = useState<AuthoredSaltTemplate[]>(() => loadAuthoredSaltTemplates());

  const refreshWorkspace = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<SaltWorkspaceResponse>('/api/salt/workspace');
      setWorkspace(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load Salt workspace');
    } finally {
      setLoading(false);
    }
  };

  const refreshTemplates = async () => {
    try {
      const response = await apiRequest<SaltWorkspaceTemplatesApiResponse>('/api/salt/workspace/templates');
      const templates = Array.isArray(response.templates) ? response.templates : loadAuthoredSaltTemplates();
      setAuthoredTemplates(templates);
      saveAuthoredSaltTemplates(templates);
    } catch {
      setAuthoredTemplates(loadAuthoredSaltTemplates());
    }
  };

  useEffect(() => {
    void refreshWorkspace();
    void refreshTemplates();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncTemplates = () => setAuthoredTemplates(loadAuthoredSaltTemplates());
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  const assets = useMemo(() => workspace?.assets || [], [workspace?.assets]);
  const departmentOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => normalizeDepartmentName(asset.departmentName)))).sort((left, right) => left.localeCompare(right)),
    [assets],
  );
  const scopedAssets = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return assets;
    }
    return assets.filter((asset) => selectedDepartments.includes(normalizeDepartmentName(asset.departmentName)));
  }, [assets, selectedDepartments]);

  useEffect(() => {
    if (!workspace || !requestedAssetId) {
      return;
    }

    const requestedAsset = workspace.assets.find((asset) => asset.id === requestedAssetId);
    if (!requestedAsset) {
      return;
    }

    setSelectedAssetId(requestedAsset.id);
    setSelectedDepartments([normalizeDepartmentName(requestedAsset.departmentName)]);
  }, [requestedAssetId, workspace]);

  useEffect(() => {
    if (scopedAssets.length === 0) {
      setSelectedAssetId('');
      return;
    }

    if (scopedAssets.some((asset) => asset.id === selectedAssetId)) {
      return;
    }

    setSelectedAssetId(pickDefaultSaltAsset(scopedAssets)?.id || '');
  }, [scopedAssets, selectedAssetId]);

  const selectedAsset = useMemo(
    () => scopedAssets.find((asset) => asset.id === selectedAssetId) || pickDefaultSaltAsset(scopedAssets),
    [scopedAssets, selectedAssetId],
  );
  const functionArguments = useMemo(
    () => functionArgumentsInput.trim() ? functionArgumentsInput.trim().split(/\s+/).filter(Boolean) : [],
    [functionArgumentsInput],
  );
  const savedSlsTemplates = useMemo(
    () => authoredTemplates.filter((template) => template.kind === 'sls'),
    [authoredTemplates],
  );
  const savedShellTemplates = useMemo(
    () => authoredTemplates.filter((template) => template.kind === 'shell'),
    [authoredTemplates],
  );
  const selectedFunctionOption = useMemo(
    () => SALT_FUNCTION_OPTIONS.find((option) => option.id === selectedFunction) || null,
    [selectedFunction],
  );
  const selectedRunnerTemplate = useMemo(() => {
    if (selectedFunction === 'state.apply') {
      return savedSlsTemplates.find((template) => template.id === selectedTemplateId) || savedSlsTemplates[0] || null;
    }
    if (selectedFunction === 'cmd.script') {
      return savedShellTemplates.find((template) => template.id === selectedTemplateId) || savedShellTemplates[0] || null;
    }
    return null;
  }, [savedShellTemplates, savedSlsTemplates, selectedFunction, selectedTemplateId]);
  const selectedMultipleTargets = useMemo(() => parseSaltTerminalArguments(targetsValue), [targetsValue]);
  const highlightedAssets = useMemo(() => {
    return [...scopedAssets]
      .sort((left, right) => Number(right.connected) - Number(left.connected) || left.hostname.localeCompare(right.hostname))
      .slice(0, 6);
  }, [scopedAssets]);
  useEffect(() => {
    if (selectedFunction === 'state.apply') {
      setSelectedTemplateId((current) => (savedSlsTemplates.some((template) => template.id === current) ? current : (savedSlsTemplates[0]?.id || '')));
      return;
    }
    if (selectedFunction === 'cmd.script') {
      setSelectedTemplateId((current) => (savedShellTemplates.some((template) => template.id === current) ? current : (savedShellTemplates[0]?.id || '')));
      return;
    }
    setSelectedTemplateId('');
  }, [savedShellTemplates, savedSlsTemplates, selectedFunction]);

  useEffect(() => {
    if (selectedDepartments.length === 1) {
      setTargetDepartmentValue((current) => current || selectedDepartments[0]);
    }
  }, [selectedDepartments]);

  const previewCommand = useMemo(() => {
    if (selectedFunction === 'state.apply') {
      return selectedRunnerTemplate?.stateName?.trim() ? `state.apply ${selectedRunnerTemplate.stateName.trim()}` : 'state.apply';
    }
    if (selectedFunction === 'cmd.script') {
      return selectedRunnerTemplate ? `cmd.script ${selectedRunnerTemplate.name}` : 'cmd.script';
    }
    return buildFunctionPreview(selectedFunction, functionArgumentsInput);
  }, [functionArgumentsInput, selectedFunction, selectedRunnerTemplate]);
  const executionScopeLabel = useMemo(() => {
    if (targetMode === 'all') {
      return 'All systems';
    }
    if (targetMode === 'department') {
      return targetDepartmentValue.trim() || 'Department';
    }
    if (targetMode === 'multiple') {
      return `${selectedMultipleTargets.length || 0} selected systems`;
    }
    return selectedAsset?.saltMinionId || selectedAsset?.hostname || 'Selected system';
  }, [selectedAsset?.hostname, selectedAsset?.saltMinionId, selectedMultipleTargets.length, targetDepartmentValue, targetMode]);
  const singleTargetValue = useMemo(
    () => selectedAsset?.saltMinionId || selectedAsset?.hostname || '',
    [selectedAsset?.hostname, selectedAsset?.saltMinionId],
  );
  const cmdScriptBlockedReason = useMemo(() => {
    if (selectedFunction !== 'cmd.script') {
      return '';
    }
    return validateGuardedShellCommand(selectedRunnerTemplate?.content || '', workspace?.executionPolicy?.allowedCommands || []);
  }, [selectedFunction, selectedRunnerTemplate?.content, workspace?.executionPolicy?.allowedCommands]);
  const executionName = useMemo(() => `${selectedFunction} -> ${executionScopeLabel}`, [executionScopeLabel, selectedFunction]);

  const commandBlockedReason = !canOperate
    ? 'Auditor access is read-only. Command execution is disabled.'
    : !workspace?.integrations.saltApiConfigured
      ? 'The server Salt API is not configured.'
      : targetMode === 'single' && !selectedAsset
        ? 'Choose a department scope with at least one Salt-ready asset before building a command.'
        : targetMode === 'single' && !singleTargetValue
          ? 'This asset has no Salt hostname or linked minion ID yet.'
          : targetMode === 'department' && !targetDepartmentValue.trim()
            ? 'Choose a department for department-targeted runs.'
            : targetMode === 'multiple' && selectedMultipleTargets.length === 0
              ? 'Enter at least one minion ID or hostname for a multi-system run.'
              : targetMode === 'all' && assets.length === 0
                ? 'No Salt-ready assets are available for an all-systems run.'
                : selectedFunction === 'state.apply' && !selectedRunnerTemplate?.stateName.trim()
                  ? 'Create an .sls template from Patch before running state.apply.'
                  : selectedFunction === 'cmd.script' && cmdScriptBlockedReason
                    ? cmdScriptBlockedReason
                    : '';

  const runFunctionCommand = async () => {
    if (commandBlockedReason) {
      setExecutionError(commandBlockedReason);
      return;
    }

    try {
      setRunning(true);
      setExecutionError('');

      const functionName = selectedFunction;
      const argumentsList = selectedFunction === 'state.apply'
        ? [selectedRunnerTemplate?.stateName.trim() || '']
        : selectedFunction === 'cmd.script'
          ? [selectedRunnerTemplate?.content.trim() || '']
          : functionArguments;

      const result = await apiRequest<SaltWorkspaceRunResult>('/api/salt/workspace/execute', {
        method: 'POST',
        body: JSON.stringify({
          client: 'local',
          function: functionName,
          arguments: argumentsList,
          targetMode,
          target: targetMode === 'single' ? singleTargetValue : '',
          targets: targetMode === 'multiple' ? selectedMultipleTargets : [],
          departmentName: targetMode === 'department' ? targetDepartmentValue.trim() : '',
          label: executionScopeLabel,
          test: testMode,
        }),
      });

      setLastExecution(result);
      setExecutionRows(result.rows || []);
      setExecutionLogs(result.logs || []);
      setTerminalOutput(result.stdout || JSON.stringify(result.raw || result.rows || result.logs || result, null, 2));
      await refreshWorkspace();
    } catch (requestError) {
      setExecutionError(requestError instanceof Error ? requestError.message : 'Failed to run Salt function');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7f9ff_0%,_#eef4ff_100%)] px-4 py-4 text-slate-950 xl:px-6">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f4f9ff_50%,_#eef6ff_100%)] shadow-sm">
          <div className="space-y-4 p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Salt Terminal</div>
                <h1 className="mt-2 text-[2rem] font-black leading-tight text-slate-950">Operations control deck</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Build the department scope, pick a live minion, compose one guarded Salt action, and monitor the terminal output without jumping between views.</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sky-700 shadow-sm">Scope-first targeting</span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-700 shadow-sm">Connected minion routing</span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-700 shadow-sm">Template-aware execution</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading Salt workspace...</div> : null}
        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm">{error}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fbfdff_0%,_#f4f8ff_48%,_#fefaf0_100%)] px-5 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scope builder</div>
              <h2 className="mt-1 text-lg font-black text-slate-950">Choose department coverage</h2>
              <p className="mt-1 text-sm text-slate-500">Start from scope, then pick the minion you want to drive from this set.</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                <button type="button" onClick={() => { setDepartmentSelectionMode('single'); setSelectedDepartments((current) => current.length > 1 ? [current[0]] : current); }} className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'single' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Single</button>
                <button type="button" onClick={() => setDepartmentSelectionMode('multiple')} className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'multiple' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Multiple</button>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Department target</div>
                {departmentSelectionMode === 'single' ? (
                  <select value={selectedDepartments[0] || 'all'} onChange={(event) => setSelectedDepartments(event.target.value === 'all' ? [] : [event.target.value])} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                    <option value="all">All departments</option>
                    {departmentOptions.map((department) => <option key={`salt-department-${department}`} value={department}>{department}</option>)}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedDepartments([])} className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${selectedDepartments.length === 0 ? 'border-sky-300 bg-sky-100 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>All</button>
                    {departmentOptions.map((department) => {
                      const active = selectedDepartments.includes(department);
                      return (
                        <button
                          key={`salt-department-chip-${department}`}
                          type="button"
                          onClick={() => setSelectedDepartments((current) => (active ? current.filter((entry) => entry !== department) : [...current, department]))}
                          className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${active ? 'border-sky-300 bg-sky-100 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          {department}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Available minions</div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">Top connected assets in this scope</div>
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{scopedAssets.length}</div>
                </div>
                <div className="mt-4 space-y-2.5">
                  {highlightedAssets.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm font-semibold text-slate-500">No Salt-ready assets are visible for the current scope.</div> : highlightedAssets.map((asset) => {
                    const active = (selectedAsset?.id || '') === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left shadow-sm transition ${active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-950">{asset.hostname}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">{asset.saltMinionId || 'Minion pending'}</div>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${asset.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{asset.connected ? 'Connected' : 'Pending'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Resolved minion</div>
                <div className="mt-2 text-base font-black text-slate-950">{selectedAsset?.saltMinionId || 'No Salt-ready asset in scope'}</div>
                <div className="mt-1 text-sm text-slate-500">{selectedAsset?.hostname || 'Adjust department coverage to resolve a target.'}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution mode</div>
                <select value={targetMode} onChange={(event) => setTargetMode(event.target.value as 'single' | 'multiple' | 'department' | 'all')} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                  <option value="single">Single system</option>
                  <option value="department">Department</option>
                  <option value="multiple">Multiple systems</option>
                  <option value="all">All systems</option>
                </select>
                {targetMode === 'department' ? (
                  <select value={targetDepartmentValue} onChange={(event) => setTargetDepartmentValue(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                    <option value="">Choose a department</option>
                    {departmentOptions.map((department) => <option key={`salt-target-department-${department}`} value={department}>{department}</option>)}
                  </select>
                ) : null}
                {targetMode === 'multiple' ? (
                  <textarea value={targetsValue} onChange={(event) => setTargetsValue(event.target.value)} rows={4} placeholder="pc-001, pc-002, pc-003" className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
                ) : null}
                {targetMode === 'all' ? <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-900">All Salt-ready systems in the workspace will receive this execution.</div> : null}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_46%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-5 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Command composer</div>
              <h2 className="mt-1 text-lg font-black text-slate-950">Assemble one guarded Salt action</h2>
              <p className="mt-1 text-sm text-slate-500">Pick a function, preview the exact execution string, and run it against the selected minion.</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 lg:grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Client</div>
                  <div className="mt-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm font-semibold text-slate-950">local</div>
                </div>
                <label>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Function</div>
                  <select value={selectedFunction} onChange={(event) => {
                    const nextFunction = event.target.value;
                    const option = SALT_FUNCTION_OPTIONS.find((entry) => entry.id === nextFunction);
                    setSelectedFunction(nextFunction);
                    setFunctionArgumentsInput(option?.defaultArguments || '');
                  }} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                    {SALT_FUNCTION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution name</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{formatSaltTargetModeLabel(targetMode)}</div>
                  <div className="mt-1.5 text-sm font-black text-slate-950">{executionName}</div>
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution preview</div>
                  <div className="mt-1.5 font-mono text-sm font-semibold text-slate-950">{previewCommand || 'No command defined yet.'}</div>
                </div>

              {selectedFunction === 'state.apply' || selectedFunction === 'cmd.script' ? (
                <label className="block">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{selectedFunction === 'state.apply' ? 'Saved .sls template' : 'Saved .sh script'}</div>
                    <div className="text-[11px] font-semibold text-slate-500">Managed in Patch workspace</div>
                  </div>
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-sky-300 bg-sky-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400">
                    <option value="">{selectedFunction === 'state.apply' ? 'Select an .sls template' : 'Select a .sh script'}</option>
                    {(selectedFunction === 'state.apply' ? savedSlsTemplates : savedShellTemplates).map((template) => (
                      <option key={template.id} value={template.id}>{template.name}{template.stateName ? ` (${template.stateName})` : ''}</option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedRunnerTemplate?.description || (selectedFunction === 'state.apply' ? 'Create the required .sls state from Patch > Automation before running it here.' : 'Create the required .sh command template from Patch > Automation before running it here. Only one guarded shell command is accepted.')}</div>
                </label>
              ) : (
                <label className="block">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Arguments</div>
                  <input value={functionArgumentsInput} onChange={(event) => setFunctionArgumentsInput(event.target.value)} placeholder="optional space-separated args" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
                </label>
              )}

              {selectedFunctionOption ? <div className="rounded-[22px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-slate-700">{selectedFunctionOption.helper}</div> : null}

              <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                <span>
                  <span className="block font-bold text-slate-950">Dry run</span>
                  <span className="mt-1 block text-xs text-slate-500">Use `test=True` before rollout for `state.apply` runs.</span>
                </span>
              </label>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Run sheet</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Target mode</div>
                      <div className="mt-1 text-sm font-black text-slate-950">{formatSaltTargetModeLabel(targetMode)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution scope</div>
                      <div className="mt-1 text-sm font-black text-slate-950">{executionScopeLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution readiness</div>
                      <div className={`mt-1 text-sm font-semibold ${commandBlockedReason ? 'text-amber-700' : 'text-emerald-700'}`}>{commandBlockedReason || 'Ready to run on the selected target.'}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Action</div>
                    <div className="mt-2 text-lg font-black">{selectedFunction}</div>
                    <div className="mt-1 text-sm text-slate-400">Execution name: {executionName}</div>
                  </div>
                  <button type="button" onClick={() => void runFunctionCommand()} disabled={running || Boolean(commandBlockedReason)} className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
                    <Play className="mr-2 h-4 w-4" /> {running ? 'Running execution...' : 'Run execution'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#101218] shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2">Execution terminal</span>
              </div>
              <div className="font-mono text-slate-400">{executionName}</div>
            </div>
            {targetMode === 'single' && selectedAsset?.saltMinionId ? (
              <TerminalConsoleView key={`${selectedAsset.saltMinionId}:${previewCommand}`} minionId={selectedAsset.saltMinionId} embedded prefilledCommand={previewCommand} />
            ) : (
              <div className="min-h-[480px] bg-[#101218] px-4 py-5">
                <div className="mb-4 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <span>{running ? 'Execution in progress' : 'Latest workspace output'}</span>
                  <span>{lastExecution?.scopeLabel || executionScopeLabel}</span>
                </div>
                <pre className="min-h-[380px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-emerald-300">{terminalOutput || (running ? 'Waiting for backend output...' : 'Run an execution to see backend terminal output and workspace logs here.')}</pre>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fbfdff_0%,_#f4f8ff_48%,_#fefaf0_100%)] px-5 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Mission brief</div>
              <h2 className="mt-1 text-lg font-black text-slate-950">Execution tracker</h2>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution name</div>
                <div className="mt-2 text-base font-black text-slate-950">{executionName}</div>
                <div className="mt-1 text-sm text-slate-500">{lastExecution?.scopeLabel || executionScopeLabel}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Command line</div>
                <div className="mt-2 break-words font-mono text-sm font-semibold text-slate-950">{previewCommand || 'No command defined yet.'}</div>
              </div>

              <div className={`rounded-[24px] border px-4 py-4 text-sm leading-6 ${commandBlockedReason ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {commandBlockedReason || 'Execution lane is clear. Review the live console and execution summary after the command completes.'}
              </div>
              {executionError ? <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">{executionError}</div> : null}

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Activity logs</div>
                    <div className="mt-1 text-sm text-slate-500">Backend-reported minion status for the latest execution.</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{executionLogs.length || executionRows.length}</div>
                </div>
                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                  {executionLogs.length > 0 ? executionLogs.map((entry, index) => {
                    const state = normalizeExecutionStatus(entry.status);
                    return (
                      <div key={`salt-execution-log-${entry.minionId || entry.hostname || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-950">{entry.hostname || entry.minionId || 'Salt minion'}</div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{entry.function || selectedFunction}{entry.stateName ? ` · ${entry.stateName}` : ''}</div>
                          </div>
                          <div className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === 'success' ? 'bg-emerald-100 text-emerald-700' : state === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status || 'unknown'}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{entry.message || entry.error || 'No message returned.'}</div>
                      </div>
                    );
                  }) : executionRows.length > 0 ? executionRows.map((row, index) => {
                    const state = normalizeExecutionStatus(row.status);
                    return (
                      <div key={`salt-execution-row-${row.minionId || row.hostname || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-950">{row.hostname}</div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{row.action} · {row.department}</div>
                          </div>
                          <div className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === 'success' ? 'bg-emerald-100 text-emerald-700' : state === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{row.status}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{row.message || 'No message returned.'}</div>
                      </div>
                    );
                  }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">Run a Salt execution to populate the minion activity log.</div>}
                </div>
              </div>
            </div>
          </section>
        </section>

      </div>
    </div>
  );
}
