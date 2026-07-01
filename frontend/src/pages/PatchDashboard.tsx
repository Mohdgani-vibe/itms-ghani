import { useState } from 'react';
import { Search, Settings, Bell, Home, HardDrive, Users, Package, Terminal, BarChart3, FileText } from 'lucide-react';

// ============================================================================
// DATA TYPES
// ============================================================================

interface SystemsSummary {
  total: number;
  online: number;
  offline: number;
}

interface ChartData {
  period: string;
  runs: number;
  rate: number;
  done: number;
  failed: number;
  trendLabel: string;
  series: number[];
}

interface RecentUpdate {
  id: string;
  timestamp: string;
  system: string;
  status: 'success' | 'failed';
}

// ============================================================================
// SVG CHART HELPERS
// ============================================================================

interface DonutChartProps {
  rate: number;
  size?: number;
  strokeWidth?: number;
}

function DonutChart({ rate, size = 80, strokeWidth = 9 }: DonutChartProps) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - rate / 100);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#eef0f2"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#16a34a"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Center text */}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="#1a1d21"
      >
        {rate}%
      </text>
      <text
        x={center}
        y={center + 10}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#6b7280"
        letterSpacing="0.5"
      >
        SUCCESS
      </text>
    </svg>
  );
}

interface SparklineProps {
  series: number[];
  width?: number;
  height?: number;
}

function Sparkline({ series, width = 200, height = 48 }: SparklineProps) {
  if (series.length === 0) {
    return (
      <svg width={width} height={height}>
        <rect width={width} height={2} y={height / 2} fill="#eef0f2" rx="1" />
      </svg>
    );
  }

  const max = Math.max(...series, 1);
  const gap = series.length > 12 ? 2 : 4;
  const barWidth = (width - gap * (series.length - 1)) / series.length;
  const peakIndex = series.indexOf(max);

  return (
    <svg width={width} height={height}>
      {series.map((value, index) => {
        const barHeight = Math.max((value / max) * height, 3);
        const x = index * (barWidth + gap);
        const y = height - barHeight;
        const isPeak = index === peakIndex;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2.5}
            fill={isPeak ? '#2563eb' : '#c9dcfb'}
          />
        );
      })}
    </svg>
  );
}

// ============================================================================
// ICON RAIL
// ============================================================================

function IconRail() {
  const icons = [
    { Icon: Home, label: 'Home' },
    { Icon: HardDrive, label: 'Devices' },
    { Icon: Users, label: 'Users' },
    { Icon: Package, label: 'Inventory' },
    { Icon: Terminal, label: 'Terminal' },
    { Icon: BarChart3, label: 'Analytics' },
    { Icon: FileText, label: 'Reports' },
  ];

  return (
    <div
      className="fixed left-0 top-[60px] bottom-0 flex flex-col items-center gap-1 py-4"
      style={{
        width: '64px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e6e8eb',
      }}
    >
      {icons.map(({ Icon, label }, index) => (
        <button
          key={index}
          className="flex items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
          style={{ width: '44px', height: '44px' }}
          title={label}
        >
          <Icon size={20} style={{ color: '#6b7280' }} />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// TOP BAR
// ============================================================================

function TopBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{ height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e6e8eb' }}
    >
      {/* Accent strip */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #10b981, #14b8a6)' }} />

      <div className="flex items-center justify-between px-6" style={{ height: '56px' }}>
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center rounded-lg" style={{ width: '36px', height: '36px', backgroundColor: '#2563eb' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff' }}>IT</span>
            <div
              className="absolute rounded-full"
              style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', top: '-2px', right: '-2px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1a1d21', letterSpacing: '0.5px' }}>ITMS</div>
            <div style={{ fontSize: '8px', fontWeight: '600', color: '#9aa1ab', letterSpacing: '0.8px' }}>IT MANAGEMENT SYSTEM · POWERED BY ZERODHA</div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ backgroundColor: '#eef2ff', color: '#2563eb' }}
          >
            Dashboard
          </button>
          <button className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ color: '#6b7280' }}>
            Devices
          </button>
          <button className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ color: '#6b7280' }}>
            Reports
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-gray-50">
            <Search size={18} style={{ color: '#6b7280' }} />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-50">
            <Settings size={18} style={{ color: '#6b7280' }} />
          </button>
          <button className="relative p-2 rounded-lg hover:bg-gray-50">
            <Bell size={18} style={{ color: '#6b7280' }} />
            <div
              className="absolute rounded-full"
              style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', top: '6px', right: '6px' }}
            />
          </button>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#f5f6f8', color: '#1a1d21' }}
          >
            super_admin
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB SWITCHER
// ============================================================================

interface TabSwitcherProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', count: null },
    { id: 'terminal', label: 'Salt Terminal', count: 42 },
    { id: 'automation', label: 'Automation', count: 8 },
    { id: 'logs', label: 'Logs', count: 156 },
    { id: 'reports', label: 'Reports', count: 23 },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: '#f5f6f8' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all"
          style={
            activeTab === tab.id
              ? { backgroundColor: '#ffffff', color: '#2563eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
              : { color: '#6b7280' }
          }
        >
          <span>{tab.label}</span>
          {tab.count !== null && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={
                activeTab === tab.id
                  ? { backgroundColor: '#eef2ff', color: '#2563eb' }
                  : { backgroundColor: '#eef0f2', color: '#9aa1ab' }
              }
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// STAT TILE
// ============================================================================

interface StatTileProps {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning';
}

function StatTile({ label, value, variant = 'default' }: StatTileProps) {
  const styles = {
    default: { backgroundColor: '#ffffff', borderColor: '#e6e8eb' },
    success: { backgroundColor: '#f1fbf5', borderColor: '#bbe7cd' },
    warning: { backgroundColor: '#fdfaf0', borderColor: '#f3e0b5' },
  };

  return (
    <div
      className="rounded-xl p-6"
      style={{ border: `1px solid ${styles[variant].borderColor}`, backgroundColor: styles[variant].backgroundColor }}
    >
      <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '40px', fontWeight: '800', color: '#1a1d21', marginTop: '8px' }}>{value}</div>
    </div>
  );
}

// ============================================================================
// SYSTEMS SUMMARY
// ============================================================================

interface SystemsSummaryProps {
  summary: SystemsSummary;
}

function SystemsSummary({ summary }: SystemsSummaryProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(255, 255, 255, 0.9) 50%, rgba(16, 185, 129, 0.03) 100%)',
        border: '1px solid #e6e8eb',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1a1d21' }}>Systems summary</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Active devices and connectivity status</p>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ border: '1px solid #e6e8eb', backgroundColor: '#ffffff', color: '#6b7280' }}
        >
          All departments
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatTile label="TOTAL SYSTEM COUNT" value={summary.total} variant="default" />
        <StatTile label="ONLINE SYSTEM COUNT" value={summary.online} variant="success" />
        <StatTile label="OFFLINE SYSTEM COUNT" value={summary.offline} variant="warning" />
      </div>
    </div>
  );
}

// ============================================================================
// CHART CARD
// ============================================================================

interface ChartCardProps {
  data: ChartData;
}

function ChartCard({ data }: ChartCardProps) {
  const max = data.series.length > 0 ? Math.max(...data.series) : 0;

  return (
    <div className="rounded-xl p-5" style={{ border: '1px solid #e6e8eb', backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', letterSpacing: '0.8px' }}>
          {data.period}
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#f1fbf5', color: '#16a34a' }}
        >
          <span>▲</span>
          <span>{data.rate}%</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex items-center gap-6 mb-5">
        {/* Donut */}
        <div className="shrink-0">
          <DonutChart rate={data.rate} />
        </div>

        {/* Stats */}
        <div className="flex-1">
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#1a1d21' }}>{data.runs}</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#9aa1ab', marginTop: '2px' }}>COMPLETED RUNS</div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{data.done} done</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{data.failed} failed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div style={{ fontSize: '9px', fontWeight: '700', color: '#9aa1ab', letterSpacing: '0.8px' }}>
            {data.trendLabel}
          </div>
          {max > 0 && (
            <div style={{ fontSize: '9px', fontWeight: '700', color: '#2563eb', letterSpacing: '0.5px' }}>
              {max} PEAK
            </div>
          )}
        </div>
        <Sparkline series={data.series} width={240} height={48} />
      </div>
    </div>
  );
}

// ============================================================================
// CHARTS PANEL
// ============================================================================

interface ChartsPanelProps {
  charts: ChartData[];
}

function ChartsPanel({ charts }: ChartsPanelProps) {
  return (
    <div className="rounded-xl p-6" style={{ border: '1px solid #e6e8eb', backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div className="mb-6">
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px' }}>CHARTS</div>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1a1d21' }}>
              Update activity for last 1 day, 7 days, and 1 month
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a' }}>Successful systems updated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {charts.map((chart, index) => (
          <ChartCard key={index} data={chart} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// RECENT UPDATES
// ============================================================================

interface RecentUpdatesProps {
  updates: RecentUpdate[];
}

function RecentUpdates({ updates }: RecentUpdatesProps) {
  return (
    <div className="rounded-xl p-6" style={{ border: '1px solid #e6e8eb', backgroundColor: '#ffffff' }}>
      <div className="flex items-center gap-3 mb-4">
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px' }}>
          RECENT 10 UPDATES DONE
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#eef2ff', color: '#2563eb' }}
        >
          {updates.length}
        </div>
      </div>

      {updates.length === 0 ? (
        <div
          className="rounded-lg py-12 text-center"
          style={{ border: '2px dashed #eef0f2', backgroundColor: '#fafbfc' }}
        >
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#9aa1ab' }}>
            No completed update runs available for this scope yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {updates.map((update) => (
            <div
              key={update.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ border: '1px solid #eef0f2', backgroundColor: '#fafbfc' }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d21' }}>{update.system}</div>
                <div style={{ fontSize: '11px', color: '#9aa1ab', marginTop: '2px' }}>{update.timestamp}</div>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={
                  update.status === 'success'
                    ? { backgroundColor: '#f1fbf5', color: '#16a34a' }
                    : { backgroundColor: '#fef2f2', color: '#ef4444' }
                }
              >
                {update.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PatchDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Mock data - defaults to zeros for empty scope
  const summary: SystemsSummary = {
    total: 0,
    online: 0,
    offline: 0,
  };

  const charts: ChartData[] = [
    {
      period: 'LAST 1 DAY',
      runs: 0,
      rate: 0,
      done: 0,
      failed: 0,
      trendLabel: 'RUNS PER HOUR',
      series: [],
    },
    {
      period: 'LAST 7 DAYS',
      runs: 0,
      rate: 0,
      done: 0,
      failed: 0,
      trendLabel: 'RUNS PER DAY',
      series: [],
    },
    {
      period: 'LAST 30 DAYS',
      runs: 0,
      rate: 0,
      done: 0,
      failed: 0,
      trendLabel: 'RUNS PER DAY',
      series: [],
    },
  ];

  const recentUpdates: RecentUpdate[] = [];

  return (
    <div style={{ fontFamily: 'Public Sans, sans-serif', backgroundColor: '#f5f6f8', minHeight: '100vh' }}>
      <TopBar />
      <IconRail />

      {/* Main content */}
      <div style={{ marginLeft: '64px', paddingTop: '60px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px' }}>
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1a1d21' }}>Patch dashboard</h1>
              <div
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ border: '1px solid #e6e8eb', backgroundColor: '#ffffff', color: '#6b7280' }}
              >
                All departments
              </div>
            </div>

            <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Content */}
          <div className="space-y-6">
            <SystemsSummary summary={summary} />
            <ChartsPanel charts={charts} />
            <RecentUpdates updates={recentUpdates} />
          </div>
        </div>
      </div>
    </div>
  );
}
