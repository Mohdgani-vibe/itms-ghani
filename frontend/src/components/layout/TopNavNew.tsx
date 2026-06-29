import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Bell, ChevronDown, LogOut, Settings,
  Users, Package, HardDrive, AlertTriangle, FileText,
  LogOut as GatepassIcon, Home
} from 'lucide-react';
import { clearStoredSession, getPortalSegmentForRole, getStoredSession } from '../../lib/session';

// Main navigation items for different portals
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
    { name: 'Profile', path: '/profile', icon: Users },
    { name: 'My Assets', path: '/assets', icon: HardDrive },
    { name: 'My Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'My Requests', path: '/requests', icon: FileText },
    { name: 'Announcements', path: '/announcements', icon: Bell },
  ],
} as const;

export default function TopNavNew() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = getStoredSession();
  
  // Extract portal from path
  const portalMatch = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/);
  const currentPortal = portalMatch?.[1] || (session ? getPortalSegmentForRole(session.user.role) : 'emp');
  const basePath = `/${currentPortal}`;
  
  // Get navigation items for current portal
  const navItems = portalNavItems[currentPortal as keyof typeof portalNavItems] || portalNavItems.admin;

  const handleLogout = () => {
    clearStoredSession();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 xl:px-6">
        
        {/* Logo */}
        <Link to={`${basePath}/dashboard`} className="flex flex-shrink-0 items-center gap-2">
          <img src="/itms-logo-new.svg" alt="ITMS" className="h-10" />
        </Link>

        {/* Main Navigation Items */}
        <nav className="flex gap-1.5 flex-1 overflow-x-auto ml-4">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname.startsWith(`${basePath}${item.path}`);
            return (
              <button
                key={item.name}
                onClick={() => navigate(`${basePath}${item.path}`)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#EAF1FE] text-[#1B4FD1]'
                    : 'bg-transparent text-[#46505F] hover:bg-zinc-100'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="ml-3 flex flex-shrink-0 items-center gap-2">
          <button className="p-2 rounded-md text-[#8C96A4] hover:bg-zinc-100 transition-colors">
            <Search className="h-5 w-5" />
          </button>
          
          <button className="p-2 rounded-md text-[#8C96A4] hover:bg-zinc-100 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
          
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 rounded-md text-[#8C96A4] hover:bg-zinc-100 transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C13B40] rounded-full"></span>
          </button>
          
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#EAEDF2] hover:bg-zinc-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white text-xs font-bold">
                {session?.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-semibold text-[#0F1B2D]">{session?.user.role || 'SA'}</span>
              <ChevronDown className="h-4 w-4 text-[#8C96A4]" />
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg z-50">
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
