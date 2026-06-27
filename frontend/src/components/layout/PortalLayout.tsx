import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from './TopNav';
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      <TopNav />
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
         <Outlet />
      </main>
    </div>
  );
}
