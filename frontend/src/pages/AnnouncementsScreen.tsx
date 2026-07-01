import { useState } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Settings,
  Bell,
  ChevronRight,
  Users,
  FileText,
  PlusCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// DATA & TYPES
// ============================================================================

interface Post {
  id: string;
  title: string;
  audience: string;
  time: string;
  urgent: boolean;
  age: 'recent' | 'older';
  date: string;
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    title: 'Scheduled VPN maintenance tonight 11:00 PM',
    audience: 'IT Team',
    time: '20m ago',
    urgent: true,
    age: 'recent',
    date: 'Jul 1, 2026'
  },
  {
    id: '2',
    title: 'Q2 Performance reviews start next Monday',
    audience: 'All Employees',
    time: '1h ago',
    urgent: false,
    age: 'recent',
    date: 'Jul 1, 2026'
  },
  {
    id: '3',
    title: 'New security policy updates - Action required',
    audience: 'All Employees',
    time: '3h ago',
    urgent: true,
    age: 'recent',
    date: 'Jul 1, 2026'
  },
  {
    id: '4',
    title: 'Server room temperature monitoring upgrade',
    audience: 'IT Team',
    time: '5h ago',
    urgent: false,
    age: 'recent',
    date: 'Jul 1, 2026'
  },
  {
    id: '5',
    title: 'Emergency patch deployment completed successfully',
    audience: 'Admin',
    time: '2 days ago',
    urgent: true,
    age: 'older',
    date: 'Jun 29, 2026'
  },
  {
    id: '6',
    title: 'Annual compliance audit scheduled for July 15',
    audience: 'Audit',
    time: '3 days ago',
    urgent: false,
    age: 'older',
    date: 'Jun 28, 2026'
  },
  {
    id: '7',
    title: 'New asset tracking system rollout',
    audience: 'All Employees',
    time: '5 days ago',
    urgent: false,
    age: 'older',
    date: 'Jun 26, 2026'
  },
  {
    id: '8',
    title: 'Database migration window - July 10',
    audience: 'IT Team',
    time: '1 week ago',
    urgent: false,
    age: 'older',
    date: 'Jun 24, 2026'
  }
];

const AUDIENCES = ['All', 'All Employees', 'IT Team', 'Admin', 'Audit', 'Super Admin'];

// ============================================================================
// TOP BAR COMPONENT
// ============================================================================

interface TopBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function TopBar({ activeTab, onTabChange }: TopBarProps) {
  const tabs = [
    { id: 'all', label: 'All', icon: FileText },
    { id: 'urgent', label: 'Urgent', icon: AlertCircle },
    { id: 'create', label: 'Create', icon: Plus }
  ];

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        borderBottom: '1px solid #e7e9ec',
        height: 58
      }}
    >
      <div
        style={{
          height: '100%',
          padding: '0 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                position: 'relative',
                width: 32,
                height: 32,
                background: '#2563eb',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800
              }}
            >
              IT
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  background: '#dc2626',
                  borderRadius: '50%',
                  border: '2px solid #fff'
                }}
              />
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: '#6b7280' }}>
              IT MANAGEMENT SYSTEM · POWERED BY ZERODHA
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  background: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#2563eb' : '#6b7280',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f7f8fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            style={{
              width: 36,
              height: 36,
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f7f8fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Search size={18} />
          </button>
          <button
            style={{
              width: 36,
              height: 36,
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f7f8fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Settings size={18} />
          </button>
          <button
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f7f8fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
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
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: '#f7f8fa',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#171a1f'
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700
              }}
            >
              SA
            </div>
            super_admin
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HERO COMPONENT
// ============================================================================

function Hero() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
        <span>Announcements</span>
        <ChevronRight size={14} />
        <span style={{ color: '#171a1f', fontWeight: 600 }}>All</span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: '#eef2ff',
            color: '#2563eb',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            width: 'fit-content'
          }}
        >
          <Megaphone size={14} />
          BROADCAST CENTER
        </div>
        <h1
          style={{
            fontSize: 27,
            fontWeight: 800,
            color: '#171a1f',
            margin: 0,
            maxWidth: 720,
            lineHeight: 1.3
          }}
        >
          Company announcements with a clearer broadcast view.
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0, maxWidth: 680 }}>
          Create, manage, and track company-wide announcements. Mark urgent posts for immediate
          attention and target specific audience segments.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// KPI ROW COMPONENT
// ============================================================================

interface KpiRowProps {
  visibleNow: number;
  urgentCount: number;
  audienceLabel: string;
}

function KpiRow({ visibleNow, urgentCount, audienceLabel }: KpiRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}
    >
      {/* Visible Now */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e7e9ec',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#6b7280' }}>
          VISIBLE NOW
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#171a1f',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {visibleNow}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Announcements in the current feed</div>
      </div>

      {/* Urgent */}
      <div
        style={{
          background: '#fffdf7',
          border: '1px solid #f3e0b5',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#6b7280' }}>
          URGENT
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#d97706',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {urgentCount}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Posts marked for immediate attention</div>
      </div>

      {/* Audience */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e7e9ec',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#6b7280' }}>
          AUDIENCE
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#171a1f',
            lineHeight: 1.3
          }}
        >
          {audienceLabel}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Current broadcast segment</div>
      </div>
    </div>
  );
}

// ============================================================================
// URGENT CHECKBOX COMPONENT
// ============================================================================

interface UrgentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function UrgentCheckbox({ checked, onChange }: UrgentCheckboxProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `2px solid ${checked ? '#2563eb' : '#e7e9ec'}`,
          background: checked ? '#2563eb' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s'
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M10 3L4.5 8.5L2 6"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <span style={{ fontSize: 14, fontWeight: 600, color: '#171a1f' }}>Mark as urgent</span>
    </label>
  );
}

// ============================================================================
// NEW ANNOUNCEMENT FORM COMPONENT
// ============================================================================

interface NewAnnouncementFormProps {
  urgent: boolean;
  onUrgentChange: (urgent: boolean) => void;
}

function NewAnnouncementForm({ urgent, onUrgentChange }: NewAnnouncementFormProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: '#eef2ff',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}
          >
            <Plus size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: '#171a1f', margin: 0 }}>
              New announcement
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0, marginTop: 2 }}>
              Compose and publish to your selected audience
            </p>
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            background: '#f7f8fa',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
            color: '#6b7280'
          }}
        >
          PUBLISH PANEL
        </div>
      </div>

      {/* Form grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: 12,
          alignItems: 'start'
        }}
      >
        <input
          type="text"
          placeholder="Announcement title..."
          style={{
            width: '100%',
            height: 44,
            padding: '0 16px',
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
        <select
          style={{
            width: '100%',
            height: 44,
            padding: '0 16px',
            border: '1px solid #e7e9ec',
            borderRadius: 10,
            fontSize: 14,
            color: '#171a1f',
            background: '#fff',
            fontFamily: 'Public Sans, sans-serif',
            outline: 'none',
            cursor: 'pointer',
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
        >
          <option>All Employees</option>
          <option>IT Team</option>
          <option>Admin</option>
          <option>Audit</option>
          <option>Super Admin</option>
        </select>
      </div>

      {/* Body textarea */}
      <textarea
        placeholder="Write your announcement message here..."
        style={{
          width: '100%',
          minHeight: 120,
          padding: 16,
          border: '1px solid #e7e9ec',
          borderRadius: 10,
          fontSize: 14,
          color: '#171a1f',
          background: '#fff',
          fontFamily: 'Public Sans, sans-serif',
          outline: 'none',
          resize: 'vertical',
          lineHeight: 1.6,
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

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <UrgentCheckbox checked={urgent} onChange={onUrgentChange} />
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
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
          <PlusCircle size={18} />
          Post Announcement
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// FILTER CHIP COMPONENT
// ============================================================================

interface FilterChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: selected ? '#eef2ff' : '#fff',
        color: selected ? '#2563eb' : '#6b7280',
        border: `1px solid ${selected ? '#2563eb' : '#e7e9ec'}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#2563eb';
          e.currentTarget.style.color = '#2563eb';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#e7e9ec';
          e.currentTarget.style.color = '#6b7280';
        }
      }}
    >
      {label}
    </button>
  );
}

// ============================================================================
// AUDIENCE FILTERS COMPONENT
// ============================================================================

interface AudienceFiltersProps {
  selected: string;
  onSelect: (audience: string) => void;
}

function AudienceFilters({ selected, onSelect }: AudienceFiltersProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#6b7280' }}>
        AUDIENCE FILTERS
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {AUDIENCES.map((audience) => (
          <FilterChip
            key={audience}
            label={audience}
            selected={selected === audience}
            onClick={() => onSelect(audience)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TAG CHIP COMPONENT
// ============================================================================

interface TagChipProps {
  label: string;
  urgent: boolean;
  onDark?: boolean;
}

function TagChip({ label, urgent, onDark = false }: TagChipProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        background: onDark
          ? urgent
            ? 'rgba(217, 119, 6, 0.15)'
            : 'rgba(37, 99, 235, 0.15)'
          : urgent
          ? '#fff4e6'
          : '#eef2ff',
        color: onDark
          ? urgent
            ? '#fbbf24'
            : '#60a5fa'
          : urgent
          ? '#d97706'
          : '#2563eb',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.6
      }}
    >
      {label}
    </span>
  );
}

// ============================================================================
// FEED ITEM COMPONENT
// ============================================================================

interface FeedItemProps {
  post: Post;
}

function FeedItem({ post }: FeedItemProps) {
  const itemId = `feed-item-${post.id}`;
  
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}
    >
      {/* Super aggressive CSS override for white text */}
      <style dangerouslySetInnerHTML={{ __html: `
        #${itemId} .feed-title {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-fill-color: #ffffff !important;
          background-color: transparent !important;
          background-image: none !important;
          background-clip: border-box !important;
          -webkit-background-clip: border-box !important;
        }
        #${itemId} .feed-title::before,
        #${itemId} .feed-title::after {
          color: #ffffff !important;
        }
      `}} />
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <TagChip label={post.urgent ? 'URGENT' : 'BROADCAST'} urgent={post.urgent} onDark />
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Clock size={12} />
          {post.time}
        </div>
      </div>

      {/* Title */}
      <div 
        id={itemId}
        className="feed-title"
        style={{ 
          fontSize: 15, 
          fontWeight: 600, 
          color: '#ffffff',
          WebkitTextFillColor: '#ffffff',
          textShadow: 'none',
          lineHeight: 1.4,
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          backgroundClip: 'border-box',
          WebkitBackgroundClip: 'border-box'
        } as any}
      >
        {post.title}
      </div>

      {/* Audience */}
      <div style={{ fontSize: 13, color: 'rgba(147, 197, 253, 0.8)' }}>{post.audience}</div>
    </div>
  );
}

// ============================================================================
// BROADCAST PULSE COMPONENT
// ============================================================================

interface BroadcastPulseProps {
  posts: Post[];
}

function BroadcastPulse({ posts }: BroadcastPulseProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(150deg, #101623, #1c2740)',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}
    >
      {/* Super aggressive CSS override for white text */}
      <style dangerouslySetInnerHTML={{ __html: `
        #broadcast-pulse-title {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-fill-color: #ffffff !important;
          background-color: transparent !important;
          background-image: none !important;
          background-clip: border-box !important;
          -webkit-background-clip: border-box !important;
        }
        #broadcast-pulse-title::before,
        #broadcast-pulse-title::after {
          color: #ffffff !important;
        }
      `}} />
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: 8
            }}
          >
            LIVE FEED
          </div>
          <h2
            id="broadcast-pulse-title"
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: '#ffffff',
              WebkitTextFillColor: '#ffffff',
              textShadow: 'none',
              margin: 0,
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              backgroundClip: 'border-box',
              WebkitBackgroundClip: 'border-box'
            } as any}
          >
            Broadcast pulse
          </h2>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            background: 'rgba(37, 99, 235, 0.15)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa'
          }}
        >
          <Bell size={18} />
        </div>
      </div>

      {/* Feed items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: 14
            }}
          >
            No recent announcements
          </div>
        ) : (
          posts.map((post) => <FeedItem key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY ROW COMPONENT
// ============================================================================

interface HistoryRowProps {
  post: Post;
  isFirst: boolean;
}

function HistoryRow({ post, isFirst }: HistoryRowProps) {
  return (
    <div
      style={{
        paddingTop: isFirst ? 0 : 16,
        borderTop: isFirst ? 'none' : '1px solid #f2f3f5',
        display: 'flex',
        gap: 14
      }}
    >
      {/* Dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: post.urgent ? '#d97706' : '#9aa1ab',
          marginTop: 6,
          flexShrink: 0
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#171a1f', lineHeight: 1.4 }}>
          {post.title}
        </div>
        <div style={{ fontSize: 13, color: '#9aa1ab' }}>
          {post.audience} · {post.date}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY TIMELINE COMPONENT
// ============================================================================

interface HistoryTimelineProps {
  posts: Post[];
}

function HistoryTimeline({ posts }: HistoryTimelineProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e7e9ec',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: '#6b7280',
            marginBottom: 8
          }}
        >
          ANNOUNCEMENT HISTORY
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#171a1f', margin: 0, marginBottom: 4 }}>
          Older announcements
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Previously published broadcasts and notices
        </p>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {posts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9aa1ab', fontSize: 14 }}>
            No older announcements
          </div>
        ) : (
          posts.map((post, idx) => <HistoryRow key={post.id} post={post} isFirst={idx === 0} />)
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnnouncementsScreen() {
  const [tab, setTab] = useState('all');
  const [filter, setFilter] = useState('All');
  const [urgent, setUrgent] = useState(false);

  // Filter posts
  const filteredPosts = MOCK_POSTS.filter((post) => {
    // Audience filter
    if (filter !== 'All' && post.audience !== filter) return false;
    // Urgent tab filter
    if (tab === 'urgent' && !post.urgent) return false;
    return true;
  });

  // Derive metrics
  const visibleNow = filteredPosts.length;
  const urgentCount = filteredPosts.filter((p) => p.urgent).length;
  const audienceLabel = filter === 'All' ? 'All visible audiences' : filter;

  // Split by age
  const recentPosts = filteredPosts.filter((p) => p.age === 'recent');
  const olderPosts = filteredPosts.filter((p) => p.age === 'older');

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', fontFamily: 'Public Sans, sans-serif' }}>
      <TopBar activeTab={tab} onTabChange={setTab} />

      {/* Workspace */}
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '30px 30px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}
      >
        <Hero />

        {/* Main grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 20,
            alignItems: 'start'
          }}
          className="announcements-grid"
        >
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <KpiRow visibleNow={visibleNow} urgentCount={urgentCount} audienceLabel={audienceLabel} />
            {tab === 'create' && <NewAnnouncementForm urgent={urgent} onUrgentChange={setUrgent} />}
            <AudienceFilters selected={filter} onSelect={setFilter} />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <BroadcastPulse posts={recentPosts} />
            <HistoryTimeline posts={olderPosts} />
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .announcements-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
