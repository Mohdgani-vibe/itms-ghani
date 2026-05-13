import type { ComponentType, SVGProps } from 'react';

type GatepassSection = 'create' | 'pending' | 'records' | 'reports';

interface GatepassSidebarItem {
  id: GatepassSection;
  label: string;
  detail: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number;
}

interface GatepassSidebarProps {
  items: GatepassSidebarItem[];
  activeSection: GatepassSection;
  onSectionChange: (section: GatepassSection) => void;
}

export default function GatepassSidebar({ items, activeSection, onSectionChange }: GatepassSidebarProps) {
  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:sticky md:top-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
        <div className="text-lg font-bold text-zinc-900">Gatepass Pro</div>
        <p className="mt-1 text-sm leading-6 text-zinc-500">Dispatch and tracking</p>
      </div>

      <div className="mt-5 space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex w-full items-start justify-between rounded-xl border px-4 py-3.5 text-left transition ${active ? 'border-zinc-300 bg-zinc-50 text-zinc-900 shadow-sm' : 'border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50'}`}
            >
              <div className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 ${active ? 'text-zinc-700' : 'text-zinc-400'}`} />
                <div>
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</div>
                </div>
              </div>
              {typeof item.badge === 'number' && item.badge > 0 ? <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-bold text-zinc-700">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}