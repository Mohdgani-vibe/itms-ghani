import React, { useState } from 'react';
import {
  Users, Package, LogOut, Shield, FileText, Search, Settings, Bell,
  Plus, AlertCircle, Archive, CheckCircle, Clock, Vault, BarChart3,
  ExternalLink, Download, ChevronRight
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type TabType = 'active' | 'history' | 'create';
type StatusType = 'Approved' | 'Pending' | 'Rejected';

interface KpiData {
  created: number;
  pending: number;
  archived: number;
}

interface ReportItem {
  id: string;
  status: StatusType;
  employee: string;
  asset: string;
  date: string;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const kpis: KpiData = {
  created: 128,
  pending: 9,
  archived: 340
};

const reports: ReportItem[] = [
  { id: 'GP-2048', status: 'Approved', employee: 'Ananya Mehta', asset: 'MacBook Pro 14"', date: 'Jun 28, 2026' },
  { id: 'GP-2047', status: 'Pending', employee: 'Rahul Singh', asset: 'Dell Monitor 27"', date: 'Jun 27, 2026' },
  { id: 'GP-2046', status: 'Approved', employee: 'Priya Sharma', asset: 'iPad Pro 12.9"', date: 'Jun 26, 2026' },
  { id: 'GP-2045', status: 'Rejected', employee: 'Vikram Patel', asset: 'Logitech Keyboard', date: 'Jun 25, 2026' },
  { id: 'GP-2044', status: 'Approved', employee: 'Sneha Reddy', asset: 'iPhone 14 Pro', date: 'Jun 24, 2026' },
];

const barcodeWidths = [3, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 3, 4, 1, 2, 3, 1, 2];

// ============================================================================
// WORKSPACE HEADER
// ============================================================================

function WorkspaceHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
          <span>Gatepass</span>
          <ChevronRight size={14} />
          <span style={{ color: '#171a1f', fontWeight: 600 }}>Active</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 800, color: '#171a1f', margin: 0, marginBottom: 6 }}>
          Gatepass
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          Track asset movement and manage dispatch approvals
        </p>
      </div>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
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
        <Plus size={18} />
        Create Gatepass
      </button>
    </div>
  );
}

// ============================================================================
// BARCODE COMPONENT
// ============================================================================

function Barcode({ code }: { code: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 52,
          padding: '0 8px'
        }}
      >
        {barcodeWidths.map((width, idx) => (
          <div
            key={idx}
            style={{
              width: width,
              height: '100%',
              background: '#101623'
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 600,
          color: '#171a1f',
          letterSpacing: 1
        }}
      >
        {code}
      </div>
    </div>
  );
}

// ============================================================================
// SCAN BANNER COMPONENT
// ============================================================================

function ScanBanner() {
  return (
    <div
      style={{
        background: 'linear-gradient(120deg, #101623 0%, #1c2740 100%)',
        borderRadius: 16,
        padding: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 40
      }}
    >
      <div style={{ flex: 1 }}>
        <style>{`
          .scan-station-text, .scan-station-text * {
            color: #ffffff !important;
          }
        `}</style>
        <div
          className="scan-station-text"
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.2,
            marginBottom: 8
          }}
        >
          SCAN STATION
        </div>
        <h2 className="scan-station-text" style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 8 }}>
          Gatepass barcode board
        </h2>
        <p className="scan-station-text" style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Use the larger barcode cards to verify movement records quickly from reports.
        </p>
      </div>
      <Barcode code="GP-2048-ZBL" />
    </div>
  );
}

// ============================================================================
// KPI CARDS
// ============================================================================

function KpiCards({ data }: { data: KpiData }) {
  const cards = [
    {
      label: 'CREATED',
      value: data.created,
      sub: 'Total gatepasses',
      icon: CheckCircle,
      iconBg: '#eef2ff',
      iconColor: '#2563eb'
    },
    {
      label: 'PENDING',
      value: data.pending,
      sub: 'Awaiting approval',
      icon: Clock,
      iconBg: '#fff4e6',
      iconColor: '#d97706',
      cardBg: '#fffdf7',
      cardBorder: '#f3e0b5'
    },
    {
      label: 'ARCHIVED',
      value: data.archived,
      sub: 'Completed & closed',
      icon: Archive,
      iconBg: '#eaf6ef',
      iconColor: '#0f9d63'
    }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            style={{
              background: card.cardBg || '#fff',
              border: `1px solid ${card.cardBorder || '#e7e9ec'}`,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: card.iconBg,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.iconColor
                }}
              >
                <Icon size={18} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  color: '#6b7280'
                }}
              >
                {card.label}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#171a1f',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {card.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function ActionTile({
  icon: Icon,
  title,
  sub,
  color,
  tint
}: {
  icon: any;
  title: string;
  sub: string;
  color: string;
  tint: string;
}) {
  return (
    <button
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#2563eb';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e7e9ec';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          background: tint,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          flexShrink: 0
        }}
      >
        <Icon size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#171a1f', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}

function QuickActions() {
  const actions = [
    {
      icon: Plus,
      title: 'Create Gatepass',
      sub: 'Generate new dispatch approval',
      color: '#2563eb',
      tint: '#eef2ff'
    },
    {
      icon: Clock,
      title: 'Pending Signatures',
      sub: 'Review awaiting approvals',
      color: '#d97706',
      tint: '#fff4e6'
    },
    {
      icon: Vault,
      title: 'Vault & Records',
      sub: 'Access archived documents',
      color: '#0f9d63',
      tint: '#eaf6ef'
    },
    {
      icon: BarChart3,
      title: 'Reports',
      sub: 'Analytics and insights',
      color: '#7c3aed',
      tint: '#f3edfd'
    }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16
      }}
    >
      {actions.map((action, idx) => (
        <ActionTile key={idx} {...action} />
      ))}
    </div>
  );
}

// ============================================================================
// STATUS CHIP
// ============================================================================

function StatusChip({ status }: { status: StatusType }) {
  const styles: Record<StatusType, { bg: string; fg: string }> = {
    Approved: { bg: '#eaf6ef', fg: '#0f9d63' },
    Pending: { bg: '#fff4e6', fg: '#d97706' },
    Rejected: { bg: '#fef2f2', fg: '#dc2626' }
  };

  const style = styles[status];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        background: style.bg,
        color: style.fg,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {status}
    </span>
  );
}

// ============================================================================
// AVATAR NAME
// ============================================================================

function AvatarName({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700
        }}
      >
        {initials}
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#171a1f' }}>{name}</span>
    </div>
  );
}

// ============================================================================
// ROW ACTIONS
// ============================================================================

function RowActions() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
      <button
        style={{
          width: 32,
          height: 32,
          border: '1px solid #e7e9ec',
          borderRadius: 6,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#2563eb';
          e.currentTarget.style.color = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e7e9ec';
          e.currentTarget.style.color = '#6b7280';
        }}
      >
        <ExternalLink size={16} />
      </button>
      <button
        style={{
          width: 32,
          height: 32,
          border: '1px solid #e7e9ec',
          borderRadius: 6,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#0f9d63';
          e.currentTarget.style.color = '#0f9d63';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e7e9ec';
          e.currentTarget.style.color = '#6b7280';
        }}
      >
        <Download size={16} />
      </button>
    </div>
  );
}

// ============================================================================
// REPORT REGISTER
// ============================================================================

function ReportRegister({ reports }: { reports: ReportItem[] }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 16,
        padding: 24
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: '#6b7280',
              marginBottom: 6
            }}
          >
            REPORTS
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#171a1f', margin: 0, marginBottom: 4 }}>
            Gatepass report register
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Recent gatepass activity and status updates
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            <span style={{ fontWeight: 600, color: '#171a1f' }}>{reports.length}</span> reports ready
          </div>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: '#fff',
              border: '1px solid #e7e9ec',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#171a1f',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e7e9ec';
              e.currentTarget.style.color = '#171a1f';
            }}
          >
            <Download size={16} />
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1.4fr 1.6fr 1fr 84px',
          gap: 16,
          padding: '12px 16px',
          background: '#f7f8fa',
          borderRadius: 8,
          marginBottom: 8
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#6b7280' }}>
          GATEPASS
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#6b7280' }}>
          EMPLOYEE
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#6b7280' }}>
          ASSET
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#6b7280' }}>
          ISSUE DATE
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#6b7280', textAlign: 'right' }}>
          ACTIONS
        </div>
      </div>

      {/* Table Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {reports.map((report) => (
          <div
            key={report.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.4fr 1.6fr 1fr 84px',
              gap: 16,
              padding: '14px 16px',
              background: '#fff',
              borderRadius: 8,
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f7f8fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#171a1f'
                }}
              >
                {report.id}
              </span>
              <StatusChip status={report.status} />
            </div>
            <AvatarName name={report.employee} />
            <div style={{ fontSize: 14, color: '#171a1f', display: 'flex', alignItems: 'center' }}>
              {report.asset}
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#6b7280',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {report.date}
            </div>
            <RowActions />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// GATEPASS REGISTER SEARCH
// ============================================================================

function GatepassRegisterSearch() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 16,
        padding: 24
      }}
    >
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#171a1f', margin: 0, marginBottom: 4 }}>
        Gatepass Register
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0, marginBottom: 16 }}>
        Search and filter all generated gatepasses
      </p>
      <div style={{ position: 'relative' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6b7280'
          }}
        />
        <input
          type="text"
          placeholder="Search all generated gatepasses…"
          style={{
            width: '100%',
            height: 44,
            padding: '0 16px 0 44px',
            border: '1px solid #e7e9ec',
            borderRadius: 10,
            fontSize: 14,
            color: '#171a1f',
            background: '#fff',
            fontFamily: 'Public Sans, sans-serif',
            outline: 'none',
            transition: 'all 0.15s'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e7e9ec';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN GATEPASS SCREEN
// ============================================================================

export default function GatepassScreen() {
  const [tab, setTab] = useState<TabType>('active');

  return (
    <div style={{ padding: '30px', background: '#f7f8fa', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <WorkspaceHeader />
      <ScanBanner />
      <KpiCards data={kpis} />
      <QuickActions />
      <ReportRegister reports={reports} />
      <GatepassRegisterSearch />
    </div>
  );
}
