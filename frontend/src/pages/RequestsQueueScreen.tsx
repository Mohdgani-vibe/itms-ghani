import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Package, HardDrive, Shield, ClipboardList, LogOut,
  Search, Settings, Bell, Plus, ChevronRight, List, Grid3x3,
  Laptop, RefreshCw, Download, Key, Wrench, HelpCircle,
  AlertCircle, Activity, Eye, Filter
} from 'lucide-react';
import { fetchRequests } from '../lib/requestsApi';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type TabType = 'queue' | 'approved' | 'rejected';
type ViewType = 'list' | 'table';
type RequestType = 'Laptop change' | 'OS reinstall' | 'Software install' | 'Portal access' | 'Settings change' | 'General IT';
type Priority = 'High' | 'Medium' | 'Low';
type Status = 'Open' | 'In progress' | 'Needs review' | 'Unassigned' | 'Approved' | 'Rejected';

interface Request {
  id: string;
  title: string;
  type: RequestType;
  requester: string;
  assignee: string | null;
  status: Status;
  priority: Priority;
  updated: string;
  queue: TabType;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const requestsData: Request[] = [
  {
    id: 'REQ-1042',
    title: 'MacBook battery swelling — replace unit',
    type: 'Laptop change',
    requester: 'Rohit Sharma',
    assignee: 'Ananya Mehta',
    status: 'In progress',
    priority: 'High',
    updated: '12m ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1041',
    title: 'Install Ubuntu 22.04 on development workstation',
    type: 'OS reinstall',
    requester: 'Priya Patel',
    assignee: 'Vikram Singh',
    status: 'Open',
    priority: 'Medium',
    updated: '28m ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1040',
    title: 'Adobe Creative Cloud license for design team',
    type: 'Software install',
    requester: 'Amit Kumar',
    assignee: null,
    status: 'Unassigned',
    priority: 'Low',
    updated: '1h ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1039',
    title: 'Grant VPN access for remote employee',
    type: 'Portal access',
    requester: 'Neha Gupta',
    assignee: 'Rajesh Iyer',
    status: 'Needs review',
    priority: 'High',
    updated: '2h ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1038',
    title: 'Change default browser to Chrome company-wide',
    type: 'Settings change',
    requester: 'Sanjay Reddy',
    assignee: 'Ananya Mehta',
    status: 'In progress',
    priority: 'Low',
    updated: '3h ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1037',
    title: 'Network printer not responding on 3rd floor',
    type: 'General IT',
    requester: 'Kavita Desai',
    assignee: null,
    status: 'Unassigned',
    priority: 'Medium',
    updated: '4h ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1036',
    title: 'Dell monitor replacement for cracked screen',
    type: 'Laptop change',
    requester: 'Arjun Nair',
    assignee: 'Vikram Singh',
    status: 'Open',
    priority: 'High',
    updated: '5h ago',
    queue: 'queue'
  },
  {
    id: 'REQ-1035',
    title: 'Upgrade RAM to 32GB for video editing machine',
    type: 'Laptop change',
    requester: 'Deepa Singh',
    assignee: 'Ananya Mehta',
    status: 'Approved',
    priority: 'Medium',
    updated: '1d ago',
    queue: 'approved'
  },
  {
    id: 'REQ-1034',
    title: 'Install Python 3.11 and data science libraries',
    type: 'Software install',
    requester: 'Karan Joshi',
    assignee: 'Rajesh Iyer',
    status: 'Approved',
    priority: 'Low',
    updated: '1d ago',
    queue: 'approved'
  },
  {
    id: 'REQ-1033',
    title: 'MacBook Pro keyboard replacement',
    type: 'Laptop change',
    requester: 'Simran Kaur',
    assignee: 'Vikram Singh',
    status: 'Approved',
    priority: 'Medium',
    updated: '2d ago',
    queue: 'approved'
  },
  {
    id: 'REQ-1032',
    title: 'Windows 11 downgrade to Windows 10',
    type: 'OS reinstall',
    requester: 'Manish Verma',
    assignee: null,
    status: 'Rejected',
    priority: 'Low',
    updated: '2d ago',
    queue: 'rejected'
  },
  {
    id: 'REQ-1031',
    title: 'Personal software installation request',
    type: 'Software install',
    requester: 'Ritu Sharma',
    assignee: 'Ananya Mehta',
    status: 'Rejected',
    priority: 'Low',
    updated: '3d ago',
    queue: 'rejected'
  }
];

// ============================================================================
// CONFIGURATION MAPS
// ============================================================================

const typeConfig: Record<RequestType, { icon: any; bg: string; fg: string }> = {
  'Laptop change': { icon: Laptop, bg: '#eef2ff', fg: '#2563eb' },
  'OS reinstall': { icon: RefreshCw, bg: '#f3edfd', fg: '#7c3aed' },
  'Software install': { icon: Download, bg: '#eaf6ef', fg: '#0f9d63' },
  'Portal access': { icon: Key, bg: '#fef3e7', fg: '#d97706' },
  'Settings change': { icon: Wrench, bg: '#f7f8fa', fg: '#6b7280' },
  'General IT': { icon: HelpCircle, bg: '#fdeef1', fg: '#e11d48' }
};

const priorityConfig: Record<Priority, { bg: string; fg: string }> = {
  High: { bg: '#fef2f2', fg: '#dc2626' },
  Medium: { bg: '#fef3e7', fg: '#d97706' },
  Low: { bg: '#f7f8fa', fg: '#6b7280' }
};

const statusConfig: Record<Status, { bg: string; fg: string; dot: string }> = {
  Open: { bg: '#eef2ff', fg: '#2563eb', dot: '#2563eb' },
  'In progress': { bg: '#f3edfd', fg: '#7c3aed', dot: '#7c3aed' },
  'Needs review': { bg: '#fef3e7', fg: '#d97706', dot: '#d97706' },
  Unassigned: { bg: '#f7f8fa', fg: '#6b7280', dot: '#9aa1ab' },
  Approved: { bg: '#eaf6ef', fg: '#0f9d63', dot: '#0f9d63' },
  Rejected: { bg: '#fef2f2', fg: '#dc2626', dot: '#dc2626' }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// TOP BAR COMPONENT
// ============================================================================

function TopBar({ tab, setTab, counts }: { tab: TabType; setTab: (t: TabType) => void; counts: Record<TabType, number> }) {
  const tabs: Array<{ id: TabType; icon: any; label: string }> = [
    { id: 'queue', icon: ClipboardList, label: 'Queue' },
    { id: 'approved', icon: Activity, label: 'Approved' },
    { id: 'rejected', icon: AlertCircle, label: 'Rejected' }
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

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginLeft: 20 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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
              <span>{t.label}</span>
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
                {counts[t.id]}
              </div>
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
    { icon: Shield, label: 'Security' },
    { icon: ClipboardList, label: 'Requests', active: true },
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

function WorkspaceHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Requests</span>
          <ChevronRight size={14} color="#9aa1ab" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#171a1f' }}>Queue</span>
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
          Request queue
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Manage and triage incoming IT support requests across all departments.
        </p>
      </div>
      <button
        onClick={onCreate}
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
        <Plus size={16} />
        <span>Create Request</span>
      </button>
    </div>
  );
}

// ============================================================================
// KPI ROW COMPONENT
// ============================================================================

function KpiRow({ requests, filteredCount }: { requests: Request[]; filteredCount: number }) {
  const unassigned = requests.filter((r) => r.assignee === null).length;
  const activeToday = requests.filter((r) => r.updated.includes('m ago') || r.updated.includes('h ago')).length;
  const needsReview = requests.filter((r) => r.status === 'Needs review').length;

  const kpis = [
    { label: 'UNASSIGNED', value: unassigned, icon: AlertCircle, bg: '#fdeef1', fg: '#e11d48' },
    { label: 'ACTIVE TODAY', value: activeToday, icon: Activity, bg: '#eef2ff', fg: '#2563eb' },
    { label: 'NEEDS REVIEW', value: needsReview, icon: Eye, bg: '#fef3e7', fg: '#d97706', valueColor: '#d97706' },
    { label: 'FILTERED VIEW', value: filteredCount, icon: Filter, bg: '#eaf6ef', fg: '#0f9d63' }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}
    >
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            style={{
              background: '#fff',
              border: '1px solid #e7e9ec',
              borderRadius: 10,
              padding: 18,
              position: 'relative'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 8,
                background: kpi.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: kpi.fg
              }}
            >
              <Icon size={16} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.6, marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: kpi.valueColor || '#171a1f',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 4
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {idx === 0 && 'Awaiting assignment'}
              {idx === 1 && 'Updated within 24h'}
              {idx === 2 && 'Pending approval'}
              {idx === 3 && 'Matches current filter'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// FILTER BAR COMPONENT
// ============================================================================

function FilterBar({
  query,
  setQuery,
  view,
  setView
}: {
  query: string;
  setQuery: (q: string) => void;
  view: ViewType;
  setView: (v: ViewType) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Search size={18} color="#9aa1ab" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search requests by ID, title, type, or person..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            height: 40,
            paddingLeft: 40,
            paddingRight: 14,
            border: '1px solid #e7e9ec',
            borderRadius: 8,
            fontSize: 14,
            color: '#171a1f',
            background: '#fff',
            fontFamily: 'Public Sans, sans-serif',
            outline: 'none'
          }}
        />
      </div>
      <select
        style={{
          height: 40,
          padding: '0 36px 0 14px',
          border: '1px solid #e7e9ec',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          color: '#171a1f',
          background: '#fff',
          cursor: 'pointer',
          fontFamily: 'Public Sans, sans-serif',
          outline: 'none'
        }}
      >
        <option>All request types</option>
        <option>Laptop change</option>
        <option>OS reinstall</option>
        <option>Software install</option>
        <option>Portal access</option>
        <option>Settings change</option>
        <option>General IT</option>
      </select>
      <select
        style={{
          height: 40,
          padding: '0 36px 0 14px',
          border: '1px solid #e7e9ec',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          color: '#171a1f',
          background: '#fff',
          cursor: 'pointer',
          fontFamily: 'Public Sans, sans-serif',
          outline: 'none'
        }}
      >
        <option>All statuses</option>
        <option>Open</option>
        <option>In progress</option>
        <option>Needs review</option>
        <option>Unassigned</option>
      </select>
      <div
        style={{
          display: 'flex',
          padding: 4,
          background: '#f7f8fa',
          borderRadius: 8,
          gap: 4
        }}
      >
        <button
          onClick={() => setView('list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 32,
            background: view === 'list' ? '#fff' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: view === 'list' ? '#171a1f' : '#6b7280',
            cursor: 'pointer',
            boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s'
          }}
        >
          <List size={18} />
        </button>
        <button
          onClick={() => setView('table')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 32,
            background: view === 'table' ? '#fff' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: view === 'table' ? '#171a1f' : '#6b7280',
            cursor: 'pointer',
            boxShadow: view === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s'
          }}
        >
          <Grid3x3 size={18} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: '8px 16px',
          border: '1px solid #e7e9ec',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          color: '#6b7280',
          letterSpacing: 0.8,
          marginBottom: 16
        }}
      >
        QUEUE EMPTY
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#171a1f', marginBottom: 8 }}>
        No requests match this view
      </div>
      <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 400 }}>
        Try adjusting your filters or search query, or switch to a different tab to see more requests.
      </div>
    </div>
  );
}

// ============================================================================
// REQUEST ROW COMPONENT
// ============================================================================

function RequestRow({ request }: { request: Request }) {
  const typeConf = typeConfig[request.type];
  const TypeIcon = typeConf.icon;
  const priorityConf = priorityConfig[request.priority];
  const statusConf = statusConfig[request.status];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 1.3fr 130px 110px 96px 28px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid #edeef1',
        cursor: 'pointer',
        transition: 'background 0.15s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f7f8fa';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Type icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: typeConf.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: typeConf.fg
        }}
      >
        <TypeIcon size={20} />
      </div>

      {/* ID + Priority over Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#171a1f',
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {request.id}
          </span>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: priorityConf.bg,
              fontSize: 11,
              fontWeight: 600,
              color: priorityConf.fg
            }}
          >
            {request.priority}
          </div>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#171a1f',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {request.title}
        </div>
      </div>

      {/* Type + Requester */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa1ab', letterSpacing: 0.6, marginBottom: 3 }}>
          {request.type.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {request.requester}
        </div>
      </div>

      {/* Assignee */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {request.assignee ? (
          <>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff'
              }}
            >
              {getInitials(request.assignee)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#171a1f' }}>
              {request.assignee}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, fontStyle: 'italic', color: '#9aa1ab' }}>
            Unassigned
          </span>
        )}
      </div>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 6,
          background: statusConf.bg
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusConf.dot
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: statusConf.fg }}>
          {request.status}
        </span>
      </div>

      {/* Updated */}
      <div
        style={{
          fontSize: 13,
          color: '#9aa1ab',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {request.updated}
      </div>

      {/* Chevron */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ChevronRight size={18} color="#9aa1ab" />
      </div>
    </div>
  );
}

// ============================================================================
// QUEUE LIST COMPONENT
// ============================================================================

function QueueList({ requests, tab }: { requests: Request[]; tab: TabType }) {
  const tabLabels: Record<TabType, string> = {
    queue: 'Queue',
    approved: 'Approved',
    rejected: 'Rejected'
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 12,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #edeef1'
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#171a1f' }}>
          {tabLabels[tab]} · {requests.length} request{requests.length !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Showing all {tab} requests
        </div>
      </div>

      {/* Rows */}
      {requests.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {requests.map((req) => (
            <RequestRow key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RequestsQueueScreen() {
  const [tab, setTab] = useState<TabType>('queue');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewType>('list');
  const [requestsData, setRequestsData] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchRequests({ page: 1, page_size: 100 });
      
      // Map API response to local Request format
      // Backend nests requester/assignee in objects
      const transformedData: Request[] = response.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        type: item.type as RequestType,
        requester: item.requester?.fullName || item.requester_name || 'Unknown',
        assignee: item.assignee?.fullName || item.assignee_name || null,
        status: item.status as Status,
        priority: item.priority || 'Medium' as Priority,
        updated: formatTimestamp(item.updated_at || item.updatedAt),
        queue: (item.status === 'resolved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'queue') as TabType
      }));
      
      setRequestsData(transformedData);
    } catch (err: any) {
      console.error('Failed to load requests:', err);
      setError(err.message || 'Failed to load requests data');
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  // Calculate counts per tab
  const counts = useMemo(() => {
    const result: Record<TabType, number> = { queue: 0, approved: 0, rejected: 0 };
    requestsData.forEach((req) => {
      result[req.queue]++;
    });
    return result;
  }, [requestsData]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requestsData
      .filter((req) => req.queue === tab)
      .filter((req) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          req.id.toLowerCase().includes(q) ||
          req.title.toLowerCase().includes(q) ||
          req.type.toLowerCase().includes(q) ||
          req.requester.toLowerCase().includes(q) ||
          req.assignee?.toLowerCase().includes(q)
        );
      });
  }, [tab, query]);

  const handleCreate = () => {
    console.log('Create request clicked');
  };

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
      <TopBar tab={tab} setTab={setTab} counts={counts} />

      <div style={{ display: 'flex', flex: 1 }}>
        <IconRail />

        <main
          style={{
            flex: 1,
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          <WorkspaceHeader onCreate={handleCreate} />
          
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ fontSize: 15, color: '#6b7280' }}>Loading requests...</div>
            </div>
          )}
          
          {error && (
            <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Error loading requests</div>
              <div style={{ fontSize: 13, color: '#991b1b' }}>{error}</div>
            </div>
          )}
          
          {!loading && !error && (
            <>
              <KpiRow requests={requestsData.filter((r) => r.queue === tab)} filteredCount={filteredRequests.length} />
              <FilterBar query={query} setQuery={setQuery} view={view} setView={setView} />
              <QueueList requests={filteredRequests} tab={tab} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
