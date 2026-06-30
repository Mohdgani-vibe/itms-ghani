import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavNew from './TopNavNew';
import Sidebar from './Sidebar';
import { getAllowedPortalSegments, getPortalSegmentForRole, getStoredSession } from '../../lib/session';

type PortalSegment = 'admin' | 'it' | 'audit' | 'emp';

const preloadedChunks = new Set<string>();

const portalChunkLoaders: Record<PortalSegment, Array<{ key: string; matches: string[]; load: () => Promise<unknown> }>> = {
  admin: [
    { key: 'admin:devices', matches: ['/devices'], load: () => import('../../pages/Devices') },
    { key: 'admin:alerts', matches: ['/alerts'], load: () => import('../../pages/Alerts') },
    { key: 'admin:requests', matches: ['/requests'], load: () => import('../../pages/live/RequestsQueuePage') },
    { key: 'admin:gatepass', matches: ['/gatepass'], load: () => import('../../pages/Gatepass') },
    { key: 'admin:chat', matches: ['/chat'], load: () => import('../../pages/Chat') },
    { key: 'admin:settings', matches: ['/settings'], load: () => import('../../pages/live/SettingsPage') },
    { key: 'admin:inventory', matches: ['/inventory'], load: () => import('../../pages/Inventory') },
  ],
  it: [
    { key: 'it:devices', matches: ['/devices'], load: () => import('../../pages/Devices') },
    { key: 'it:alerts', matches: ['/alerts'], load: () => import('../../pages/Alerts') },
    { key: 'it:patch', matches: ['/patch'], load: () => import('../../pages/live/PatchDashboardPage') },
    { key: 'it:requests', matches: ['/requests'], load: () => import('../../pages/live/RequestsQueuePage') },
    { key: 'it:chat', matches: ['/chat'], load: () => import('../../pages/Chat') },
    { key: 'it:settings', matches: ['/settings'], load: () => import('../../pages/live/SettingsPage') },
  ],
  audit: [
    { key: 'audit:devices', matches: ['/devices'], load: () => import('../../pages/Devices') },
    { key: 'audit:alerts', matches: ['/alerts'], load: () => import('../../pages/Alerts') },
    { key: 'audit:announcements', matches: ['/announcements'], load: () => import('../../pages/Announcements') },
  ],
  emp: [
    { key: 'emp:alerts', matches: ['/alerts'], load: () => import('../../pages/Alerts') },
    { key: 'emp:requests', matches: ['/requests'], load: () => import('../../pages/live/MyRequestsPage') },
    { key: 'emp:chat', matches: ['/chat'], load: () => import('../../pages/Chat') },
    { key: 'emp:announcements', matches: ['/announcements'], load: () => import('../../pages/Announcements') },
  ],
};

function scheduleIdle(task: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const callbackId = window.requestIdleCallback(() => task(), { timeout: 1200 });
    return () => window.cancelIdleCallback(callbackId);
  }

  const timeoutId = globalThis.setTimeout(task, 250);
  return () => globalThis.clearTimeout(timeoutId);
}

export default function PortalLayout() {
  const location = useLocation();
  const session = getStoredSession();
  const sessionRole = session?.user.role || '';

  useEffect(() => {
    // Force disable dark mode
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }, []);

  useEffect(() => {
    if (!sessionRole) {
      return;
    }

    const allowedPortals = session?.user ? getAllowedPortalSegments(session.user) : [];
    const portalFromPath = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/)?.[1] as PortalSegment | undefined;
    const fallbackPortal = allowedPortals[0] || getPortalSegmentForRole(sessionRole);
    const portal = (portalFromPath || fallbackPortal) as PortalSegment;
    const candidates = portalChunkLoaders[portal].filter((candidate) => !candidate.matches.some((match) => location.pathname.includes(match)));

    return scheduleIdle(() => {
      candidates.forEach((candidate) => {
        if (preloadedChunks.has(candidate.key)) {
          return;
        }
        preloadedChunks.add(candidate.key);
        void candidate.load();
      });
    });
  }, [location.pathname, session, sessionRole]);

  // Check if current page is dashboard
  const isDashboard = location.pathname.match(/^\/(admin|it|audit|emp)\/dashboard$/);

  return (
    <>
      <style>{`
        /* Force light mode - double class for higher specificity (0,2,1) */
        .portal-layout-root.portal-layout-root,
        .portal-layout-root.portal-layout-root div:not(.sidebar-tooltip):not(.sidebar-tooltip *),
        .portal-layout-root.portal-layout-root span:not(.sidebar-tooltip *),
        .portal-layout-root.portal-layout-root p,
        .portal-layout-root.portal-layout-root h1,
        .portal-layout-root.portal-layout-root h2,
        .portal-layout-root.portal-layout-root h3,
        .portal-layout-root.portal-layout-root button,
        .portal-layout-root.portal-layout-root a,
        .portal-layout-root.portal-layout-root label,
        .portal-layout-root.portal-layout-root input,
        .portal-layout-root.portal-layout-root select,
        .portal-layout-root.portal-layout-root textarea,
        .portal-layout-root.portal-layout-root td,
        .portal-layout-root.portal-layout-root th,
        .portal-layout-root.portal-layout-root li {
          color: #0F1B2D !important;
        }
        
        /* Sidebar tooltip override - allow custom background and styling */
        .sidebar-tooltip,
        .sidebar-tooltip *,
        .sidebar-tooltip span {
          color: #ffffff !important;
          /* Allow inline background styles to override */
        }
        
        /* Prevent color override on tooltip */
        .sidebar-tooltip {
          color: #ffffff !important;
        }
      `}</style>
      <div className="min-h-screen portal-layout-root flex flex-col" style={{ backgroundColor: '#F1F4F9', fontFamily: 'Inter, sans-serif' }}>
        <TopNavNew />
        <Sidebar />
        <main className={`flex-1 ${isDashboard ? '' : 'ml-16'}`}>
           <Outlet />
        </main>
      </div>
    </>
  );
}
