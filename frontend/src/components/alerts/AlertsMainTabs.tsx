import type { ReactNode } from 'react';

interface AlertsMainTabsTab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface AlertsMainTabsProps {
  tabs: AlertsMainTabsTab[];
  activeTab: string;
  onSelectTab: (value: string) => void;
}

function optionButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${active ? 'border-sky-300 bg-sky-600 text-white shadow-[0_10px_30px_rgba(2,132,199,0.24)]' : 'border-zinc-200 bg-white text-zinc-700 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800'}`;
}

export function AlertsMainTabs({ tabs, activeTab, onSelectTab }: AlertsMainTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelectTab(tab.id)}
          className={optionButtonClass(activeTab === tab.id)}
        >
          {tab.icon ? <span className="shrink-0">{tab.icon}</span> : null}
          {tab.label}
          {typeof tab.count === 'number' ? (
            <span className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}