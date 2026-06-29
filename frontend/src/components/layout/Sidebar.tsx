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
  // Sidebar is now replaced by top navigation
  return null;
}
