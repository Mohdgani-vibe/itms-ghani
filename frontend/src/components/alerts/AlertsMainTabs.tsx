interface AlertsMainTabsTab {
  id: string;
  label: string;
}

interface AlertsMainTabsProps {
  tabs: AlertsMainTabsTab[];
  activeTab: string;
  onSelectTab: (value: string) => void;
}

function optionButtonClass(active: boolean) {
  return `inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'border border-sky-200 bg-sky-50 text-sky-800' : 'bg-white text-sky-700 hover:bg-sky-50'}`;
}

export function AlertsMainTabs({ tabs, activeTab, onSelectTab }: AlertsMainTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelectTab(tab.id)}
          className={optionButtonClass(activeTab === tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}