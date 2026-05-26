import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AlertsMeasuredChart } from './AlertsMeasuredChart';

interface ThreatTimelineChartProps {
  points: Array<{ label: string; count: number }>;
  activeLabel?: string | null;
  onSelectPoint?: (label: string) => void;
}

const isServerRender = typeof window === 'undefined';

function tooltipClassName() {
  return 'rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-lg';
}

function chartContainerStyle(height: number) {
  return { width: '100%', height, minWidth: 240 } as const;
}

function normalizeTimelinePoints(points: Array<{ label: string; count: number }>) {
  return points.map((point) => ({
    label: point.label,
    count: Number.isFinite(point.count) ? point.count : 0,
  }));
}

function timelineBarWidth(value: number, maxValue: number) {
  return Math.max(8, (value / Math.max(maxValue, 1)) * 100);
}

export function AlertsThreatTimelineChart({ points, activeLabel, onSelectPoint }: ThreatTimelineChartProps) {
  const normalizedPoints = normalizeTimelinePoints(points);

  if (isServerRender) {
    const maxValue = Math.max(...normalizedPoints.map((point) => point.count), 1);
    return (
      <div className="space-y-3">
        {normalizedPoints.map((point) => (
          <button
            key={point.label}
            type="button"
            onClick={() => onSelectPoint?.(point.label)}
            className={`w-full rounded-xl border px-3 py-3 text-left ${activeLabel === point.label ? 'border-sky-300 bg-sky-50' : 'border-zinc-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600">
              <span>{point.label}</span>
              <span>{point.count}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-200">
              <div className="h-2 rounded-full bg-sky-500" style={{ width: `${timelineBarWidth(point.count, maxValue)}%` }} />
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="h-72 w-full" style={chartContainerStyle(288)}>
      <AlertsMeasuredChart height={288} minWidth={240}>
        {({ width, height }) => (
        <AreaChart width={width} height={height} data={normalizedPoints} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="alerts-threat-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
          <Tooltip cursor={{ stroke: '#bae6fd', strokeWidth: 1 }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) {
              return null;
            }
            return (
              <div className={tooltipClassName()}>
                <div className="font-bold text-zinc-900">{label}</div>
                <div className="mt-1">{payload[0]?.value} events</div>
              </div>
            );
          }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#0ea5e9"
            strokeWidth={3}
            fill="url(#alerts-threat-fill)"
            dot={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { label: string } };
              if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) {
                return null;
              }
              const active = activeLabel === payload.label;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 6 : 4}
                  fill={active ? '#0284c7' : '#0ea5e9'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ cursor: onSelectPoint ? 'pointer' : 'default' }}
                  onClick={() => onSelectPoint?.(payload.label)}
                />
              );
            }}
          />
        </AreaChart>
        )}
      </AlertsMeasuredChart>
    </div>
  );
}