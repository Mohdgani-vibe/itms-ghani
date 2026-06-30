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
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  it: [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  audit: [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Patch', path: '/patch', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: HardDrive },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Request', path: '/requests', icon: FileText },
    { name: 'Gatepass', path: '/gatepass', icon: GatepassIcon },
    { name: 'Announcement', path: '/announcements', icon: Bell },
  ],
  emp: [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
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
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              {item.name}
              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-4 border-transparent border-r-zinc-900"></div>
            </div>
          </NavLink>
        );
      })}
    </aside>
  );
}
