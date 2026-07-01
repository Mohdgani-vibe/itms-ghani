import { Suspense, lazy, type ReactElement, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavigationMetrics from './components/NavigationMetrics';
import { getPreferredPortalPath, getStoredSession } from './lib/session';
import { getPageAccessRedirect, getPortalAccessRedirect, getRoleAccessRedirect } from './lib/portalGuards';
import { validateStoredSession } from './lib/api';

const Login = lazy(() => import('./pages/Login'));
const LoginNew = lazy(() => import('./pages/LoginNew'));
const PortalLayout = lazy(() => import('./components/layout/PortalLayout'));
const DashboardPageNew = lazy(() => import('./pages/live/DashboardPageNew'));
const UsersPageModern = lazy(() => import('./pages/live/UsersPageModernNew'));
const UserProfilePage = lazy(() => import('./pages/live/UserProfilePage'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetailPage = lazy(() => import('./pages/live/DeviceDetailPage'));
const SettingsPage = lazy(() => import('./pages/live/SettingsPage'));
const PatchDashboard = lazy(() => import('./pages/PatchDashboard'));
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
const VaultPage = lazy(() => import('./pages/live/VaultPage'));
const DocsPage = lazy(() => import('./pages/live/DocsPage'));
const InventoryScreen = lazy(() => import('./pages/InventoryScreen'));
const SecurityAlertsScreen = lazy(() => import('./pages/SecurityAlertsScreen'));
const RequestsQueueScreen = lazy(() => import('./pages/RequestsQueueScreen'));
const GatepassScreen = lazy(() => import('./pages/GatepassScreen'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center px-4">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white"></div>
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Loading ITMS...</span>
        </div>
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
          <Route path="/login" element={<LoginNew />} />
          <Route path="/login/old" element={<LoginRoute />} />
          <Route path="/portal/superadmin/gatepass" element={<Navigate to="/admin/gatepass" replace />} />
          <Route path="/portal/it/gatepass" element={<Navigate to="/it/gatepass" replace />} />
          <Route path="/terminal/:minionId" element={<RequireAuth><RequireRoles roles={['super_admin', 'it_team']}><TerminalConsole /></RequireRoles></RequireAuth>} />
          <Route path="/ssh/assets/:id" element={<RequireAuth><RequireRoles roles={['super_admin', 'it_team']}><SshTerminalPage /></RequireRoles></RequireAuth>} />

          {/* Admin Portal with PortalLayout */}
          <Route path="/admin" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPageNew />} />
            <Route path="users" element={<UsersPageModern />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="alerts" element={<SecurityAlertsScreen />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueueScreen />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="patch" element={<PatchDashboard />} />
            <Route path="patch/devices" element={<PatchList />} />
            <Route path="inventory-screen" element={<InventoryScreen />} />
            <Route path="security-alerts" element={<SecurityAlertsScreen />} />
            <Route path="requests-queue" element={<RequestsQueueScreen />} />
            <Route path="gatepass-screen" element={<GatepassScreen />} />
          </Route>

          {/* IT Portal with PortalLayout */}
          <Route path="/it" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPageNew />} />
            <Route path="users" element={<UsersPageModern />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="alerts" element={<SecurityAlertsScreen />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="patch" element={<PatchDashboard />} />
            <Route path="patch/devices" element={<PatchList />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueueScreen />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="inventory-screen" element={<InventoryScreen />} />
            <Route path="security-alerts" element={<SecurityAlertsScreen />} />
            <Route path="requests-queue" element={<RequestsQueueScreen />} />
            <Route path="gatepass-screen" element={<GatepassScreen />} />
          </Route>

          {/* Audit Portal with PortalLayout */}
          <Route path="/audit" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPageNew />} />
            <Route path="users" element={<UsersPageModern />} />
            <Route path="users/:id" element={<UserProfilePage />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="alerts" element={<SecurityAlertsScreen />} />
            <Route path="salt" element={<SaltStackWorkspace />} />
            <Route path="gatepass" element={<Gatepass />} />
            <Route path="chat" element={<Chat />} />
            <Route path="requests" element={<RequestsQueueScreen />} />
            <Route path="patch" element={<PatchDashboard />} />
            <Route path="patch/devices" element={<PatchList />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="gatepass-screen" element={<GatepassScreen />} />
          </Route>

          {/* Employee Portal with PortalLayout */}
          <Route path="/emp" element={<RequireAuth><PortalLayout /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPageNew />} />
            <Route path="profile" element={<UserProfilePage />} />
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
