import type { ReactNode } from 'react';
import { Clock3, MoonStar, Search, ShieldAlert, SunMedium, Wifi } from 'lucide-react';

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
  return 'border-blue-200 bg-blue-50/90';
}

function moduleCardDot(statusColor: AlertsDashboardModuleCard['statusColor']) {
  if (statusColor === 'red') {
    return 'bg-rose-500';
  }
  if (statusColor === 'yellow') {
    return 'bg-amber-500';
  }
  return 'bg-blue-500';
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

function timeRangeLabel(value: string) {
  if (value === '24h') {
    return 'Last 24 hours';
  }
  if (value === '7d') {
    return 'Last 7 days';
  }
  if (value === '30d') {
    return 'Last 30 days';
  }
  return 'All time';
}

function sourceChipClassName(active: boolean, darkMode: boolean) {
  if (active) {
    return darkMode
      ? 'border-blue-400/40 bg-blue-500/15 text-blue-100'
      : 'border-blue-300 bg-blue-100 text-blue-800';
  }
  return darkMode
    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
    : 'border-zinc-200 bg-white/90 text-zinc-700 hover:border-blue-200 hover:bg-blue-50';
}

export function AlertsHeroSection({
  feedLabel,
  totalAlerts,
  openCount,
  criticalCount,
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
  liveStatusLabel = 'Telemetry unavailable',
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
    { label: 'Open Alerts', value: openCount, tone: 'text-blue-700' },
    { label: 'Critical Alerts', value: criticalCount, tone: 'text-rose-700' },
    { label: 'Systems Affected', value: systemsAffectedCount, tone: 'text-zinc-950' },
  ];
  const filterSummary = [
    sourceFilter === 'all' ? 'All sources' : sourceOptions.find((option) => option.value === sourceFilter)?.label || sourceFilter,
    severityFilter === 'all' ? 'All severities' : `${severityFilter.charAt(0).toUpperCase()}${severityFilter.slice(1)} severity`,
    departmentFilter === 'all' ? 'All departments' : departmentFilter,
    timeRangeLabel(timeRangeFilter),
  ];

  return (
    <section className={`overflow-hidden rounded-[28px] border shadow-[0_18px_44px_rgba(15,23,42,0.10)] ${darkMode ? 'border-slate-800 bg-[linear-gradient(140deg,_#07101d_0%,_#101828_48%,_#172033_100%)] text-white' : 'border-zinc-200 bg-white'}`}>
      <div className={`${darkMode ? 'bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_22%),radial-gradient(circle_at_85%_18%,_rgba(37,99,235,0.22),_transparent_25%),linear-gradient(140deg,_#07101d_0%,_#101828_48%,_#172033_100%)]' : 'bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_24%),radial-gradient(circle_at_88%_16%,_rgba(37,99,235,0.14),_transparent_26%),linear-gradient(145deg,_#ffffff_0%,_#f4f8ff_52%,_#ebf2ff_100%)]'} px-4 py-4 lg:px-5 lg:py-5`}>
        <div className="flex flex-col gap-4">
          <div className={`overflow-hidden rounded-[26px] border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-black/15' : 'border-blue-100 bg-white/85'}`}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${darkMode ? 'border-blue-400/20 bg-blue-400/10 text-blue-200' : 'border-blue-300 bg-blue-100 text-blue-700'}`}>
                    <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                    {feedLabel}
                  </div>
                  <h1 className={`mt-2 text-[1.7rem] font-black tracking-tight sm:text-[1.95rem] ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Security Operations Center</h1>
                  <p className={`mt-2 max-w-2xl text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>
                    {readOnlyReview
                      ? 'Review endpoint, malware, and hardening telemetry from one audit-ready workspace.'
                      : 'Monitor detections and move into response from one focused SOC workspace.'}
                  </p>
                </div>

                <button type="button" onClick={onToggleDarkMode} className={`rounded-[18px] border px-3.5 py-2.5 text-left shadow-sm transition ${darkMode ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-blue-100 bg-white/95 text-zinc-900 hover:border-blue-200 hover:bg-blue-50'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Theme</div>
                  <div className="mt-1.5 inline-flex items-center gap-2 text-sm font-bold">
                    {darkMode ? <SunMedium className="h-4 w-4 text-amber-400" /> : <MoonStar className="h-4 w-4 text-blue-500" />}
                    {darkMode ? 'Dark mode enabled' : 'Light mode enabled'}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filterSummary.map((entry) => (
                  <div key={entry} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-blue-200 bg-white text-zinc-700'}`}>
                    {entry}
                  </div>
                ))}
                <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'border-blue-400/20 bg-blue-400/10 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                  <Wifi className="h-3.5 w-3.5" />
                  {liveStatusLabel}
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-zinc-200 bg-white text-zinc-700'}`}>
                  <Clock3 className="h-3.5 w-3.5" />
                  {readOnlyReview ? 'Read-only review' : 'Response enabled'}
                </div>
              </div>

              <div className={`rounded-[20px] border px-3.5 py-3 ${darkMode ? 'border-white/10 bg-slate-950/40' : 'border-blue-100 bg-white/92'}`}>
                <div className="relative min-w-0">
                  <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-slate-400' : 'text-blue-400'}`} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    placeholder="Search alerts, systems, departments, rules"
                    className={`w-full rounded-[18px] border py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none ${darkMode ? 'border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500' : 'border-blue-200 bg-white text-zinc-900 placeholder:text-zinc-400'}`}
                  />
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  <select value={severityFilter} onChange={(event) => onSelectSeverityFilter(event.target.value)} className={`rounded-[16px] border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}>
                    {['all', 'critical', 'high', 'medium', 'low'].map((option) => (
                      <option key={option} value={option}>
                        {option === 'all' ? 'All severities' : option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                  <select value={sourceFilter} onChange={(event) => onSelectSourceFilter(event.target.value)} className={`rounded-[16px] border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}>
                    <option value="all">All sources</option>
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select value={departmentFilter} onChange={(event) => onSelectDepartmentFilter(event.target.value)} className={`rounded-[16px] border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}>
                    <option value="all">All departments</option>
                    {departmentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select value={timeRangeFilter} onChange={(event) => onSelectTimeRangeFilter(event.target.value)} className={`rounded-[16px] border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-slate-950/60 text-white' : 'border-blue-200 bg-white text-zinc-900'}`}>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {metricCards.map((metric) => (
                <div key={metric.label} className={`rounded-[20px] border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-100 bg-white/95'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metric.label}</div>
                  <div className={`mt-1.5 text-[1.7rem] font-black ${darkMode ? 'text-white' : metric.tone}`}>{metric.value}</div>
                  <div className={`mt-1 text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Live SOC metric</div>
                </div>
              ))}
            </div>

            <div className={`rounded-[24px] border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-100 bg-white/95'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Source pulse</div>
                  <div className={`mt-1 text-base font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Queue visibility by source</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectSourceFilter('all')}
                  className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${sourceChipClassName(sourceFilter === 'all', darkMode)}`}
                >
                  All sources
                </button>
                {sourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSelectSourceFilter(option.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${sourceChipClassName(sourceFilter === option.value, darkMode)}`}
                  >
                    {renderSourceIcon(option.value, 'h-3.5 w-3.5')}
                    <span>{option.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${darkMode ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}>{sourceCountMap.get(option.value) || 0}</span>
                  </button>
                ))}
              </div>
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
                  className={`rounded-[22px] border px-4 py-3 text-left shadow-sm transition ${sourceFilter === entry.source ? (darkMode ? 'border-blue-400/30 bg-blue-500/10 text-white' : 'border-blue-300 bg-blue-100 text-blue-800') : `${darkMode ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : `${moduleCardChrome(entry.statusColor)} text-zinc-700 hover:bg-white`}`}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
                      {renderSourceIcon(entry.source, 'h-3.5 w-3.5')}
                      <span className="truncate">{entry.label}</span>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${moduleCardDot(entry.statusColor)}`} />
                  </div>
                  <div className={`mt-1.5 text-sm ${darkMode ? 'text-slate-300' : 'text-zinc-600'}`}>{entry.moduleLabel}</div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs font-semibold">
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.scanned}</div>
                      <div className={`mt-1 text-lg font-black ${darkMode ? 'text-white' : 'text-zinc-950'}`}>{entry.totalSystemsScanned}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.clean}</div>
                      <div className="mt-1 text-lg font-black text-blue-600">{entry.cleanSystemsCount}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-[0.14em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>{metricLabels.error}</div>
                      <div className="mt-1 text-lg font-black text-rose-500">{entry.errorSystemsCount}</div>
                    </div>
                  </div>
                  <div className={`mt-2.5 flex items-center justify-between gap-3 text-xs ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>
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