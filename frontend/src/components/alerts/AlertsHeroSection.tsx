import type { ReactNode } from 'react';
import { Bell, Clock3, MoonStar, Search, ShieldAlert, SunMedium, Wifi } from 'lucide-react';

import type { AlertsDashboardModuleCard } from './types';

interface AlertsHeroSectionProps {
  feedLabel: string;
  totalAlerts: number;
  openCount: number;
  criticalCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  systemsAffectedCount: number;
  sourceCountMap: Map<string, number>;
  moduleCards?: AlertsDashboardModuleCard[];
  sourceFilter: string;
  sourceOptions: Array<{ value: string; label: string }>;
  severityFilter: string;
  departmentFilter: string;
  departmentOptions: string[];
  timeRangeFilter: string;
  searchQuery: string;
  lastUpdatedLabel: string;
  liveStatusLabel: string;
  notificationCount: number;
  darkMode: boolean;
  readOnlyReview?: boolean;
  onSelectSourceFilter: (value: string) => void;
  onSelectSeverityFilter: (value: string) => void;
  onSelectDepartmentFilter: (value: string) => void;
  onSelectTimeRangeFilter: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onToggleDarkMode: () => void;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
}

function moduleCardChrome(statusColor: AlertsDashboardModuleCard['statusColor']) {
  if (statusColor === 'red') {
    return 'border-rose-200 bg-rose-50/90';
  }
  if (statusColor === 'yellow') {
    return 'border-amber-200 bg-amber-50/90';
  }
  return 'border-emerald-200 bg-emerald-50/90';
}

function moduleCardDot(statusColor: AlertsDashboardModuleCard['statusColor']) {
  if (statusColor === 'red') {
    return 'bg-rose-500';
  }
  if (statusColor === 'yellow') {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

function moduleCardMetricLabels(source: AlertsDashboardModuleCard['source']) {
  if (source === 'clamav') {
    return {
      scanned: 'Systems Scanned',
      clean: 'Clean Systems',
      error: 'Infected Systems',
    };
  }

  return {
    scanned: 'Systems Scanned',
    clean: 'Clean Systems',
    error: 'Error Systems',
  };
}

export function AlertsHeroSection({
  feedLabel,
  totalAlerts,
  openCount,
  criticalCount,
  acknowledgedCount,
  resolvedCount,
  systemsAffectedCount,
  sourceCountMap,
  moduleCards = [],
  sourceFilter,
  sourceOptions = [],
  severityFilter = 'all',
  departmentFilter = 'all',
  departmentOptions = [],
  timeRangeFilter = '24h',
  searchQuery = '',
  lastUpdatedLabel = 'Unknown time',
  liveStatusLabel = 'Telemetry unavailable',
  notificationCount = 0,
  darkMode = false,
  readOnlyReview = false,
  onSelectSourceFilter,
  onSelectSeverityFilter = () => {},
  onSelectDepartmentFilter = () => {},
  onSelectTimeRangeFilter = () => {},
  onSearchQueryChange = () => {},
  onToggleDarkMode = () => {},
  renderSourceIcon,
}: AlertsHeroSectionProps) {
  const metricCards = [
    { label: 'Total Alerts', value: totalAlerts, tone: 'text-zinc-950' },
    { label: 'Open Alerts', value: openCount, tone: 'text-sky-700' },
    { label: 'Critical Alerts', value: criticalCount, tone: 'text-rose-700' },
    { label: 'Acknowledged', value: acknowledgedCount, tone: 'text-amber-700' },
    { label: 'Resolved', value: resolvedCount, tone: 'text-emerald-700' },
    { label: 'Systems Affected', value: systemsAffectedCount, tone: 'text-zinc-950' },
  ];

  return (
    <section className={`overflow-hidden rounded-[28px] border shadow-sm ${darkMode ? 'border-slate-800 bg-[linear-gradient(135deg,_#08111f_0%,_#111827_52%,_#1f2937_100%)] text-white' : 'border-zinc-200 bg-white'}`}>
      <div className={`${darkMode ? 'bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(248,113,113,0.12),_transparent_24%),linear-gradient(135deg,_#08111f_0%,_#111827_52%,_#1f2937_100%)]' : 'bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,_#fafaf9_0%,_#ffffff_52%,_#eefbf3_100%)]'} px-5 py-5 lg:px-6 lg:py-6`}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${darkMode ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                {feedLabel}
              </div>
              <h1 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Security Operations Center</h1>
              <p className={`mt-2 text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
                {readOnlyReview
                  ? 'Review endpoint, hardening, malware, patching, and file-watch telemetry in one audit-ready SOC command workspace.'
                  : 'Monitor enterprise detections, run threat hunts, and pivot into endpoint response from a single SOC command surface.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-white/90 bg-white/90 text-zinc-900'}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Live status</div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Wifi className="h-4 w-4 text-emerald-400" />
                  {liveStatusLabel}
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-white/90 bg-white/90 text-zinc-900'}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Last updated</div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Clock3 className="h-4 w-4 text-sky-500" />
                  {lastUpdatedLabel}
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-white/90 bg-white/90 text-zinc-900'}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Notification center</div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Bell className="h-4 w-4 text-amber-500" />
                  {notificationCount} analyst notifications
                </div>
              </div>
              <button type="button" onClick={onToggleDarkMode} className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition ${darkMode ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-white/90 bg-white/90 text-zinc-900 hover:bg-zinc-50'}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Theme</div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  {darkMode ? <SunMedium className="h-4 w-4 text-amber-400" /> : <MoonStar className="h-4 w-4 text-indigo-500" />}
                  {darkMode ? 'Dark mode enabled' : 'Light mode enabled'}
                </div>
              </button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-white/90'}`}>
              <div className="relative min-w-0">
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-slate-400' : 'text-zinc-400'}`} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="Search alerts, systems, departments, rules"
                  className={`w-full rounded-2xl border py-3 pl-10 pr-4 text-sm shadow-sm outline-none ${darkMode ? 'border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500' : 'border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400'}`}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <select value={severityFilter} onChange={(event) => onSelectSeverityFilter(event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
                  {['all', 'critical', 'high', 'medium', 'low'].map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All severities' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
                <select value={sourceFilter} onChange={(event) => onSelectSourceFilter(event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
                  <option value="all">All sources</option>
                  {sourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select value={departmentFilter} onChange={(event) => onSelectDepartmentFilter(event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
                  <option value="all">All departments</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select value={timeRangeFilter} onChange={(event) => onSelectTimeRangeFilter(event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {metricCards.map((metric) => (
                <div key={metric.label} className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-white/5' : 'border-white/90 bg-white/90'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metric.label}</div>
                  <div className={`mt-2 text-3xl font-black ${darkMode ? 'text-white' : metric.tone}`}>{metric.value}</div>
                  <div className={`mt-1 text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Live SOC metric</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 pt-1 md:grid-cols-3 xl:grid-cols-3">
            {moduleCards.map((entry) => {
              const metricLabels = moduleCardMetricLabels(entry.source);

              return (
                <button
                  key={entry.source}
                  type="button"
                  onClick={() => onSelectSourceFilter(entry.source)}
                  className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition ${sourceFilter === entry.source ? (darkMode ? 'border-sky-400/30 bg-sky-500/10 text-white' : 'border-sky-300 bg-sky-50 text-sky-800') : `${darkMode ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : `${moduleCardChrome(entry.statusColor)} text-zinc-700 hover:bg-white`}`}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
                      {renderSourceIcon(entry.source, 'h-3.5 w-3.5')}
                      <span className="truncate">{entry.label}</span>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${moduleCardDot(entry.statusColor)}`} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.scanned}</div>
                      <div className={`mt-1 text-lg font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{entry.totalSystemsScanned}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.clean}</div>
                      <div className="mt-1 text-lg font-black text-emerald-500">{entry.cleanSystemsCount}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.error}</div>
                      <div className="mt-1 text-lg font-black text-rose-500">{entry.errorSystemsCount}</div>
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center justify-between gap-3 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
                    <span>Queue {sourceCountMap.get(entry.source) || 0}</span>
                    <span>{entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : 'No scans yet'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}