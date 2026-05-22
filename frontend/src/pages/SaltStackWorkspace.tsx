import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Command, Cpu, History, Layers3, Play, RefreshCw, Search, ServerCrash, ShieldCheck, TerminalSquare, Waves } from 'lucide-react';

import EmbeddedConsoleModal, { buildEmbeddedSaltConsoleState, type EmbeddedConsoleState } from '../components/EmbeddedConsoleModal';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';

type WorkspaceTab = 'assets' | 'execution' | 'history';

interface SaltWorkspaceAsset {
  id: string;
  assetId: string;
  assetTag: string;
  assetName?: string | null;
  hostname: string;
  deviceType?: string | null;
  osName?: string | null;
  lastSeenAt?: string | null;
  status: string;
  cost?: string | null;
  saltMinionId?: string | null;
  ownerName?: string | null;
  departmentName?: string | null;
  locationName?: string | null;
  pendingAlerts: number;
  patchStatus: string;
  alertStatus: string;
  connected: boolean;
  riskScore: number;
}

interface SaltWorkspaceExecutionRecord {
  id: string;
  jid: string;
  scope: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface SaltWorkspaceHistoryRecord {
  id: string;
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount: number;
  failedCount: number;
  rowCount: number;
  requestedBy?: string | null;
}

interface SaltWorkspacePreset {
  id: string;
  label: string;
  command: string;
  category: string;
  description: string;
}

interface SaltWorkspaceResponse {
  generatedAt: string;
  summary: {
    totalAssets: number;
    linkedTargets: number;
    connectedTargets: number;
    alertBacklog: number;
    pendingActions: number;
    averageRiskScore: number;
  };
  assets: SaltWorkspaceAsset[];
  recentExecutions: SaltWorkspaceExecutionRecord[];
  jobHistory: SaltWorkspaceHistoryRecord[];
  presets: SaltWorkspacePreset[];
  executionPolicy: {
    allowedCommands: string[];
    presetCommands: string[];
    restrictions: string[];
  };
  integrations: {
    saltApiConfigured: boolean;
  };
}

interface TerminalExecutionResponse {
  command: string;
  stdout: string;
  stderr: string;
  retcode: number | string;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'No timestamp';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatCurrency(value?: string | null) {
  if (!value) {
    return 'Cost not tracked';
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(parsed);
}

function normalizeCommandMode(command: string) {
  return command.trim().startsWith('state.apply') || command.trim().startsWith('state ') ? 'State Run' : 'Diagnostic Command';
}

function normalizePatchStatusLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function riskTone(score: number) {
  if (score >= 75) {
    return 'text-rose-700 bg-rose-50 border-rose-200';
  }
  if (score >= 45) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export default function SaltStackWorkspace() {
	const session = getStoredSession();
	const role = (session?.user.role || '').toLowerCase();
	const canOperate = role === 'super_admin' || role === 'it_team';
	const [workspace, setWorkspace] = useState<SaltWorkspaceResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [activeTab, setActiveTab] = useState<WorkspaceTab>('assets');
	const [assetQuery, setAssetQuery] = useState('');
	const deferredAssetQuery = useDeferredValue(assetQuery);
	const [selectedAssetId, setSelectedAssetId] = useState('');
	const [selectedPresetId, setSelectedPresetId] = useState('');
	const [commandDraft, setCommandDraft] = useState('state.apply patch.run');
	const [running, setRunning] = useState(false);
	const [executionError, setExecutionError] = useState('');
	const [executionResult, setExecutionResult] = useState<TerminalExecutionResponse | null>(null);
	const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);

	const refreshWorkspace = async () => {
		try {
			setLoading(true);
			setError('');
			const data = await apiRequest<SaltWorkspaceResponse>('/api/salt/workspace');
			setWorkspace(data);
			setSelectedAssetId((current) => current || data.assets[0]?.id || '');
			if (!selectedPresetId && data.presets[0]) {
				setSelectedPresetId(data.presets[0].id);
			}
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
		if (!workspace) {
			return;
		}
		if (workspace.assets.some((asset) => asset.id === selectedAssetId)) {
			return;
		}
		setSelectedAssetId(workspace.assets[0]?.id || '');
	}, [selectedAssetId, workspace]);

	const filteredAssets = useMemo(() => {
		if (!workspace) {
			return [];
		}
		const query = deferredAssetQuery.trim().toLowerCase();
		if (!query) {
			return workspace.assets;
		}
		return workspace.assets.filter((asset) => [
			asset.hostname,
			asset.assetTag,
			asset.assetName,
			asset.osName,
			asset.departmentName,
			asset.locationName,
			asset.ownerName,
		].join(' ').toLowerCase().includes(query));
	}, [deferredAssetQuery, workspace]);

	const selectedAsset = useMemo(
		() => filteredAssets.find((asset) => asset.id === selectedAssetId) || workspace?.assets.find((asset) => asset.id === selectedAssetId) || null,
		[filteredAssets, selectedAssetId, workspace],
	);

	const selectedPreset = useMemo(
		() => workspace?.presets.find((preset) => preset.id === selectedPresetId) || null,
		[selectedPresetId, workspace],
	);

	const previewCommand = commandDraft.trim() || selectedPreset?.command || '';
	const previewModeLabel = normalizeCommandMode(previewCommand);
	const commandBlockedReason = !selectedAsset
		? 'Choose an asset before building a command.'
		: !selectedAsset.saltMinionId
			? 'This asset has no linked Salt minion ID yet.'
			: !canOperate
				? 'Auditor access is read-only. You can review assets, policy, and history, but command execution is disabled.'
				: !workspace?.integrations.saltApiConfigured
					? 'The server Salt API is not configured.'
					: !selectedAsset.connected
						? 'The selected minion is not currently connected to the master.'
						: '';

	const openConsole = () => {
		if (!selectedAsset || !selectedAsset.saltMinionId || !canOperate) {
			return;
		}
		setEmbeddedConsole(buildEmbeddedSaltConsoleState({
			title: 'Salt Center Console',
			systemLabel: selectedAsset.hostname,
			assetId: selectedAsset.id,
			minionId: selectedAsset.saltMinionId,
			departmentName: selectedAsset.departmentName,
			prefillCommand: previewCommand,
		}));
	};

	const runCommand = async () => {
		if (!selectedAsset?.saltMinionId || !previewCommand.trim() || commandBlockedReason) {
			setExecutionError(commandBlockedReason || 'Build a valid command before running it.');
			return;
		}
		try {
			setRunning(true);
			setExecutionError('');
			const result = await apiRequest<TerminalExecutionResponse>(`/api/terminal/targets/${encodeURIComponent(selectedAsset.saltMinionId)}/execute`, {
				method: 'POST',
				body: JSON.stringify({ command: previewCommand }),
			});
			setExecutionResult(result);
			setActiveTab('execution');
			await refreshWorkspace();
		} catch (requestError) {
			setExecutionError(requestError instanceof Error ? requestError.message : 'Failed to run Salt command');
		} finally {
			setRunning(false);
		}
	};

	const summaryCards = [
		{ label: 'Managed Assets', value: workspace?.summary.totalAssets || 0, helper: 'Compute endpoints visible in the current scope', icon: Cpu },
		{ label: 'Connected Minions', value: workspace?.summary.connectedTargets || 0, helper: 'Targets currently answering the master', icon: Activity },
		{ label: 'Alert Backlog', value: workspace?.summary.alertBacklog || 0, helper: 'Open alert signals linked to managed assets', icon: ServerCrash },
		{ label: 'Average Risk', value: workspace?.summary.averageRiskScore || 0, helper: 'Weighted from alerts, pending updates, and target health', icon: ShieldCheck },
	];

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.55),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(191,219,254,0.62),_transparent_28%),linear-gradient(180deg,_#f7fbff_0%,_#eef6ff_42%,_#f8fbff_100%)] px-4 py-6 text-slate-950 xl:px-6">
			<div className="mx-auto max-w-[1600px] space-y-6 pb-10">
				<section className="overflow-hidden rounded-[32px] border border-sky-100 bg-white/90 shadow-[0_28px_90px_rgba(14,165,233,0.10)] backdrop-blur-sm">
					<div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:px-8">
						<div>
							<div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">SaltStack Control Plane</div>
							<h1 className="mt-4 max-w-3xl font-black tracking-tight text-slate-950 text-3xl sm:text-4xl">Interactive execution workspace for asset selection, command preview, and post-run history.</h1>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">This workspace keeps the asset manager, execution engine, and job history in one operator surface. The backend is running through the Go Salt APIs already exposed by the platform, while this page adds a purpose-built control room on top.</p>
							<div className="mt-5 flex flex-wrap gap-3">
								<button type="button" onClick={() => setActiveTab('execution')} className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-sky-700">
									<Play className="mr-2 h-4 w-4" /> Open Execution Engine
								</button>
								<button type="button" onClick={() => void refreshWorkspace()} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
									<RefreshCw className="mr-2 h-4 w-4" /> Refresh Workspace
								</button>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							{summaryCards.map((card) => {
								const Icon = card.icon;
								return (
									<div key={card.label} className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4faff_100%)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(14,165,233,0.12)]">
										<div className="flex items-center justify-between gap-3">
											<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
											<Icon className="h-4 w-4 text-sky-500" />
										</div>
										<div className="mt-4 text-3xl font-black text-slate-950">{card.value}</div>
										<div className="mt-2 text-xs leading-5 text-slate-500">{card.helper}</div>
									</div>
								);
							})}
						</div>
					</div>
				</section>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
						{[
							{ key: 'assets' as const, label: 'Asset Manager', icon: Layers3 },
							{ key: 'execution' as const, label: 'Execution Engine', icon: Command },
							{ key: 'history' as const, label: 'Job History', icon: History },
						].map((tab) => {
							const Icon = tab.icon;
							const active = activeTab === tab.key;
							return (
								<button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-black transition ${active ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
									<Icon className="mr-2 h-4 w-4" /> {tab.label}
								</button>
							);
						})}
					</div>
					<div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
						<Waves className="h-4 w-4 text-sky-500" />
						<div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Generated {formatDateTime(workspace?.generatedAt)}</div>
					</div>
				</div>

				{error ? <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">{error}</div> : null}

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
					<section className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
						{activeTab === 'assets' ? (
							<>
								<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
									<div>
										<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Asset Manager</div>
										<h2 className="mt-2 text-2xl font-black text-slate-950">Selectable endpoint cards with posture, ownership, and Salt readiness.</h2>
									</div>
									<label className="relative block md:w-80">
										<Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
										<input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Search by host, asset, OS, owner, or department" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white" />
									</label>
								</div>
								<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100" />) : null}
									{!loading && filteredAssets.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500 md:col-span-2 xl:col-span-3">No assets matched the current search. Clear the filter or refresh the workspace.</div> : null}
									{filteredAssets.map((asset) => {
										const selected = asset.id === selectedAsset?.id;
										return (
											<button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} className={`group rounded-[24px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(15,23,42,0.10)] ${selected ? 'border-sky-300 bg-[linear-gradient(180deg,_#eff8ff_0%,_#ffffff_100%)] ring-2 ring-sky-100' : 'border-slate-200 bg-white hover:border-sky-200'}`}>
												<div className="flex items-start justify-between gap-3">
													<div>
														<div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{asset.assetTag}</div>
														<div className="mt-2 text-lg font-black text-slate-950">{asset.hostname}</div>
														<div className="mt-1 text-sm text-slate-500">{asset.assetName || asset.osName || 'Managed endpoint'}</div>
													</div>
													<div className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${riskTone(asset.riskScore)}`}>Risk {asset.riskScore}</div>
												</div>
												<div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
													<div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="font-black text-slate-900">{asset.departmentName || 'Unassigned'}</div><div className="mt-1 uppercase tracking-[0.14em]">Department</div></div>
													<div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="font-black text-slate-900">{asset.locationName || 'Unknown'}</div><div className="mt-1 uppercase tracking-[0.14em]">Location</div></div>
													<div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="font-black text-slate-900">{normalizePatchStatusLabel(asset.patchStatus)}</div><div className="mt-1 uppercase tracking-[0.14em]">Patch posture</div></div>
													<div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="font-black text-slate-900">{asset.connected ? 'Connected' : asset.saltMinionId ? 'Linked' : 'Pending'}</div><div className="mt-1 uppercase tracking-[0.14em]">Salt status</div></div>
												</div>
												<div className="mt-4 flex items-center justify-between text-xs text-slate-500">
													<div>{asset.pendingAlerts} alert{asset.pendingAlerts === 1 ? '' : 's'} open</div>
													<div>{formatDateTime(asset.lastSeenAt)}</div>
												</div>
											</button>
										);
									})}
								</div>
							</>
						) : null}

						{activeTab === 'execution' ? (
							<>
								<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
									<div>
										<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Execution Engine</div>
										<h2 className="mt-2 text-2xl font-black text-slate-950">Build the command, inspect the live preview, then run it against the selected asset.</h2>
									</div>
									<div className="flex flex-wrap gap-2">
										<button type="button" onClick={openConsole} disabled={!canOperate || !selectedAsset?.saltMinionId} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
											<TerminalSquare className="mr-2 h-4 w-4" /> Open Console
										</button>
										<button type="button" onClick={() => void runCommand()} disabled={running || Boolean(commandBlockedReason)} className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">
											<Play className="mr-2 h-4 w-4" /> {running ? 'Running...' : 'Run Command'}
										</button>
									</div>
								</div>

								<div className="mt-5 space-y-4">
									<div>
										<div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Preset library</div>
										<div className="mt-3 flex flex-wrap gap-2">
											{workspace?.presets.map((preset) => (
												<button key={preset.id} type="button" onClick={() => { setSelectedPresetId(preset.id); setCommandDraft(preset.command); }} className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${selectedPresetId === preset.id ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'}`}>
													{preset.label}
												</button>
											))}
										</div>
										{selectedPreset ? <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">{selectedPreset.description}</div> : null}
									</div>

									<div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
										<div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
											<div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Selected asset</div>
											<div className="mt-3 text-xl font-black text-slate-950">{selectedAsset?.hostname || 'No asset selected'}</div>
											<div className="mt-1 text-sm text-slate-500">{selectedAsset?.departmentName || 'Choose an asset from the manager to continue.'}</div>
											<div className="mt-4 grid gap-3 sm:grid-cols-2">
												<div className="rounded-2xl border border-white/80 bg-white px-3 py-3 text-sm text-slate-600"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Target</div><div className="mt-2 font-bold text-slate-950">{selectedAsset?.saltMinionId || 'Not linked'}</div></div>
												<div className="rounded-2xl border border-white/80 bg-white px-3 py-3 text-sm text-slate-600"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Estimated cost</div><div className="mt-2 font-bold text-slate-950">{formatCurrency(selectedAsset?.cost)}</div></div>
											</div>
										</div>

										<div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
											<div className="flex items-center justify-between gap-3">
												<div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Live command preview</div>
												<div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">{previewModeLabel}</div>
											</div>
											<textarea value={commandDraft} onChange={(event) => setCommandDraft(event.target.value)} rows={5} className="mt-3 w-full rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-sm text-emerald-300 outline-none transition focus:border-sky-300" />
											<div className="mt-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
												<div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Preview output envelope</div>
												<div className="mt-3 font-mono text-sm text-slate-800">{previewCommand || 'No command defined yet.'}</div>
											</div>
										</div>
									</div>

									{commandBlockedReason ? <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{commandBlockedReason}</div> : null}
									{executionError ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{executionError}</div> : null}
									{executionResult ? (
										<div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f6fffb_100%)] p-4 shadow-sm">
											<div className="flex items-center justify-between gap-3">
												<div>
													<div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Execution summary</div>
													<div className="mt-1 text-lg font-black text-slate-950">{selectedAsset?.hostname || 'Selected asset'} <ArrowRight className="mx-1 inline h-4 w-4 text-slate-400" /> {String(executionResult.retcode) === '0' ? 'Succeeded' : 'Returned errors'}</div>
												</div>
												<div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase text-emerald-700">retcode {String(executionResult.retcode)}</div>
											</div>
											<div className="mt-4 grid gap-4 lg:grid-cols-2">
												<div className="rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-emerald-300"><div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">STDOUT</div><pre className="whitespace-pre-wrap break-words font-mono">{executionResult.stdout || 'No stdout returned.'}</pre></div>
												<div className="rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-rose-300"><div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-rose-200">STDERR</div><pre className="whitespace-pre-wrap break-words font-mono">{executionResult.stderr || 'No stderr returned.'}</pre></div>
											</div>
										</div>
									) : null}
								</div>
							</>
						) : null}

						{activeTab === 'history' ? (
							<>
								<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Job History</div>
								<h2 className="mt-2 text-2xl font-black text-slate-950">Recent execution timeline and Salt rollouts recorded by the backend.</h2>
								<div className="mt-5 space-y-4">
									{workspace?.jobHistory.length ? workspace.jobHistory.map((entry) => (
										<div key={entry.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
											<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
												<div>
													<div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{entry.scopeLabel}</div>
													<div className="mt-2 text-lg font-black text-slate-950">{entry.successCount} succeeded, {entry.failedCount} failed across {entry.rowCount} endpoints</div>
													<div className="mt-1 text-sm text-slate-500">Requested {formatDateTime(entry.requestedAt)} • Completed {formatDateTime(entry.completedAt)}</div>
												</div>
												<div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{entry.requestedBy || 'IT automation'}</div>
											</div>
										</div>
									)) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No Salt job history is available yet for the current scope.</div>}
								</div>
							</>
						) : null}
					</section>

					<aside className="space-y-4">
						<section className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
							<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Execution Policy</div>
							<h3 className="mt-2 text-xl font-black text-slate-950">Allowed commands and operator guardrails</h3>
							<div className="mt-4 flex flex-wrap gap-2">
								{workspace?.executionPolicy.allowedCommands.slice(0, 12).map((command) => <span key={command} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">{command}</span>)}
							</div>
							<div className="mt-4 space-y-2 text-sm text-slate-600">
								{workspace?.executionPolicy.restrictions.map((restriction) => <div key={restriction} className="rounded-2xl bg-slate-50 px-3 py-3">{restriction}</div>)}
							</div>
						</section>

						<section className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-sm">
							<div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Recent Executions</div>
							<h3 className="mt-2 text-xl font-black text-slate-950">Latest execution requests observed by the backend</h3>
							<div className="mt-4 space-y-3">
								{workspace?.recentExecutions.length ? workspace.recentExecutions.map((entry) => (
									<div key={entry.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
										<div className="flex items-center justify-between gap-3">
											<div className="font-black text-slate-950">{entry.scope}</div>
											<div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">{entry.status}</div>
										</div>
										<div className="mt-2 text-xs text-slate-500">Created {formatDateTime(entry.createdAt)}</div>
									</div>
								)) : <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No recent executions have been recorded yet.</div>}
							</div>
						</section>
					</aside>
				</div>
			</div>
			<EmbeddedConsoleModal consoleState={embeddedConsole} titleId="salt-workspace-console-title" onClose={() => setEmbeddedConsole(null)} />
		</div>
	);
}