import type { ReactNode } from 'react';
import { Search, ShieldAlert } from 'lucide-react';

import type { AlertsSourceOption } from './types';

interface AlertsToolbarProps {
  tabs: ReadonlyArray<{ value: string; label: string }>;
  sourceFilter: string;
  totalAlerts: number;
  sourceCountMap: Map<string, number>;
  onSelectSourceFilter: (value: string) => void;
  renderSourceIcon: (value: string, className?: string) => ReactNode;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sourceOptions: AlertsSourceOption[];
  sourceLabelMap: Map<string, string>;
  showSearchControls?: boolean;
}

export function AlertsToolbar({
  tabs,
  sourceFilter,
  totalAlerts,
  sourceCountMap,
  onSelectSourceFilter,
  renderSourceIcon,
  searchQuery,
  onSearchQueryChange,
  sourceOptions,
  sourceLabelMap,
  showSearchControls = true,
}: AlertsToolbarProps) {
  return (
    <>
      <div className="border-b border-blue-100 bg-white/90 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const count = tab.value === 'all' ? totalAlerts : (sourceCountMap.get(tab.value) || 0);
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onSelectSourceFilter(tab.value)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                {tab.value !== 'all' ? renderSourceIcon(tab.value, 'h-3.5 w-3.5') : <ShieldAlert className="h-3.5 w-3.5" />}
                {tab.label}
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showSearchControls ? (
        <div className="border-b border-blue-100 bg-[linear-gradient(180deg,_#f5f9ff_0%,_#ffffff_100%)] px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search alert title, asset, hostname, source"
                className="w-full rounded-xl border border-blue-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 shadow-sm outline-none"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(event) => onSelectSourceFilter(event.target.value)}
              className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none md:w-64"
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-white px-2.5 py-1 font-bold text-zinc-700 shadow-sm ring-1 ring-blue-100">
              {totalAlerts} result{totalAlerts === 1 ? '' : 's'}
            </span>
            {sourceFilter !== 'all' ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 font-bold text-blue-800">
                Source: {sourceLabelMap.get(sourceFilter) || sourceFilter}
              </span>
            ) : null}
            {searchQuery.trim() ? (
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-zinc-700 shadow-sm ring-1 ring-blue-100">
                Search: {searchQuery.trim()}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}