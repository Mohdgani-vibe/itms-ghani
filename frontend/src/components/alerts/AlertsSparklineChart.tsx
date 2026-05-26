import { sparklinePath } from './alertsSparklineChartUtils';

interface AlertsSparklineChartProps {
  values: number[];
}

export function AlertsSparklineChart({ values }: AlertsSparklineChartProps) {
  return (
    <svg viewBox="0 0 100 32" className="h-14 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="alerts-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${sparklinePath(values)} L96 32 L4 32 Z`} fill="url(#alerts-sparkline-fill)" opacity="0.9" />
      <path d={sparklinePath(values)} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}