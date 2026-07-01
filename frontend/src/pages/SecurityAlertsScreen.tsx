import React, { useState } from 'react';
import {
  Users, Package, HardDrive, Shield, FileText, LogOut,
  Search, Settings, Bell, RefreshCw, ChevronRight, AlertCircle,
  LayoutDashboard, List, AlertTriangle, BookOpen, ArrowRight,
  Activity, TrendingUp
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type NavSection = 'dashboard' | 'all' | 'critical' | 'rules';
type SourceName = 'wazuh' | 'openscap' | 'clamav';

interface SourceStat {
  value: string;
  label: string;
  color?: string;
}

interface SourceData {
  id: SourceName;
  name: string;
  accent: string;
  tint: string;
  status: 'HEALTHY' | 'ATTENTION';
  risk: 'Low' | 'Medium' | 'High';
  desc: string;
  stats: SourceStat[];
  depts: string;
  deptsSub: string;
  passing: string;
  passHealthy: boolean;
  lastScan: string;
  spark: number[];
  trendLabel: string;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const sourcesData: SourceData[] = [
  {
    id: 'wazuh',
    name: 'Wazuh',
    accent: '#2563eb',
    tint: '#eef2ff',
    status: 'HEALTHY',
    risk: 'Low',
    desc: 'Host-based intrusion detection, log analysis, and compliance monitoring across all endpoints.',
    stats: [
      { value: '1,284', label: 'SCANNED' },
      { value: '37', label: 'FINDINGS', color: '#d97706' },
      { value: '12', label: 'ALERTS' }
    ],
    depts: '4 / 9',
    deptsSub: '44% of scope',
    passing: '92%',
    passHealthy: true,
    lastScan: 'Today, 05:53',
    spark: [12, 18, 15, 22, 19, 25, 21, 28, 24, 30, 26, 33, 29, 31],
    trendLabel: '+18% rules'
  },
  {
    id: 'openscap',
    name: 'OpenSCAP',
    accent: '#7c3aed',
    tint: '#f3edfd',
    status: 'ATTENTION',
    risk: 'Medium',
    desc: 'Security compliance validation and vulnerability scanning against industry benchmarks.',
    stats: [
      { value: '842', label: 'SCANNED' },
      { value: '23', label: 'FAILURES', color: '#dc2626' },
      { value: '8', label: 'ALERTS' }
    ],
    depts: '3 / 9',
    deptsSub: '33% of scope',
    passing: '78%',
    passHealthy: false,
    lastScan: 'Today, 04:12',
    spark: [8, 12, 10, 15, 13, 18, 16, 21, 19, 24, 22, 26, 24, 23],
    trendLabel: '+12% failures'
  },
  {
    id: 'clamav',
    name: 'ClamAV',
    accent: '#e11d48',
    tint: '#fdeef1',
    status: 'HEALTHY',
    risk: 'Low',
    desc: 'Real-time antivirus and malware detection protecting file systems and email gateways.',
    stats: [
      { value: '2,156', label: 'SCANNED' },
      { value: '7', label: 'THREATS', color: '#dc2626' },
      { value: '3', label: 'ALERTS' }
    ],
    depts: '9 / 9',
    deptsSub: '100% of scope',
    passing: '99%',
    passHealthy: true,
    lastScan: 'Today, 06:20',
    spark: [2, 3, 1, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 7],
    trendLabel: '+8% scans'
  }
];

const timelineData = [4, 7, 5, 9, 6, 11, 8, 13, 9, 15, 12, 18, 14, 16];
const malwareData = {
  values: [0, 1, 0, 2, 1, 0, 3],
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
};

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================

function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  const w = 180;
  const h = 40;
  const padT = 4;
  const padB = 4;
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: i * (w / (n - 1)),
    y: padT + (1 - (v - min) / range) * (h - padT - padB)
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const lastPoint = points[points.length - 1];

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={areaPath} fill={accent} fillOpacity={0.1} />
      <path d={linePath} fill="none" stroke={accent} strokeWidth={2} />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={accent} />
    </svg>
  );
}

// ============================================================================
// AREA CHART COMPONENT (Timeline)
// ============================================================================

function AreaChart({ data }: { data: number[] }) {
  const w = 800;
  const h = 200;
  const padT = 20;
  const padB = 30;
  const padL = 40;
  const padR = 20;
  const n = data.length;
  const min = 0;
  const max = Math.max(...data);
  const range = max - min || 1;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = data.map((v, i) => ({
    x: padL + i * (chartW / (n - 1)),
    y: padT + (1 - (v - min) / range) * chartH
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${padL + chartW},${h - padB} L${padL},${h - padB} Z`;
  const lastPoint = points[points.length - 1];

  // Gridlines
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * chartH;
    gridLines.push(
      <line
        key={i}
        x1={padL}
        y1={y}
        x2={padL + chartW}
        y2={y}
        stroke="#edeef1"
        strokeWidth={1}
      />
    );
  }

  return (
    <svg width={w} height={h} style={{ display: 'block', maxWidth: '100%' }}>
      {gridLines}
      <path d={areaPath} fill="#2563eb" fillOpacity={0.1} />
      <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2.5} />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill="#2563eb" />
    </svg>
  );
}

// ============================================================================
// LINE CHART COMPONENT (Malware)
// ============================================================================

function LineChart({ data }: { data: { values: number[]; labels: string[] } }) {
  const w = 600;
  const h = 200;
  const padT = 40;
  const padB = 40;
  const padL = 40;
  const padR = 20;
  const n = data.values.length;
  const min = 0;
  const max = Math.max(...data.values, 1);
  const range = max - min || 1;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = data.values.map((v, i) => ({
    x: padL + i * (chartW / (n - 1)),
    y: padT + (1 - (v - min) / range) * chartH,
    value: v
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Gridlines
  const gridLines = [];
  for (let i = 0; i <= 3; i++) {
    const y = padT + (i / 3) * chartH;
    gridLines.push(
      <line
        key={i}
        x1={padL}
        y1={y}
        x2={padL + chartW}
        y2={y}
        stroke="#edeef1"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    );
  }

  return (
    <svg width={w} height={h} style={{ display: 'block', maxWidth: '100%' }}>
      {gridLines}
      <path d={linePath} fill="none" stroke="#dc2626" strokeWidth={2.5} />
      {points.map((p, i) => (
        <React.Fragment key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.value > 0 ? 5 : 3}
            fill="#dc2626"
            style={{ cursor: 'pointer' }}
          />
          {p.value > 0 && (
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#171a1f"
              fontVariantNumeric="tabular-nums"
            >
              {p.value}
            </text>
          )}
          <text
            x={p.x}
            y={h - padB + 20}
            textAnchor="middle"
            fontSize={12}
            fill="#6b7280"
          >
            {data.labels[i]}
          </text>
        </React.Fragment>
      ))}
    </svg>
  );
}

// ============================================================================
// TOP BAR COMPONENT
// ============================================================================

function TopBar({
  nav,
  setNav
}: {
  nav: NavSection;
  setNav: (n: NavSection) => void;
}) {
  const sections: Array<{ id: NavSection; icon: any; label: string; count?: number }> = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'all', icon: List, label: 'All Alerts', count: 36 },
    { id: 'critical', icon: AlertTriangle, label: 'Critical', count: 4 },
    { id: 'rules', icon: BookOpen, label: 'Rules', count: 128 }
  ];

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: 58,
        background: '#fff',
        borderBottom: '1px solid #e7e9ec',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 20,
        gap: 32,
        zIndex: 50,
        fontFamily: 'Public Sans, sans-serif'
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            fontWeight: 700,
            fontSize: 16,
            color: '#fff',
            letterSpacing: '-0.5px'
          }}
        >
          IT
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              background: '#dc2626',
              borderRadius: '50%',
              border: '2px solid #fff'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>
            IT MANAGEMENT SYSTEM · POWERED BY ZERODHA
          </div>
        </div>
      </div>

      {/* Section Nav */}
      <div style={{ display: 'flex', gap: 4, marginLeft: 20 }}>
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = nav === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setNav(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 12px',
                background: isActive ? '#eef2ff' : 'transparent',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#f7f8fa';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={16} />
              <span>{s.label}</span>
              {s.count !== undefined && (
                <div
                  style={{
                    padding: '2px 6px',
                    background: isActive ? '#2563eb' : '#e7e9ec',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    color: isActive ? '#fff' : '#6b7280',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {s.count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Right controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{
            width: 36,
            height: 36,
            border: '1px solid #e7e9ec',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer'
          }}
        >
          <Search size={18} />
        </button>
        <button
          style={{
            width: 36,
            height: 36,
            border: '1px solid #e7e9ec',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer'
          }}
        >
          <Settings size={18} />
        </button>
        <button
          style={{
            width: 36,
            height: 36,
            border: '1px solid #e7e9ec',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          <Bell size={18} />
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 6,
              height: 6,
              background: '#dc2626',
              borderRadius: '50%'
            }}
          />
        </button>
        <div
          style={{
            padding: '0 14px',
            height: 36,
            border: '1px solid #e7e9ec',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: '#171a1f'
          }}
        >
          super_admin
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICON RAIL COMPONENT
// ============================================================================

function IconRail() {
  const items = [
    { icon: Users, label: 'Users' },
    { icon: Package, label: 'Inventory' },
    { icon: HardDrive, label: 'Storage' },
    { icon: Shield, label: 'Security', active: true },
    { icon: FileText, label: 'Docs' },
    { icon: LogOut, label: 'Sign out' }
  ];

  return (
    <div
      style={{
        width: 58,
        background: '#fff',
        borderRight: '1px solid #e7e9ec',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        gap: 8
      }}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            title={item.label}
            style={{
              width: 44,
              height: 44,
              border: 'none',
              borderRadius: 10,
              background: item.active ? '#eef2ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: item.active ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!item.active) e.currentTarget.style.background = '#f7f8fa';
            }}
            onMouseLeave={(e) => {
              if (!item.active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// WORKSPACE HEADER COMPONENT
// ============================================================================

function WorkspaceHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14
            }}
          >
            <Shield size={24} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Security</span>
            <ChevronRight size={14} color="#9aa1ab" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#171a1f' }}>Dashboard</span>
          </div>
          <h1
            style={{
              fontSize: 25,
              fontWeight: 800,
              color: '#171a1f',
              margin: 0,
              marginBottom: 6,
              fontFamily: 'Public Sans, sans-serif'
            }}
          >
            Security Alerts
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, maxWidth: 600 }}>
            Real-time security monitoring, threat detection, and compliance validation across all
            organizational assets.
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 18px',
            background: '#2563eb',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1d4ed8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2563eb';
          }}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SOURCES BAR COMPONENT
// ============================================================================

function SourcesBar({
  source,
  setSource
}: {
  source: SourceName | null;
  setSource: (s: SourceName | null) => void;
}) {
  const sources: Array<{ id: SourceName; name: string; count: number; color: string }> = [
    { id: 'wazuh', name: 'Wazuh', count: 12, color: '#2563eb' },
    { id: 'openscap', name: 'OpenSCAP', count: 8, color: '#7c3aed' },
    { id: 'clamav', name: 'ClamAV', count: 3, color: '#e11d48' }
  ];

  return (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          color: '#9aa1ab',
          textTransform: 'uppercase'
        }}
      >
        SOURCES
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {sources.map((s) => {
          const isActive = source === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSource(isActive ? null : s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 14px',
                background: isActive ? '#eef2ff' : '#fff',
                border: `1px solid ${isActive ? '#2563eb' : '#e7e9ec'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? '#2563eb' : '#171a1f',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = '#e7e9ec';
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: s.color
                }}
              />
              <span>{s.name}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#9aa1ab',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SOURCE CARD COMPONENT
// ============================================================================

function SourceCard({ data }: { data: SourceData }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e7e9ec',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Accent stripe */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${data.accent} 0%, ${data.accent}dd 100%)`
        }}
      />

      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: data.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: data.accent
              }}
            >
              <Shield size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.6, marginBottom: 3 }}>
                SOURCE
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#171a1f' }}>
                {data.name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: data.status === 'HEALTHY' ? '#eaf6ef' : '#fef3e7',
                fontSize: 11,
                fontWeight: 700,
                color: data.status === 'HEALTHY' ? '#0f9d63' : '#d97706',
                letterSpacing: 0.5
              }}
            >
              {data.status}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
              RISK <span style={{ color: data.risk === 'Low' ? '#0f9d63' : data.risk === 'Medium' ? '#d97706' : '#dc2626' }}>{data.risk}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, lineHeight: 1.5, color: '#6b7280', margin: 0, marginBottom: 18 }}>
          {data.desc}
        </p>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 18,
            marginBottom: 20,
            padding: '16px 0',
            borderTop: '1px solid #edeef1',
            borderBottom: '1px solid #edeef1'
          }}
        >
          {data.stats.map((stat, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: stat.color || '#171a1f',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 4
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ab', letterSpacing: 0.5 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Sparkline section */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.6 }}>
              14-DAY ACTIVITY
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f9d63' }}>
              <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
              {data.trendLabel}
            </span>
          </div>
          <Sparkline data={data.spark} accent={data.accent} />
        </div>

        {/* Metric tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              padding: 14,
              background: '#f7f8fa',
              borderRadius: 8,
              border: '1px solid #edeef1'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.5, marginBottom: 6 }}>
              DEPTS WITH FINDINGS
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#171a1f', fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>
              {data.depts}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {data.deptsSub}
            </div>
          </div>
          <div
            style={{
              padding: 14,
              background: '#f7f8fa',
              borderRadius: 8,
              border: '1px solid #edeef1'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.5, marginBottom: 6 }}>
              SYSTEMS PASSING
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: data.passHealthy ? '#0f9d63' : '#d97706',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 3
              }}
            >
              {data.passing}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {data.passHealthy ? 'Healthy in scan set' : 'Needs attention'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            <span style={{ fontWeight: 600 }}>LAST SCAN</span> {data.lastScan}
          </div>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 14px',
              background: data.tint,
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: data.accent,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = data.accent;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = data.tint;
              e.currentTarget.style.color = data.accent;
            }}
          >
            <span>View Alerts</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD PANELS
// ============================================================================

function TimelinePanel({ data }: { data: number[] }) {
  const total = data.reduce((sum, v) => sum + v, 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 12,
        padding: 24
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: '#eef2ff',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            color: '#2563eb',
            letterSpacing: 0.6,
            marginBottom: 12
          }}
        >
          DASHBOARD
        </span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#171a1f', margin: 0, marginBottom: 12 }}>
        Threat Activity Timeline
      </h3>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#171a1f', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
        {total}
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0, marginBottom: 20 }}>
        alerts across the last 14 days
      </p>
      <AreaChart data={data} />
    </div>
  );
}

function MalwarePanel({ data }: { data: { values: number[]; labels: string[] } }) {
  const total = data.values.reduce((sum, v) => sum + v, 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 12,
        padding: 24
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: '#eef2ff',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            color: '#2563eb',
            letterSpacing: 0.6,
            marginBottom: 12
          }}
        >
          DASHBOARD
        </span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#171a1f', margin: 0, marginBottom: 12 }}>
        Malware Detection Trends
      </h3>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#171a1f', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
        {total}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          detections across visible daily buckets
        </p>
        <span
          style={{
            padding: '3px 8px',
            background: '#eef2ff',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: '#2563eb'
          }}
        >
          Interactive
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#9aa1ab', margin: 0, marginBottom: 16 }}>
        Click any point to pivot into that day's ClamAV alerts
      </p>
      <LineChart data={data} />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SecurityAlertsScreen() {
  const [nav, setNav] = useState<NavSection>('dashboard');
  const [source, setSource] = useState<SourceName | null>(null);

  const handleRefresh = () => {
    console.log('Refreshing security data...');
  };

  const filteredSources = source
    ? sourcesData.filter((s) => s.id === source)
    : sourcesData;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#f7f8fa',
        fontFamily: 'Public Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <TopBar nav={nav} setNav={setNav} />
      
      <div style={{ display: 'flex', flex: 1 }}>
        <IconRail />
        
        <main style={{ flex: 1, padding: '30px' }}>
          <WorkspaceHeader onRefresh={handleRefresh} />
          <SourcesBar source={source} setSource={setSource} />
          
          {/* Source cards grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: 18,
              marginBottom: 30
            }}
          >
            {filteredSources.map((s) => (
              <SourceCard key={s.id} data={s} />
            ))}
          </div>

          {/* Dashboard panels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
              gap: 18
            }}
          >
            <TimelinePanel data={timelineData} />
            <MalwarePanel data={malwareData} />
          </div>
        </main>
      </div>
    </div>
  );
}
