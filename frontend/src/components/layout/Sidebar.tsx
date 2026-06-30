import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home,
  Users, 
  Package, 
  HardDrive,
  AlertTriangle, 
  FileText, 
  LogOut as GatepassIcon,
  Bell,
  UserCircle,
  FolderOpen,
  MessageSquare
} from 'lucide-react';
import { getPageAccessRedirect } from '../../lib/portalGuards';
import { getPortalSegmentForRole, getStoredSession } from '../../lib/session';

const portalNavItems = {
  admin: [
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  it: [
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  audit: [
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  emp: [
    { name: 'Profile', path: '/profile', icon: UserCircle },
    { name: 'My Assets', path: '/assets', icon: FolderOpen },
    { name: 'My Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'My Requests', path: '/requests', icon: FileText },
    { name: 'Chat', path: '/chat', icon: MessageSquare },
    { name: 'Announcements', path: '/announcements', icon: Bell },
  ],
} as const;

export default function Sidebar() {
  const location = useLocation();
  const session = getStoredSession();
  const sessionRole = session?.user.role || '';
  
  const portalMatch = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/);
  const currentPortal = portalMatch?.[1] || (session ? getPortalSegmentForRole(session.user.role) : 'emp');
  const basePath = portalMatch ? `/${portalMatch[1]}` : `/${currentPortal}`;
  
  // Hide sidebar on dashboard page
  const isDashboard = location.pathname.match(/^\/(admin|it|audit|emp)\/dashboard$/);
  if (isDashboard) {
    return null;
  }
  
  const navItems = (portalNavItems[currentPortal as keyof typeof portalNavItems] || portalNavItems.emp)
    .filter((item) => !session || !getPageAccessRedirect(`${basePath}${item.path}`, session.user));

  return (
    <aside className="fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-16 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-4 gap-2 z-30">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(`${basePath}${item.path}`);
        return (
          <NavLink
            key={item.name}
            to={`${basePath}${item.path}`}
            title={item.name}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-lg transition-all ${
              isActive
                ? 'bg-primary text-white shadow-md'
                : 'text-muted hover:text-ink hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon className="h-5 w-5" />
            
            {/* Modern Tooltip */}
            <div 
              className="sidebar-tooltip absolute left-full ml-4 px-5 py-3 rounded-xl text-sm font-semibold opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:scale-100 scale-95 transition-all duration-300 ease-out whitespace-nowrap z-50 pointer-events-none"
              style={{ 
                background: 'linear-gradient(135deg, #2667E8 0%, #1B4FD1 100%)',
                color: '#ffffff',
                boxShadow: '0 8px 32px rgba(38, 103, 232, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.02em'
              }}
            >
              <span style={{ 
                color: '#ffffff', 
                fontFamily: 'Inter, sans-serif',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
              }}>
                {item.name}
              </span>
              
              {/* Animated Arrow */}
              <div 
                className="absolute right-full top-1/2 -translate-y-1/2 transition-transform duration-300 group-hover:-translate-x-0.5"
                style={{ 
                  width: 0,
                  height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderRight: '8px solid #2667E8',
                  filter: 'drop-shadow(-1px 0 2px rgba(38, 103, 232, 0.3))'
                }}
              ></div>
            </div>
          </NavLink>
        );
      })}
    </aside>
  );
}
