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
  return `inline-flex items-center gap-2 rounded-[18px] border px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm' : 'border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800'}`;
}

export function AlertsMainTabs({ tabs, activeTab, onSelectTab }: AlertsMainTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[18px] border border-zinc-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
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
            <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black ${activeTab === tab.id ? 'bg-white text-blue-700 ring-1 ring-blue-100' : 'bg-zinc-100 text-zinc-700'}`}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}