import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface QueueHealthChartProps {
  items: Array<{ label: string; openCount: number; staleSystems: number; errorSystems: number }>;
  activeSelection?: { label: string; metric: 'Open' | 'Offline' | 'Errors' } | null;
  onSelectBar?: (selection: { label: string; metric: 'Open' | 'Offline' | 'Errors' }) => void;
}

const isServerRender = typeof window === 'undefined';

function tooltipClassName() {
  return 'rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-lg';
}

function chartContainerStyle(height: number) {
  return { width: '100%', height, minWidth: 240 } as const;
}

export function AlertsQueueHealthChart({ items, activeSelection, onSelectBar }: QueueHealthChartProps) {
  const chartRows = items.flatMap((item) => ([
    { label: item.label, metric: 'Open', value: item.openCount, fill: '#0ea5e9' },
    { label: item.label, metric: 'Offline', value: item.staleSystems, fill: '#f59e0b' },
    { label: item.label, metric: 'Errors', value: item.errorSystems, fill: '#f43f5e' },
  ]));

  if (isServerRender) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="text-sm font-bold text-zinc-900">{item.label}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              {([
                { metric: 'Open' as const, value: item.openCount, tone: 'text-sky-600' },
                { metric: 'Offline' as const, value: item.staleSystems, tone: 'text-amber-600' },
                { metric: 'Errors' as const, value: item.errorSystems, tone: 'text-rose-600' },
              ]).map((entry) => {
                const active = activeSelection?.label === item.label && activeSelection.metric === entry.metric;
                return (
                  <button key={entry.metric} type="button" onClick={() => onSelectBar?.({ label: item.label, metric: entry.metric })} className={`rounded-lg px-2 py-2 ${active ? 'bg-zinc-100' : ''}`}>
                    <div className={`font-black ${entry.tone}`}>{entry.value}</div>
                    <div className="text-zinc-500">{entry.metric}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-80 w-full" style={chartContainerStyle(320)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
          <Tooltip cursor={{ fill: '#f4f4f5' }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) {
              return null;
            }
            const row = payload[0]?.payload as { metric: string; value: number } | undefined;
            return (
              <div className={tooltipClassName()}>
                <div className="font-bold text-zinc-900">{label}</div>
                <div className="mt-1">{row?.metric}: {row?.value ?? 0}</div>
              </div>
            );
          }} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(payload) => {
            const row = payload as { label?: string; metric?: 'Open' | 'Offline' | 'Errors' } | undefined;
            if (row?.label && row.metric) {
              onSelectBar?.({ label: row.label, metric: row.metric });
            }
          }}>
            {chartRows.map((row) => (
              <Cell key={`${row.label}-${row.metric}`} fill={row.fill} opacity={activeSelection?.label === row.label && activeSelection.metric === row.metric ? 1 : 0.84} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}