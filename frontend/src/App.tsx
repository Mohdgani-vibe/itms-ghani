import { Suspense, lazy, type ReactElement, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavigationMetrics from './components/NavigationMetrics';
import { getPreferredPortalPath, getStoredSession } from './lib/session';
import { getPageAccessRedirect, getPortalAccessRedirect, getRoleAccessRedirect } from './lib/portalGuards';
import { validateStoredSession } from './lib/api';

const Login = lazy(() => import('./pages/Login'));
const PortalLayout = lazy(() => import('./components/layout/PortalLayout'));
const DashboardPage = lazy(() => import('./pages/live/DashboardPage'));
const UsersPage = lazy(() => import('./pages/live/UsersPage'));
const UserProfilePage = lazy(() => import('./pages/live/UserProfilePage'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetailPage = lazy(() => import('./pages/live/DeviceDetailPage'));
const SettingsPage = lazy(() => import('./pages/live/SettingsPage'));
const PatchDashboardPage = lazy(() => import('./pages/live/PatchDashboardPage'));
const PatchList = lazy(() => import('./pages/PatchList'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Gatepass = lazy(() => import('./pages/Gatepass'));
const Chat = lazy(() => import('./pages/Chat'));
const Alerts = lazy(() => import('./pages/Alerts'));
const SaltStackWorkspace = lazy(() => import('./pages/SaltStackWorkspace'));
const Announcements = lazy(() => import('./pages/Announcements'));
const MyAssetsPage = lazy(() => import('./pages/live/MyAssetsPage'));
const MyRequestsPage = lazy(() => import('./pages/live/MyRequestsPage'));
const RequestsQueuePage = lazy(() => import('./pages/live/RequestsQueuePage'));
const TerminalConsole = lazy(() => import('./pages/TerminalConsole'));
const SshTerminalPage = lazy(() => import('./pages/SshTerminalPage'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100 flex items-center justify-center px-4">
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-4 shadow-sm text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Loading ITMS...
      </div>
    </div>
  );
}

function LoginRoute() {
  return <Login />;
}

function PortalHomeRedirect() {
  const session = getStoredSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getPreferredPortalPath(session.user)} replace />;
}

function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation();
  const session = getStoredSession();
  const token = session?.token ?? '';
  const [validatedToken, setValidatedToken] = useState('');
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    void validateStoredSession().then((isValid) => {
      if (!cancelled) {
        setValidatedToken(token);
        setIsTokenValid(isValid);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const authState: 'checking' | 'valid' | 'invalid' = !token
    ? 'invalid'
    : validatedToken !== token
      ? 'checking'
      : isTokenValid
        ? 'valid'
        : 'invalid';

  if (!session || authState === 'invalid') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (authState === 'checking') {
    return <RouteFallback />;
  }

  const portalAccessRedirect = getPortalAccessRedirect(location.pathname, session.user);
  if (portalAccessRedirect) {
    return <Navigate to={portalAccessRedirect} replace />;
  }

  const pageAccessRedirect = getPageAccessRedirect(location.pathname, session.user);
  if (pageAccessRedirect) {
    return <Navigate to={pageAccessRedirect} replace />;
  }

  return children;
}

function RequireRoles({ children, roles }: { children: ReactElement; roles: string[] }) {
  const session = getStoredSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const roleAccessRedirect = getRoleAccessRedirect(session.user, roles);
  if (roleAccessRedirect) {
    return <Navigate to={roleAccessRedirect} replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <NavigationMetrics />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/portal/superadmin/gatepass" element={<Navigate to="/admin/gatepass" replace />} />
          <Route path="/portal/it/gatepass" element={<Navigate to="/it/gatepass" replace />} />
          <Route path="/terminal/:minionId" element={<RequireAuth><RequireRoles roles={['super_admin', 'it_team']}><TerminalConsole /></RequireRoles></RequireAuth>} />
          <Route path="/ssh/assets/:id" element={<RequireAuth><RequireRoles roles={['super_admin', 'it_team']}><SshTerminalPage /></RequireRoles></RequireAuth>} />

          <Route path="/admin" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueuePage />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="patch" element={<PatchDashboardPage />} />
            <Route path="patch/devices" element={<PatchList />} />
          </Route>

          <Route path="/it" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="patch" element={<PatchDashboardPage />} />
            <Route path="patch/devices" element={<PatchList />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueuePage />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="/audit" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueuePage />} />
            <Route path="patch" element={<PatchDashboardPage />} />
            <Route path="patch/devices" element={<PatchList />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="/emp" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="profile" element={<UserProfilePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="assets" element={<MyAssetsPage />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="requests" element={<MyRequestsPage />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="chat" element={<Chat />} />
            <Route path="announcements" element={<Announcements />} />
          </Route>
          <Route path="/" element={<PortalHomeRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
