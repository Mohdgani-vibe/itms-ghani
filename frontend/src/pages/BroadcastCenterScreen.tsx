import { useState } from 'react';
import { Search, Settings, Bell, ChevronDown, Users, HardDrive, Database, AlertCircle, FileText, LogOut } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Announcement {
  id: number;
  isUrgent: boolean;
  title: string;
  preview: string;
  audience: string;
  time: string;
  author: string;
}

interface HistoryItem {
  id: number;
  title: string;
  source: string;
  date: string;
  isUrgent: boolean;
}

interface BroadcastCenterProps {
  density?: 'compact' | 'spacious';
  pulseTone?: 'dark' | 'light';
  showTimestamps?: boolean;
}

// ============================================================================
// SEED DATA
// ============================================================================

const ANNOUNCEMENTS: Announcement[] = [
  { id: 1, isUrgent: true, title: "Scheduled VPN maintenance tonight, 11:00 PM", preview: "VPN services will be temporarily unavailable during maintenance window", audience: "IT Team", time: "20m ago", author: "IT Team" },
  { id: 2, isUrgent: false, title: "Q2 performance reviews start next Monday", preview: "Please complete your self-assessment forms by Friday", audience: "All Employees", time: "1h ago", author: "People Ops" },
  { id: 3, isUrgent: true, title: "New security policy updates — action required", preview: "All employees must acknowledge the updated security policies", audience: "All Employees", time: "3h ago", author: "Security" },
  { id: 4, isUrgent: false, title: "Server room temperature monitoring upgrade", preview: "Enhanced monitoring system installation this week", audience: "IT Team", time: "5h ago", author: "Infrastructure" },
  { id: 5, isUrgent: false, title: "Office Wi-Fi network upgrade this weekend", preview: "Expect brief connectivity interruptions on Saturday morning", audience: "All Employees", time: "8h ago", author: "IT Team" },
  { id: 6, isUrgent: false, title: "New laptop request portal is now live", preview: "Submit hardware requests through the updated portal", audience: "All Employees", time: "1d ago", author: "IT Team" },
  { id: 7, isUrgent: true, title: "Phishing campaign detected — do not click", preview: "Be vigilant about suspicious emails claiming to be from IT", audience: "All Employees", time: "1d ago", author: "Security" },
  { id: 8, isUrgent: false, title: "Quarterly asset audit begins Monday", preview: "Asset verification process starts next week", audience: "Audit", time: "2d ago", author: "Audit" }
];

const PULSE_ITEMS = ANNOUNCEMENTS.slice(0, 4);

const HISTORY: HistoryItem[] = [
  { id: 1, title: "Emergency patch deployment completed successfully", source: "Admin", date: "Jun 29, 2026", isUrgent: true },
  { id: 2, title: "Annual compliance audit scheduled for July 15", source: "Audit", date: "Jun 28, 2026", isUrgent: false },
  { id: 3, title: "New asset tracking system rollout", source: "All Employees", date: "Jun 26, 2026", isUrgent: false },
  { id: 4, title: "Database migration window — July 10", source: "IT Team", date: "Jun 24, 2026", isUrgent: false }
];

const AUDIENCES = ['All', 'All Employees', 'IT Team', 'Admin', 'Audit', 'Super Admin'];

// ============================================================================
// ICON RAIL COMPONENT
// ============================================================================

function IconRail() {
  return (
    <div style={{
      width: 56,
      height: '100vh',
      position: 'sticky',
      top: 0,
      left: 0,
      background: '#fff',
      borderRight: '1px solid #e8e4dc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 14
    }}>
      {/* Logo tile */}
      <div style={{
        position: 'relative',
        width: 38,
        height: 38,
        background: '#16223f',
        borderRadius: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 16
      }}>
        IT
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 12,
          height: 12,
          background: '#f0a742',
          borderRadius: 3,
          fontSize: 8,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>z</div>
      </div>

      {/* Divider */}
      <div style={{ width: 28, height: 1, background: '#e8e4dc', marginBottom: 12 }} />

      {/* Navigation icons */}
      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: '#eaeefb',
        color: '#23315d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: 8
      }}>
        <Users size={20} />
      </button>

      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: '#9aa0ad',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: 8,
        transition: 'background 0.2s'
      }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <HardDrive size={20} />
      </button>

      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: '#9aa0ad',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: 8,
        transition: 'background 0.2s'
      }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Database size={20} />
      </button>

      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: '#9aa0ad',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: 8,
        transition: 'background 0.2s'
      }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <AlertCircle size={20} />
      </button>

      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: '#9aa0ad',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <FileText size={20} />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sign out */}
      <button style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: '#9aa0ad',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <LogOut size={20} />
      </button>
    </div>
  );
}

// ============================================================================
// TOP HEADER COMPONENT
// ============================================================================

interface TopHeaderProps {
  tab: string;
  onTabChange: (tab: string) => void;
}

function TopHeader({ tab, onTabChange }: TopHeaderProps) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      height: 58,
      background: 'rgba(246,244,239,.86)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e8e4dc',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 24,
      zIndex: 100
    }}>
      {/* Logo section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          position: 'relative',
          width: 32,
          height: 32,
          background: '#16223f',
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700
        }}>
          IT
          <div style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 10,
            height: 10,
            background: '#f0a742',
            borderRadius: 2,
            fontSize: 7,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>z</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16223f', letterSpacing: 0.3 }}>
            IT MANAGEMENT SYSTEM
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 500, color: '#8b90a0', letterSpacing: 0.5 }}>
            POWERED BY ZERODHA
          </div>
        </div>
      </div>

      {/* Center navigation */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        {/* Segmented control */}
        <div style={{
          display: 'flex',
          background: '#e8e4dc',
          borderRadius: 10,
          padding: 3
        }}>
          <button
            onClick={() => onTabChange('all')}
            style={{
              padding: '7px 18px',
              border: 'none',
              borderRadius: 8,
              background: tab === 'all' ? '#fff' : 'transparent',
              color: tab === 'all' ? '#16223f' : '#565d6d',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: tab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            All
          </button>
          <button
            onClick={() => onTabChange('urgent')}
            style={{
              padding: '7px 18px',
              border: 'none',
              borderRadius: 8,
              background: tab === 'urgent' ? '#fff' : 'transparent',
              color: tab === 'urgent' ? '#16223f' : '#565d6d',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: tab === 'urgent' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Urgent
          </button>
        </div>

        {/* Create button */}
        <button style={{
          padding: '8px 20px',
          border: 'none',
          borderRadius: 9,
          background: '#16223f',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s'
        }} onMouseEnter={(e) => e.currentTarget.style.background = '#23315d'}
           onMouseLeave={(e) => e.currentTarget.style.background = '#16223f'}>
          Create
        </button>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: '#8b90a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <Search size={18} />
        </button>
        <button style={{
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: '#8b90a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <Settings size={18} />
        </button>
        <button style={{
          position: 'relative',
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: '#8b90a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <Bell size={18} />
          <div style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#e07b39'
          }} />
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: '#e8e4dc', margin: '0 4px' }} />

        {/* User chip */}
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px 4px 4px',
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          cursor: 'pointer',
          transition: 'background 0.2s'
        }} onMouseEnter={(e) => e.currentTarget.style.background = '#f2f0ea'}
           onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: '#23315d',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600
          }}>
            SA
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#16223f' }}>super_admin</span>
          <ChevronDown size={14} color="#8b90a0" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HERO SECTION COMPONENT
// ============================================================================

interface HeroSectionProps {
  tab: string;
}

function HeroSection({ tab }: HeroSectionProps) {
  return (
    <div style={{ maxWidth: 660, marginBottom: 32 }}>
      {/* Breadcrumb */}
      <div style={{
        fontSize: 12.5,
        color: '#8b90a0',
        marginBottom: 18,
        fontWeight: 500
      }}>
        Announcements › {tab === 'urgent' ? 'Urgent' : 'All'}
      </div>

      {/* Badge */}
      <div style={{
        display: 'inline-block',
        padding: '5px 11px',
        background: '#e6e9f1',
        color: '#495875',
        borderRadius: 7,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: 0.8,
        marginBottom: 14
      }}>
        BROADCAST CENTER
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 31,
        fontWeight: 800,
        color: '#16223f',
        margin: '0 0 10px 0',
        lineHeight: 1.2
      }}>
        Company announcements with a clearer broadcast view.
      </h1>

      {/* Subtitle */}
      <p style={{
        fontSize: 14.5,
        color: '#5f6675',
        margin: 0,
        lineHeight: 1.6
      }}>
        Create, manage, and track company-wide announcements. Mark urgent posts for immediate attention and target specific audience segments.
      </p>
    </div>
  );
}

// ============================================================================
// STAT CARDS COMPONENT
// ============================================================================

interface StatCardsProps {
  visibleCount: number;
  urgentCount: number;
  audienceLabel: string;
}

function StatCards({ visibleCount, urgentCount, audienceLabel }: StatCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
      marginBottom: 22
    }}>
      {/* Visible Now */}
      <div style={{
        background: '#fff',
        border: '1px solid #e8e4dc',
        borderRadius: 14,
        padding: '18px 20px'
      }}>
        <div style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.8,
          color: '#8b90a0',
          marginBottom: 8
        }}>
          VISIBLE NOW
        </div>
        <div style={{
          fontSize: 30,
          fontWeight: 800,
          color: '#16223f',
          marginBottom: 4
        }}>
          {visibleCount}
        </div>
        <div style={{
          fontSize: 12.5,
          color: '#9aa0ad'
        }}>
          Announcements in the current feed
        </div>
      </div>

      {/* Urgent */}
      <div style={{
        background: '#fbf5e6',
        border: '1px solid #efe4c6',
        borderLeft: '3px solid #d99a2b',
        borderRadius: 14,
        padding: '18px 20px'
      }}>
        <div style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.8,
          color: '#8a6416',
          marginBottom: 8
        }}>
          URGENT
        </div>
        <div style={{
          fontSize: 30,
          fontWeight: 800,
          color: '#8a6416',
          marginBottom: 4
        }}>
          {urgentCount}
        </div>
        <div style={{
          fontSize: 12.5,
          color: '#98701c'
        }}>
          Posts marked for immediate attention
        </div>
      </div>

      {/* Audience */}
      <div style={{
        background: '#fff',
        border: '1px solid #e8e4dc',
        borderRadius: 14,
        padding: '18px 20px'
      }}>
        <div style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.8,
          color: '#8b90a0',
          marginBottom: 8
        }}>
          AUDIENCE
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#16223f',
          marginBottom: 4
        }}>
          {audienceLabel}
        </div>
        <div style={{
          fontSize: 12.5,
          color: '#9aa0ad'
        }}>
          Current broadcast segment
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AUDIENCE FILTERS COMPONENT
// ============================================================================

interface AudienceFiltersProps {
  audience: string;
  onAudienceChange: (audience: string) => void;
}

function AudienceFilters({ audience, onAudienceChange }: AudienceFiltersProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e4dc',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 28
    }}>
      <div style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: 0.8,
        color: '#8b90a0',
        marginBottom: 14
      }}>
        AUDIENCE FILTERS
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8
      }}>
        {AUDIENCES.map((aud) => (
          <button
            key={aud}
            onClick={() => onAudienceChange(aud)}
            style={{
              padding: '7px 14px',
              border: audience === aud ? '1px solid #c9d3f1' : '1px solid #e8e4dc',
              borderRadius: 9,
              background: audience === aud ? '#eaeefb' : '#fff',
              color: audience === aud ? '#23315d' : '#565d6d',
              fontSize: 13,
              fontWeight: audience === aud ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {aud}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ANNOUNCEMENT CARD COMPONENT
// ============================================================================

interface AnnouncementCardProps {
  announcement: Announcement;
  density: 'compact' | 'spacious';
  showTimestamps: boolean;
}

function AnnouncementCard({ announcement, density, showTimestamps }: AnnouncementCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const padding = density === 'compact' ? '13px 15px' : '17px 19px';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#fff',
        border: isHovered ? '1px solid #cfc9bd' : '1px solid #e8e4dc',
        borderRadius: 13,
        padding,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
      }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 9px',
          background: announcement.isUrgent ? '#f6ead0' : '#e6e9f1',
          color: announcement.isUrgent ? '#98701c' : '#495875',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6
        }}>
          {announcement.isUrgent ? 'URGENT' : 'BROADCAST'}
        </span>
        {showTimestamps && (
          <span style={{
            fontSize: 12,
            color: '#9aa0ad',
            fontWeight: 500
          }}>
            {announcement.time}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 15.5,
        fontWeight: 700,
        color: '#16223f',
        margin: '0 0 8px 0',
        lineHeight: 1.4
      }}>
        {announcement.title}
      </h3>

      {/* Preview */}
      <p style={{
        fontSize: 13,
        color: '#5f6675',
        margin: '0 0 12px 0',
        lineHeight: 1.5
      }}>
        {announcement.preview}
      </p>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
        color: '#8b90a0'
      }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          background: '#f6f4ef',
          borderRadius: 6,
          fontWeight: 500
        }}>
          {announcement.audience}
        </span>
        <span style={{ fontWeight: 500 }}>
          Posted by {announcement.author}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ANNOUNCEMENT FEED COMPONENT
// ============================================================================

interface AnnouncementFeedProps {
  announcements: Announcement[];
  tab: string;
  density: 'compact' | 'spacious';
  showTimestamps: boolean;
}

function AnnouncementFeed({ announcements, tab, density, showTimestamps }: AnnouncementFeedProps) {
  const heading = tab === 'urgent' ? 'Urgent announcements' : 'In the current feed';

  return (
    <div>
      {/* Feed header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#16223f',
          margin: 0
        }}>
          {heading}
        </h2>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#8b90a0'
        }}>
          {announcements.length} {announcements.length === 1 ? 'announcement' : 'announcements'}
        </span>
      </div>

      {/* Feed list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: density === 'compact' ? 10 : 14
      }}>
        {announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            density={density}
            showTimestamps={showTimestamps}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PULSE ITEM COMPONENT
// ============================================================================

interface PulseItemProps {
  announcement: Announcement;
  tone: 'dark' | 'light';
}

function PulseItem({ announcement, tone }: PulseItemProps) {
  const isDark = tone === 'dark';

  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.05)' : '#f9f8f6',
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8e4dc',
      borderRadius: 10,
      padding: '12px 14px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 8px',
          background: announcement.isUrgent 
            ? (isDark ? 'rgba(246,234,208,0.15)' : '#f6ead0')
            : (isDark ? 'rgba(230,233,241,0.15)' : '#e6e9f1'),
          color: announcement.isUrgent 
            ? (isDark ? '#f6ead0' : '#98701c')
            : (isDark ? '#c9d3f1' : '#495875'),
          borderRadius: 5,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.6
        }}>
          {announcement.isUrgent ? 'URGENT' : 'BROADCAST'}
        </span>
        <span style={{
          fontSize: 11,
          color: isDark ? 'rgba(255,255,255,0.5)' : '#9aa0ad',
          fontWeight: 500
        }}>
          {announcement.time}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 13.5,
        fontWeight: 600,
        color: isDark ? '#fff' : '#16223f',
        marginBottom: 6,
        lineHeight: 1.3
      }}>
        {announcement.title}
      </div>

      {/* Audience */}
      <div style={{
        fontSize: 11.5,
        color: isDark ? 'rgba(255,255,255,0.6)' : '#8b90a0',
        fontWeight: 500
      }}>
        {announcement.audience}
      </div>
    </div>
  );
}

// ============================================================================
// BROADCAST PULSE COMPONENT
// ============================================================================

interface BroadcastPulseProps {
  tone: 'dark' | 'light';
}

function BroadcastPulse({ tone }: BroadcastPulseProps) {
  const isDark = tone === 'dark';

  return (
    <div style={{
      background: isDark ? 'linear-gradient(165deg,#18213a,#1b2643)' : '#fff',
      border: isDark ? 'none' : '1px solid #e8e4dc',
      borderRadius: 16,
      padding: '20px 18px',
      marginBottom: 18
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: isDark ? 'rgba(255,255,255,0.5)' : '#8b90a0',
            marginBottom: 6
          }}>
            LIVE PULSE
          </div>
          <h3 style={{
            fontSize: 17,
            fontWeight: 700,
            color: isDark ? '#fff' : '#16223f',
            margin: '0 0 4px 0'
          }}>
            Broadcast pulse
          </h3>
          <p style={{
            fontSize: 12,
            color: isDark ? 'rgba(255,255,255,0.6)' : '#8b90a0',
            margin: 0
          }}>
            Urgent and most recent broadcasts
          </p>
        </div>
        <button style={{
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 9,
          background: isDark ? 'rgba(240,167,66,0.15)' : '#eaeefb',
          color: isDark ? '#f0a742' : '#23315d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0
        }}>
          <Bell size={16} />
        </button>
      </div>

      {/* Pulse items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {PULSE_ITEMS.map((item) => (
          <PulseItem key={item.id} announcement={item} tone={tone} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY ITEM COMPONENT
// ============================================================================

function HistoryItem({ item }: { item: HistoryItem }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '14px 0',
      borderBottom: '1px solid #e8e4dc'
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: item.isUrgent ? '#e07b39' : '#9aa0ad',
        marginTop: 4,
        flexShrink: 0
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: '#16223f',
          marginBottom: 4,
          lineHeight: 1.3
        }}>
          {item.title}
        </div>
        <div style={{
          fontSize: 11.5,
          color: '#8b90a0',
          fontWeight: 500
        }}>
          {item.source} · {item.date}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OLDER ANNOUNCEMENTS COMPONENT
// ============================================================================

function OlderAnnouncements() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e4dc',
      borderRadius: 16,
      padding: '20px 18px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.8,
          color: '#8b90a0',
          marginBottom: 6
        }}>
          ANNOUNCEMENT HISTORY
        </div>
        <h3 style={{
          fontSize: 17,
          fontWeight: 700,
          color: '#16223f',
          margin: '0 0 4px 0'
        }}>
          Older announcements
        </h3>
        <p style={{
          fontSize: 12,
          color: '#8b90a0',
          margin: 0
        }}>
          Previously published broadcasts and notices
        </p>
      </div>

      {/* History list */}
      <div>
        {HISTORY.map((item) => (
          <HistoryItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  pulseTone: 'dark' | 'light';
}

function Sidebar({ pulseTone }: SidebarProps) {
  return (
    <div style={{
      position: 'sticky',
      top: 74
    }}>
      <BroadcastPulse tone={pulseTone} />
      <OlderAnnouncements />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BroadcastCenterScreen({
  density = 'spacious',
  pulseTone = 'light',
  showTimestamps = true
}: BroadcastCenterProps) {
  const [tab, setTab] = useState<string>('all');
  const [audience, setAudience] = useState<string>('All');

  // Filter announcements
  const feed = ANNOUNCEMENTS.filter(
    (a) =>
      (tab !== 'urgent' || a.isUrgent) &&
      (audience === 'All' || a.audience === audience)
  );

  const urgentCount = feed.filter((a) => a.isUrgent).length;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f6f4ef',
      color: '#16223f',
      fontFamily: "'Hanken Grotesk', sans-serif",
      WebkitFontSmoothing: 'antialiased'
    }}>
      <IconRail />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopHeader tab={tab} onTabChange={setTab} />

        <main style={{
          maxWidth: 1360,
          width: '100%',
          margin: '0 auto',
          padding: '20px 26px 44px'
        }}>
          <HeroSection tab={tab} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.6fr) 358px',
            gap: 22,
            alignItems: 'start'
          }}>
            {/* Left column */}
            <div>
              <StatCards
                visibleCount={feed.length}
                urgentCount={urgentCount}
                audienceLabel={audience}
              />
              <AudienceFilters
                audience={audience}
                onAudienceChange={setAudience}
              />
              <AnnouncementFeed
                announcements={feed}
                tab={tab}
                density={density}
                showTimestamps={showTimestamps}
              />
            </div>

            {/* Right sidebar */}
            <Sidebar pulseTone={pulseTone} />
          </div>
        </main>
      </div>
    </div>
  );
}
