import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

import TerminalConsoleView from '../components/TerminalConsoleView';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import { loadAuthoredSaltTemplates, type AuthoredSaltTemplate } from '../lib/saltTemplates';

interface SaltWorkspaceAsset {
  id: string;
  hostname: string;
  saltMinionId?: string | null;
  departmentName?: string | null;
  connected: boolean;
}

interface SaltWorkspaceResponse {
  assets: SaltWorkspaceAsset[];
  integrations: {
    saltApiConfigured: boolean;
  };
}

interface SaltWorkspaceExecutionResult {
  label: string;
  stdout: string;
  stderr: string;
  retcode: number | string;
}

interface SaltFunctionExecutionResponse {
  function: string;
  arguments: string[];
  stdout: string;
  stderr: string;
  retcode: number | string;
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
  { id: 'cmd.run', label: 'cmd.run', helper: 'Run one guarded shell command directly against the selected Salt target.', defaultArguments: 'hostname' },
  { id: 'state.apply', label: 'state.apply', helper: 'Run one saved Salt state from Patch > Scripts.' },
  { id: 'service.status', label: 'service.status', helper: 'Check the status of a single service.', defaultArguments: 'salt-minion' },
  { id: 'network.interfaces', label: 'network.interfaces', helper: 'Return network interface data for the selected endpoint.' },
  { id: 'cmd.script', label: 'cmd.script', helper: 'Run one saved shell script body from Patch > Scripts through the guarded backend command path.' },
];

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
  const [selectedFunction, setSelectedFunction] = useState('test.ping');
  const [functionArgumentsInput, setFunctionArgumentsInput] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [executionResult, setExecutionResult] = useState<SaltWorkspaceExecutionResult | null>(null);
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

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncTemplates = () => setAuthoredTemplates(loadAuthoredSaltTemplates());
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  useEffect(() => {
    setAuthoredTemplates(loadAuthoredSaltTemplates());
  }, [location.pathname]);

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
  const selectedDepartmentLabel = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return 'All departments';
    }
    if (selectedDepartments.length === 1) {
      return selectedDepartments[0];
    }
    return `${selectedDepartments.length} departments`;
  }, [selectedDepartments]);

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
  const selectedFunctionOption = useMemo(
    () => SALT_FUNCTION_OPTIONS.find((option) => option.id === selectedFunction) || null,
    [selectedFunction],
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
  const selectedRunnerTemplate = useMemo(() => {
    if (selectedFunction === 'state.apply') {
      return savedSlsTemplates.find((template) => template.id === selectedTemplateId) || savedSlsTemplates[0] || null;
    }
    if (selectedFunction === 'cmd.script') {
      return savedShellTemplates.find((template) => template.id === selectedTemplateId) || savedShellTemplates[0] || null;
    }
    return null;
  }, [savedShellTemplates, savedSlsTemplates, selectedFunction, selectedTemplateId]);

  useEffect(() => {
    if (selectedFunction === 'state.apply') {
      setSelectedTemplateId((current) => savedSlsTemplates.some((template) => template.id === current) ? current : (savedSlsTemplates[0]?.id || ''));
      return;
    }
    if (selectedFunction === 'cmd.script') {
      setSelectedTemplateId((current) => savedShellTemplates.some((template) => template.id === current) ? current : (savedShellTemplates[0]?.id || ''));
      return;
    }
    setSelectedTemplateId('');
  }, [savedShellTemplates, savedSlsTemplates, selectedFunction]);

  const previewCommand = useMemo(() => {
    if (selectedFunction === 'state.apply') {
      return selectedRunnerTemplate?.stateName?.trim() ? `state.apply ${selectedRunnerTemplate.stateName.trim()}` : 'state.apply';
    }
    if (selectedFunction === 'cmd.script') {
      return selectedRunnerTemplate ? `cmd.script ${selectedRunnerTemplate.name}` : 'cmd.script';
    }
    return buildFunctionPreview(selectedFunction, functionArgumentsInput);
  }, [functionArgumentsInput, selectedFunction, selectedRunnerTemplate]);

  const commandBlockedReason = !selectedAsset
    ? 'Choose a department scope with at least one Salt-ready asset before building a command.'
    : !selectedAsset.saltMinionId
      ? 'This asset has no linked Salt minion ID yet.'
      : !canOperate
        ? 'Auditor access is read-only. Command execution is disabled.'
        : !workspace?.integrations.saltApiConfigured
          ? 'The server Salt API is not configured.'
          : !selectedAsset.connected
            ? 'The selected minion is not currently connected to the master.'
            : selectedFunction === 'state.apply' && !selectedRunnerTemplate?.stateName.trim()
              ? 'Create an .sls template from Patch before running state.apply.'
              : selectedFunction === 'cmd.script' && !selectedRunnerTemplate?.content.trim()
                ? 'Create a .sh script from Patch before running cmd.script.'
                : '';

  const runFunctionCommand = async () => {
    if (!selectedAsset?.saltMinionId || commandBlockedReason) {
      setExecutionError(commandBlockedReason || 'Choose a connected target before running a Salt function.');
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

      const result = await apiRequest<SaltFunctionExecutionResponse>(`/api/terminal/targets/${encodeURIComponent(selectedAsset.saltMinionId)}/function`, {
        method: 'POST',
        body: JSON.stringify({ client: 'local', function: functionName, arguments: argumentsList }),
      });

      setExecutionResult({
        label: selectedFunction === 'state.apply' || selectedFunction === 'cmd.script'
          ? previewCommand
          : buildFunctionPreview(result.function, result.arguments.join(' ')),
        stdout: result.stdout,
        stderr: result.stderr,
        retcode: result.retcode,
      });
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
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4f9ff_100%)] shadow-sm">
          <div className="space-y-4 p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Salt Terminal</div>
                <h1 className="mt-2 text-[2rem] font-black leading-tight text-slate-950">Department-scoped command runner</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Run Salt commands against the current department scope. Script creation and deletion now live under Patch.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Current scope</div>
                <div className="mt-1">{selectedDepartmentLabel}</div>
                <div className="mt-1 text-xs text-slate-500">{scopedAssets.length} Salt-ready asset{scopedAssets.length === 1 ? '' : 's'} visible</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    <button type="button" onClick={() => { setDepartmentSelectionMode('single'); setSelectedDepartments((current) => current.length > 1 ? [current[0]] : current); }} className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'single' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Single</button>
                    <button type="button" onClick={() => setDepartmentSelectionMode('multiple')} className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'multiple' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Multiple</button>
                  </div>

                  {departmentSelectionMode === 'single' ? (
                    <label className="block">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Department target</div>
                      <select value={selectedDepartments[0] || 'all'} onChange={(event) => setSelectedDepartments(event.target.value === 'all' ? [] : [event.target.value])} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                        <option value="all">All departments</option>
                        {departmentOptions.map((department) => <option key={`salt-department-${department}`} value={department}>{department}</option>)}
                      </select>
                    </label>
                  ) : (
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Department target</div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedDepartments([])} className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${selectedDepartments.length === 0 ? 'border-sky-300 bg-sky-100 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>All</button>
                        {departmentOptions.map((department) => {
                          const active = selectedDepartments.includes(department);
                          return (
                            <button
                              key={`salt-department-chip-${department}`}
                              type="button"
                              onClick={() => setSelectedDepartments((current) => active ? current.filter((entry) => entry !== department) : [...current, department])}
                              className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${active ? 'border-sky-300 bg-sky-100 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            >
                              {department}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Resolved minion</div>
                    <div className="mt-1 text-sm font-black text-slate-950">{selectedAsset?.saltMinionId || 'No Salt-ready asset in scope'}</div>
                    <div className="mt-1 text-xs text-slate-500">{selectedAsset?.hostname || 'Adjust the department selection to resolve a target.'}</div>
                  </div>
                </div>

                <div className="space-y-3">
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
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Execution preview</div>
                      <div className="mt-1.5 font-mono text-sm font-semibold text-slate-950">{previewCommand || 'No command defined yet.'}</div>
                    </div>
                  </div>

                  {selectedFunction === 'state.apply' || selectedFunction === 'cmd.script' ? (
                    <label className="block">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{selectedFunction === 'state.apply' ? 'Saved .sls template' : 'Saved .sh script'}</div>
                        <div className="text-[11px] font-semibold text-slate-500">Manage these from Patch Workspace</div>
                      </div>
                      <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-sky-300 bg-sky-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400">
                        <option value="">{selectedFunction === 'state.apply' ? 'Select an .sls template' : 'Select a .sh script'}</option>
                        {(selectedFunction === 'state.apply' ? savedSlsTemplates : savedShellTemplates).map((template) => (
                          <option key={template.id} value={template.id}>{template.name}{template.stateName ? ` (${template.stateName})` : ''}</option>
                        ))}
                      </select>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedRunnerTemplate?.description || (selectedFunction === 'state.apply' ? 'Create the required .sls state from Patch > Scripts before running it here.' : 'Create the required .sh script from Patch > Scripts before running it here. The saved script body is still checked by the backend terminal policy before execution.')}</div>
                    </label>
                  ) : (
                    <label className="block">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Arguments</div>
                      <input value={functionArgumentsInput} onChange={(event) => setFunctionArgumentsInput(event.target.value)} placeholder="optional space-separated args" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
                    </label>
                  )}

                  {selectedFunctionOption ? <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">{selectedFunctionOption.helper}</div> : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{selectedDepartmentLabel}</span>
                      <span className={`rounded-full border px-2.5 py-1 ${selectedAsset?.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>{selectedAsset?.connected ? 'Connected' : 'Pending'}</span>
                    </div>
                    <button type="button" onClick={() => void runFunctionCommand()} disabled={running || Boolean(commandBlockedReason)} className="inline-flex items-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
                      <Play className="mr-2 h-4 w-4" /> {running ? 'Running...' : 'Execute'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-[#101218] shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
          {selectedAsset?.saltMinionId ? (
            <TerminalConsoleView key={`${selectedAsset.saltMinionId}:${previewCommand}`} minionId={selectedAsset.saltMinionId} embedded prefilledCommand={previewCommand} />
          ) : (
            <div className="min-h-[480px] bg-[#101218]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2">output</span>
                </div>
              </div>
              <div className="px-4 py-5 font-mono text-sm text-emerald-400">Waiting for command...</div>
            </div>
          )}
        </section>

        {loading ? <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading Salt workspace...</div> : null}
        {commandBlockedReason ? <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{commandBlockedReason}</div> : null}
        {executionError ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{executionError}</div> : null}
        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm">{error}</div> : null}

        {executionResult ? (
          <section className="rounded-[26px] border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f6fffb_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Execution summary</div>
                <div className="mt-1 text-lg font-black text-slate-950">{selectedAsset?.hostname || 'Selected asset'} <ArrowRight className="mx-1 inline h-4 w-4 text-slate-400" /> {String(executionResult.retcode) === '0' ? 'Succeeded' : 'Returned errors'}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{executionResult.label}</div>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase text-emerald-700">retcode {String(executionResult.retcode)}</div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-emerald-300"><div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">STDOUT</div><pre className="whitespace-pre-wrap break-words font-mono">{executionResult.stdout || 'No stdout returned.'}</pre></div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-rose-300"><div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-rose-200">STDERR</div><pre className="whitespace-pre-wrap break-words font-mono">{executionResult.stderr || 'No stderr returned.'}</pre></div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}