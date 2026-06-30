import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Bell, ChevronDown, LogOut, Settings,
  Users, UserPlus, Upload, MonitorDown, FileCheck, Lock,
  BarChart3, Calendar, AlertCircle, Clock, ClipboardList,
  Package, HardDrive
} from 'lucide-react';
import { clearStoredSession, getPortalSegmentForRole, getStoredSession } from '../../lib/session';

// Icon mapping for tabs
const tabIcons: Record<string, any> = {
  'Users': Users,
  'Add Employee': UserPlus,
  'Import / Export': Upload,
  'Install Agents': MonitorDown,
  'Audit': FileCheck,
  'Portal Access': Lock,
  'Unassigned': Users,
  'Dashboard': BarChart3,
  'Devices': MonitorDown,
  'Reports': FileCheck,
  'Assets': ClipboardList,
  'Categories': BarChart3,
  'All Alerts': AlertCircle,
  'Critical': AlertCircle,
  'Rules': Settings,
  'Queue': Clock,
  'Approved': FileCheck,
  'Rejected': FileCheck,
  'Active': Calendar,
  'History': Calendar,
  'Create': UserPlus,
  'All': BarChart3,
  'Urgent': AlertCircle,
  'All Devices': MonitorDown,
  'Laptops': MonitorDown,
  'Desktops': MonitorDown,
  'Monitors': MonitorDown,
};

// Page-specific tabs configuration
const pageTabsConfig: Record<string, { name: string; path: string; badge?: number }[]> = {
  '/dashboard': [
    { name: 'Overview', path: '' },
  ],
  '/users': [
    { name: 'Users', path: '' },
    { name: 'Add Employee', path: '/add' },
    { name: 'Import / Export', path: '/import' },
    { name: 'Install Agents', path: '/install' },
    { name: 'Audit', path: '/audit' },
    { name: 'Portal Access', path: '/access' },
    { name: 'Unassigned', path: '/unassigned', badge: 3 },
  ],
  '/patch': [
    { name: 'Dashboard', path: '' },
    { name: 'Devices', path: '/devices' },
    { name: 'Reports', path: '/reports' },
  ],
  '/inventory': [
    { name: 'Assets', path: '' },
    { name: 'Categories', path: '/categories' },
    { name: 'Reports', path: '/reports' },
  ],
  '/alerts': [
    { name: 'All Alerts', path: '' },
    { name: 'Critical', path: '/critical' },
    { name: 'Rules', path: '/rules' },
  ],
  '/requests': [
    { name: 'Queue', path: '' },
    { name: 'Approved', path: '/approved' },
    { name: 'Rejected', path: '/rejected' },
  ],
  '/gatepass': [
    { name: 'Active', path: '' },
    { name: 'History', path: '/history' },
    { name: 'Create', path: '/create' },
  ],
  '/announcements': [
    { name: 'All', path: '' },
    { name: 'Urgent', path: '/urgent' },
    { name: 'Create', path: '/create' },
  ],
  '/devices': [
    { name: 'All Devices', path: '' },
    { name: 'Laptops', path: '/laptops' },
    { name: 'Desktops', path: '/desktops' },
    { name: 'Monitors', path: '/monitors' },
  ],
};

export default function TopNavNew() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = getStoredSession();
  
  // Extract portal and page from path
  const portalMatch = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/([^/]+))?/);
  const currentPortal = portalMatch?.[1] || (session ? getPortalSegmentForRole(session.user.role) : 'emp');
  const currentPage = portalMatch?.[2] || 'dashboard';
  const basePath = `/${currentPortal}`;
  
  // Get page tabs - match against the main page segment (e.g., /users, /patch, etc.)
  const pageKey = `/${currentPage}`;
  const pageTabs = pageTabsConfig[pageKey] || [];
  
  // Determine active tab
  const activeTabIndex = pageTabs.findIndex(tab => {
    if (tab.path === '') {
      return location.pathname === `${basePath}/${currentPage}`;
    }
    return location.pathname.startsWith(`${basePath}/${currentPage}${tab.path}`);
  });

  const handleLogout = () => {
    clearStoredSession();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 xl:px-6">
        
        {/* Logo */}
        <Link to={`${basePath}/dashboard`} className="flex flex-shrink-0 items-center gap-2">
          <img src="/itms-logo-new.svg" alt="ITMS" className="h-12" />
        </Link>

        {/* Page-Specific Tabs */}
        {pageTabs.length > 0 && (
          <nav className="flex gap-1.5 flex-1 overflow-x-auto ml-4">
            {pageTabs.map((tab, index) => {
              const IconComponent = tabIcons[tab.name];
              return (
                <button
                  key={tab.name}
                  onClick={() => navigate(`${basePath}/${currentPage}${tab.path}`)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    index === (activeTabIndex >= 0 ? activeTabIndex : 0)
                      ? 'bg-[#EAF1FE] text-[#1B4FD1]'
                      : 'bg-transparent text-[#46505F] hover:bg-zinc-100'
                  }`}
                >
                  {IconComponent && <IconComponent className="h-4 w-4" />}
                  {tab.name}
                  {tab.badge !== undefined && (
                    <span className="bg-[#C13B40] text-white rounded-full px-2 py-0.5 text-xs font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

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
