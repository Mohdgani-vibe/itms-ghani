import { AlertTriangle, BarChart3, Building2, Download, FileSpreadsheet, Laptop, ListChecks, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { downloadAlertsDashboardPdf, downloadAlertsDashboardSystemsCsv, sourceAlertsForSystem } from '../../lib/alertsWorkspace';
import { parseClamAVAlertFacts, renderAlertTitle, renderClamAVMetricSummary } from './AlertsDisplay';
import type { AlertsDashboardDepartmentSummary, AlertsDashboardResponse, AlertsDashboardSystemSummary, AlertsListRecord } from './types';

export type AlertsSourceWorkspaceView = 'dashboard' | 'department' | 'reports';

interface AlertsSourceWorkspacePanelProps {
  source: string;
  sourceLabel: string;
  alerts: AlertsListRecord[];
  dashboard: AlertsDashboardResponse | null;
  loading: boolean;
  error: string;
  activeView: AlertsSourceWorkspaceView;
  selectedDepartment: string;
  selectedSystemKey: string;
  darkMode?: boolean;
  readOnlyReview?: boolean;
  onActiveViewChange: (view: AlertsSourceWorkspaceView) => void;
  onSelectDepartment: (department: string) => void;
  onSelectSystemKey: (systemKey: string) => void;
  onSelectAlert: (alert: AlertsListRecord) => void;
  onOpenSystem?: (system: AlertsDashboardSystemSummary) => void;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
  formatRelativeTime: (value: string) => string;
}

function statusLabel(alert: AlertsListRecord) {
  if (alert.resolved) {
    return 'Resolved';
  }
  if (alert.acknowledged) {
    return 'Acknowledged';
  }
  return 'Open';
}

function statusClassName(alert: AlertsListRecord) {
  if (alert.resolved) {
    return 'bg-sky-100 text-sky-700';
  }
  if (alert.acknowledged) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-rose-100 text-rose-700';
}

function labelsForSource(source: string) {
  if (source === 'clamav') {
    return {
      clean: 'Clean Systems',
      error: 'Infected Systems',
      errorShort: 'Infected',
    };
  }

  return {
    clean: 'Clean Systems',
    error: 'Error Systems',
    errorShort: 'Error',
  };
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 'Unknown time';
  }
  return new Date(parsed).toLocaleString();
}

function systemCardClassName(active: boolean, darkMode: boolean) {
  if (darkMode) {
    return active
      ? 'border-sky-400/30 bg-sky-500/10 text-white'
      : 'border-white/10 bg-slate-950/40 text-slate-100 hover:bg-slate-900/80';
  }
  return active
    ? 'border-sky-200 bg-sky-50/80'
    : 'border-sky-100 bg-white hover:bg-sky-50';
}

function departmentChipClassName(active: boolean, darkMode: boolean) {
  if (darkMode) {
    return active
      ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30'
      : 'bg-slate-950/50 text-slate-200 ring-1 ring-white/10 hover:bg-slate-900';
  }
  return active
    ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'
    : 'bg-white text-sky-700 ring-1 ring-sky-100 hover:bg-sky-50';
}

function workspaceNavClassName(active: boolean, darkMode: boolean) {
  if (darkMode) {
    return active
      ? 'border-sky-400/30 bg-sky-500/10 text-white shadow-sm'
      : 'border-white/10 bg-slate-950/50 text-slate-200 hover:bg-slate-900';
  }
  return active
    ? 'border-sky-200 bg-sky-50 text-sky-900 shadow-sm'
    : 'border-zinc-200 bg-white text-sky-700 hover:bg-sky-50';
}

function sourceWorkspaceTint(source: string) {
  if (source === 'openscap') {
    return {
      aside: 'border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(191,219,254,0.10),_transparent_24%),linear-gradient(180deg,_#f7f9ff_0%,_#fdfefe_100%)]',
      badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100',
      hero: 'border-indigo-100/80 bg-indigo-50/36',
      panel: 'border-indigo-100/80 bg-indigo-50/32',
    };
  }
  if (source === 'clamav') {
    return {
      aside: 'border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(251,113,133,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(254,205,211,0.10),_transparent_24%),linear-gradient(180deg,_#fff8f8_0%,_#fdfefe_100%)]',
      badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
      hero: 'border-rose-100/80 bg-rose-50/36',
      panel: 'border-rose-100/80 bg-rose-50/32',
    };
  }
  return {
    aside: 'border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.10),_transparent_24%),linear-gradient(180deg,_#f7fbff_0%,_#fdfefe_100%)]',
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
    hero: 'border-sky-100/80 bg-sky-50/36',
    panel: 'border-sky-100/80 bg-sky-50/32',
  };
}

function sourceNeutralPanelClass(source: string, darkMode: boolean) {
  if (darkMode) {
    return 'border-white/10 bg-white/5';
  }
  if (source === 'openscap') {
    return 'border-indigo-100/80 bg-white/58';
  }
  if (source === 'clamav') {
    return 'border-rose-100/80 bg-white/58';
  }
  return 'border-sky-100/80 bg-white/58';
}

function sourceSoftPanelClass(source: string, darkMode: boolean) {
  if (darkMode) {
    return 'border-sky-400/20 bg-sky-500/10';
  }
  if (source === 'openscap') {
    return 'border-indigo-100/80 bg-indigo-50/32';
  }
  if (source === 'clamav') {
    return 'border-rose-100/80 bg-rose-50/32';
  }
  return 'border-sky-100/80 bg-sky-50/32';
}

function sourceInteractiveSurfaceClass(source: string, darkMode: boolean) {
  if (darkMode) {
    return 'bg-slate-950/50 hover:bg-slate-900';
  }
  if (source === 'openscap') {
    return 'bg-white/68 hover:bg-indigo-50/40';
  }
  if (source === 'clamav') {
    return 'bg-white/68 hover:bg-rose-50/40';
  }
  return 'bg-white/68 hover:bg-sky-50/40';
}

function sourcePillClass(source: string, darkMode: boolean) {
  if (darkMode) {
    return 'bg-sky-500/15 text-sky-200';
  }
  if (source === 'openscap') {
    return 'bg-indigo-50 text-indigo-700';
  }
  if (source === 'clamav') {
    return 'bg-rose-50 text-rose-700';
  }
  return 'bg-sky-50 text-sky-700';
}

function sourceActionButtonClass(source: string, darkMode: boolean) {
  if (darkMode) {
    return 'border-white/10 bg-slate-950/50 text-sky-200 hover:bg-slate-900';
  }
  if (source === 'openscap') {
    return 'border-indigo-100/80 bg-white/70 text-indigo-700 hover:bg-indigo-50/45';
  }
  if (source === 'clamav') {
    return 'border-rose-100/80 bg-white/70 text-rose-700 hover:bg-rose-50/45';
  }
  return 'border-sky-100/80 bg-white/70 text-sky-700 hover:bg-sky-50/45';
}

export function AlertsSourceWorkspacePanel({
  source,
  sourceLabel,
  alerts,
  dashboard,
  loading,
  error,
  activeView,
  selectedDepartment,
  selectedSystemKey,
  darkMode = false,
  readOnlyReview = false,
  onActiveViewChange,
  onSelectDepartment,
  onSelectSystemKey,
  onSelectAlert,
  onOpenSystem,
  renderSourceIcon,
  formatRelativeTime,
}: AlertsSourceWorkspacePanelProps) {
  const [systemSearch, setSystemSearch] = useState('');
  const [systemStatus, setSystemStatus] = useState<'all' | 'clean' | 'error'>('all');
  const labels = useMemo(() => labelsForSource(source), [source]);
  const tint = useMemo(() => sourceWorkspaceTint(source), [source]);
  const departments = dashboard?.departments ?? [];
  const systems = useMemo(() => {
    const base = dashboard?.systems ?? [];
    return base.filter((system) => {
      if (selectedDepartment && system.department !== selectedDepartment) {
        return false;
      }
      if (systemStatus !== 'all' && system.status !== systemStatus) {
        return false;
      }
      if (systemSearch.trim()) {
        const query = systemSearch.trim().toLowerCase();
        const haystack = [
          system.assetTag,
          system.hostname,
          system.username,
          system.userEmail,
          system.department,
          system.latestTitle,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [dashboard?.systems, selectedDepartment, systemSearch, systemStatus]);

  const selectedSystem = useMemo(
    () => systems.find((entry) => entry.key === selectedSystemKey) ?? systems[0] ?? null,
    [selectedSystemKey, systems],
  );
  const selectedSystemAlerts = useMemo(
    () => (selectedSystem ? sourceAlertsForSystem(alerts, selectedSystem.key) : []),
    [alerts, selectedSystem],
  );
  const selectedModuleCard = useMemo(
    () => dashboard?.moduleCards.find((entry) => entry.source === source) ?? null,
    [dashboard?.moduleCards, source],
  );
  const report = dashboard?.report ?? null;

  const openAlert = (system: AlertsDashboardSystemSummary) => {
    onSelectSystemKey(system.key);
    const latest = alerts.find((alert) => alert.id === system.latestAlertId) ?? sourceAlertsForSystem(alerts, system.key)[0];
    if (latest) {
      onSelectAlert(latest);
    }
  };

  return (
    <section className={`overflow-hidden rounded-[32px] border shadow-[0_28px_68px_rgba(15,23,42,0.14)] backdrop-blur-2xl ${darkMode ? 'border-white/10 bg-slate-950/80 text-white' : 'border-white/65 bg-[linear-gradient(135deg,_rgba(255,255,255,0.70)_0%,_rgba(248,251,255,0.54)_100%)]'}`}>
      <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`border-b p-4 lg:border-b-0 lg:border-r ${darkMode ? 'border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.08),_transparent_24%),linear-gradient(180deg,_#08111f_0%,_#0f172a_100%)]' : tint.aside}`}>
          <div className={`rounded-[24px] border p-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5' : 'border-white/80 bg-white/90'}`}>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20' : tint.badge}`}>
              {renderSourceIcon(source, 'h-3.5 w-3.5')}
              {sourceLabel}
            </div>
            <h2 className={`mt-3 text-xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{sourceLabel} operations</h2>
            <p className={`mt-2 text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
              {readOnlyReview
                ? 'Review the source dashboard, inspect departments and systems, and export CSV evidence for audit checks.'
                : 'Use the source dashboard, inspect departments and systems, and export reports for the selected source.'}
            </p>
          </div>

          <nav className="mt-4 space-y-2">
            {[
              { key: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
              { key: 'department' as const, label: 'Department', icon: Building2 },
              { key: 'reports' as const, label: 'Reports', icon: FileSpreadsheet },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onActiveViewChange(item.key)}
                  className={`flex w-full items-center justify-between rounded-[24px] border px-4 py-3 text-left transition ${workspaceNavClassName(activeView === item.key, darkMode)}`}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-bold">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-400'}`}>{activeView === item.key ? 'Active' : 'Open'}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className={`${darkMode ? 'bg-[linear-gradient(180deg,_#0b1220_0%,_#111827_100%)]' : 'bg-[linear-gradient(180deg,_rgba(255,255,255,0.26)_0%,_rgba(249,251,255,0.44)_100%)]'} p-4 md:p-5`}>
          {loading ? <div className={`rounded-[24px] border p-6 text-sm shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-sky-100 bg-sky-50/70 text-zinc-500'}`}>Loading {sourceLabel} data...</div> : null}

          {!loading && !error && activeView === 'dashboard' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur-xl ${darkMode ? 'border-sky-400/20 bg-sky-500/10' : tint.hero}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Systems Scanned</div>
                  <div className={`mt-2 text-3xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedModuleCard?.totalSystemsScanned ?? 0}</div>
                </div>
                <div className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-white/5' : 'border-white/75 bg-white/58'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Departments</div>
                  <div className={`mt-2 text-3xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{departments.length}</div>
                </div>
                <div className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-white/5' : 'border-white/75 bg-white/58'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{labels.clean}</div>
                  <div className={`mt-2 text-3xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedModuleCard?.cleanSystemsCount ?? 0}</div>
                </div>
                <div className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-white/5' : 'border-white/75 bg-white/58'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{labels.error}</div>
                  <div className={`mt-2 text-3xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedModuleCard?.errorSystemsCount ?? 0}</div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className={`space-y-3 rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${darkMode ? 'border-sky-400/20 bg-sky-500/10' : tint.panel}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-[0.16em] ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>Departments</h3>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Review the latest department coverage and jump into a system list.</p>
                    </div>
                    <Building2 className="h-5 w-5 text-sky-500" />
                  </div>
                  <div className="space-y-2">
                    {departments.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => {
                          onSelectDepartment(entry.name);
                          onActiveViewChange('department');
                        }}
                        className={`flex w-full items-center justify-between rounded-[24px] border px-4 py-3 text-left shadow-sm backdrop-blur-xl transition ${sourceInteractiveSurfaceClass(source, darkMode)} ${darkMode ? 'border-white/10' : 'border-white/75'}`}
                      >
                        <span>
                          <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{entry.name}</span>
                          <span className={`mt-1 block text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Updated {formatRelativeTime(entry.lastUpdated)}</span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${sourcePillClass(source, darkMode)}`}>
                          {entry.totalSystems} systems
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`space-y-3 rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-[0.16em] ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>Latest systems</h3>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Open a system to review the latest alert details.</p>
                    </div>
                    <Laptop className="h-5 w-5 text-sky-500" />
                  </div>
                  <div className="space-y-2">
                    {systems.slice(0, 6).map((system) => (
                      <button
                        key={system.key}
                        type="button"
                        onClick={() => openAlert(system)}
                        className={`flex w-full items-start justify-between rounded-[24px] border px-4 py-3 text-left transition ${systemCardClassName(system.key === selectedSystem?.key, darkMode)}`}
                      >
                        <span>
                          <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{system.hostname || system.assetTag || system.assetId}</span>
                          <span className={`mt-1 block text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{system.department} • {labels.errorShort} {system.errorCount}</span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${sourcePillClass(source, darkMode)}`}>
                          {formatRelativeTime(system.lastScanAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !error && activeView === 'department' ? (
            <div className="space-y-4">
              <div className={`rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h3 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedDepartment || 'All Departments'} systems for {sourceLabel}.</h3>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Review device health, inspect the latest signal, and open the report view.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onActiveViewChange('reports')}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${sourceActionButtonClass(source, darkMode)}`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    View Report
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectDepartment('')}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${departmentChipClassName(!selectedDepartment, darkMode)}`}
                  >
                    All Departments
                  </button>
                  {departments.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => onSelectDepartment(entry.name)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${departmentChipClassName(entry.name === selectedDepartment, darkMode)}`}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className={`space-y-3 rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-slate-400' : 'text-zinc-400'}`} />
                      <input
                        value={systemSearch}
                        onChange={(event) => setSystemSearch(event.target.value)}
                        placeholder="Search systems"
                        className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-slate-950/50 text-white' : sourceSoftPanelClass(source, darkMode)} ${darkMode ? '' : 'text-zinc-900'}`}
                      />
                    </div>
                    <select
                      value={systemStatus}
                      onChange={(event) => setSystemStatus(event.target.value as 'all' | 'clean' | 'error')}
                      className={`rounded-xl border px-3 py-2.5 text-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-slate-950/50 text-white' : sourceNeutralPanelClass(source, darkMode)} ${darkMode ? '' : 'text-zinc-900'}`}
                    >
                      <option value="all">All systems</option>
                      <option value="clean">{labels.clean}</option>
                      <option value="error">{labels.error}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    {systems.map((system) => {
                      const active = system.key === selectedSystem?.key;
                      return (
                        <button
                          key={system.key}
                          type="button"
                          onClick={() => onSelectSystemKey(system.key)}
                          className={`flex w-full items-start justify-between rounded-[24px] border px-4 py-3 text-left transition ${systemCardClassName(active, darkMode)}`}
                        >
                          <span>
                            <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{system.hostname || system.assetTag || system.assetId}</span>
                            <span className={`mt-1 block text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{system.username || system.userEmail || 'Unassigned user'} • {system.department}</span>
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-50 text-sky-700'}`}>
                            {labels.errorShort} {system.errorCount}
                          </span>
                        </button>
                      );
                    })}
                    {systems.length === 0 ? <div className={`rounded-[24px] border px-4 py-6 text-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-400' : sourceSoftPanelClass(source, darkMode)} ${darkMode ? '' : 'text-zinc-500'}`}>No systems match the current filters.</div> : null}
                  </div>
                </div>

                <div className={`space-y-3 rounded-[24px] border p-4 backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                  {selectedSystem ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedSystem.hostname || selectedSystem.assetTag || selectedSystem.assetId}</h4>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{selectedSystem.department} • Last scan {formatTimestamp(selectedSystem.lastScanAt)}</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{selectedSystem.username || selectedSystem.userEmail || 'Unassigned user'}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${sourcePillClass(source, darkMode)}`}>{labels.error} {selectedSystem.errorCount}</span>
                      </div>

                      {onOpenSystem ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenSystem(selectedSystem)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${sourceActionButtonClass(source, darkMode)}`}
                          >
                            Open system details
                          </button>
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className={`rounded-[24px] border px-4 py-4 backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{labels.clean}</div>
                          <div className={`mt-2 text-2xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedSystem.status === 'clean' ? 1 : 0}</div>
                        </div>
                        <div className={`rounded-[24px] border px-4 py-4 backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{labels.error}</div>
                          <div className={`mt-2 text-2xl font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{selectedSystem.errorCount}</div>
                        </div>
                      </div>

                      <div className={`rounded-[24px] border p-4 backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                        <div className={`flex items-center gap-2 text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>
                          <AlertTriangle className="h-4 w-4 text-sky-600" />
                          Latest finding
                        </div>
                        <div className={`mt-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{selectedSystem.latestTitle}</div>
                        <div className={`mt-1 text-sm ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>{selectedSystem.latestDetail}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedSystem.errorDetails.length > 0 ? selectedSystem.errorDetails.map((detail) => (
                            <span key={detail} className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${darkMode ? 'bg-slate-950/60 text-slate-200 ring-1 ring-white/10' : 'bg-white/75 text-zinc-700 ring-1 backdrop-blur-lg'} ${darkMode ? '' : source === 'openscap' ? 'ring-indigo-100' : source === 'clamav' ? 'ring-rose-100' : 'ring-sky-100'}`}>
                              {detail}
                            </span>
                          )) : <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${darkMode ? 'bg-slate-950/60 text-slate-200 ring-1 ring-white/10' : 'bg-white/75 text-zinc-700 ring-1 backdrop-blur-lg'} ${darkMode ? '' : source === 'openscap' ? 'ring-indigo-100' : source === 'clamav' ? 'ring-rose-100' : 'ring-sky-100'}`}>No active errors</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {selectedSystemAlerts.map((alert) => {
                          const clamavFacts = parseClamAVAlertFacts(alert);
                          return (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => onSelectAlert(alert)}
                              className={`w-full rounded-[24px] border px-4 py-3 text-left shadow-sm backdrop-blur-xl transition ${darkMode ? 'border-white/10 bg-slate-950/50 hover:bg-slate-900' : sourceInteractiveSurfaceClass(source, darkMode)} ${darkMode ? '' : 'border-white/75'}`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${statusClassName(alert)}`}>
                                  {statusLabel(alert)}
                                </span>
                                <span className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{formatRelativeTime(alert.createdAt)}</span>
                              </div>
                              <div className={`mt-2 text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{renderAlertTitle(alert)}</div>
                              <div className={`mt-1 text-sm ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>{clamavFacts?.detail || renderClamAVMetricSummary(alert) || alert.detail}</div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className={`rounded-[24px] border px-4 py-6 text-sm shadow-sm backdrop-blur-xl ${darkMode ? 'border-white/10 bg-slate-950/50 text-slate-400' : sourceSoftPanelClass(source, darkMode)} ${darkMode ? '' : 'text-zinc-500'}`}>Select a system to review its latest alerts.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !error && activeView === 'reports' ? (
            <div className="space-y-4">
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                <div>
                  <h3 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{sourceLabel} reports</h3>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Generated {report ? formatTimestamp(report.generatedAt) : 'when report data is available'}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => report ? downloadAlertsDashboardPdf(sourceLabel, report) : undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${sourceActionButtonClass(source, darkMode)}`}
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadAlertsDashboardSystemsCsv(sourceLabel, report?.systemStatuses ?? [], selectedDepartment || 'all-systems')}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${sourceActionButtonClass(source, darkMode)}`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className={`rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                  <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
                    <Building2 className="h-4 w-4 text-sky-600" />
                    Department Summary
                  </div>
                  <div className="mt-4 space-y-2">
                    {(report?.departmentSummary ?? []).map((department: AlertsDashboardDepartmentSummary) => (
                      <div key={department.key} className={`flex items-center justify-between rounded-[24px] border px-4 py-3 backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                        <span>
                          <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{department.name}</span>
                          <span className={`mt-1 block text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{department.totalSystems} systems</span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm ${darkMode ? 'bg-slate-950/60 text-sky-200 ring-1 ring-white/10' : 'bg-white/75 ring-1 backdrop-blur-lg'} ${darkMode ? '' : source === 'openscap' ? 'text-indigo-700 ring-indigo-100' : source === 'clamav' ? 'text-rose-700 ring-rose-100' : 'text-sky-700 ring-sky-100'}`}>
                          {labels.error} {department.errorCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                  <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
                    <ListChecks className="h-4 w-4 text-sky-600" />
                    System Summary
                  </div>
                  <div className="mt-4 space-y-2">
                    {(report?.systemStatuses ?? []).map((system: AlertsDashboardSystemSummary) => (
                      <div key={system.key} className={`flex items-center justify-between rounded-[24px] border px-4 py-3 backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                        <span>
                          <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{system.hostname || system.assetTag || system.assetId}</span>
                          <span className={`mt-1 block text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{system.department}</span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm ${darkMode ? 'bg-slate-950/60 text-sky-200 ring-1 ring-white/10' : 'bg-white/75 ring-1 backdrop-blur-lg'} ${darkMode ? '' : source === 'openscap' ? 'text-indigo-700 ring-indigo-100' : source === 'clamav' ? 'text-rose-700 ring-rose-100' : 'text-sky-700 ring-sky-100'}`}>
                          {labels.error} {system.errorCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${sourceNeutralPanelClass(source, darkMode)}`}>
                <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
                  <AlertTriangle className="h-4 w-4 text-sky-600" />
                  Error Details
                </div>
                <div className="mt-4 space-y-2">
                  {(report?.errorDetails ?? []).length === 0 ? (
                    <div className={`rounded-[24px] border px-4 py-4 text-sm shadow-sm backdrop-blur-xl ${darkMode ? 'border-sky-400/20 bg-sky-500/10 text-slate-300' : sourceSoftPanelClass(source, darkMode)} ${darkMode ? '' : 'text-zinc-500'}`}>No active error details available for this report scope.</div>
                  ) : (
                    (report?.errorDetails ?? []).map((detail) => (
                      <div key={detail.id} className={`rounded-[24px] border px-4 py-3 backdrop-blur-xl ${sourceSoftPanelClass(source, darkMode)}`}>
                        <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{detail.title}</div>
                        <div className={`mt-1 text-sm ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>{detail.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
