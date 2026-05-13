import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const appMocks = vi.hoisted(() => ({
  getStoredSessionMock: vi.fn(),
  getPreferredPortalPathMock: vi.fn(() => '/emp/dashboard'),
  getPortalAccessRedirectMock: vi.fn(() => null),
  getPageAccessRedirectMock: vi.fn(() => null),
  getRoleAccessRedirectMock: vi.fn(() => null),
  validateStoredSessionMock: vi.fn(async () => true),
}));

vi.mock('./components/NavigationMetrics', () => ({
  default: () => <div>navigation-metrics</div>,
}));

vi.mock('./components/layout/PortalLayout', () => ({
  default: () => <div>portal-layout</div>,
}));

vi.mock('./pages/Login', () => ({ default: () => <div>login-page</div> }));
vi.mock('./pages/live/DashboardPage', () => ({ default: () => <div>dashboard-page</div> }));
vi.mock('./pages/live/UsersPage', () => ({ default: () => <div>users-page</div> }));
vi.mock('./pages/live/UserProfilePage', () => ({ default: () => <div>user-profile-page</div> }));
vi.mock('./pages/Devices', () => ({ default: () => <div>devices-page</div> }));
vi.mock('./pages/live/DeviceDetailPage', () => ({ default: () => <div>device-detail-page</div> }));
vi.mock('./pages/live/SettingsPage', () => ({ default: () => <div>settings-page</div> }));
vi.mock('./pages/live/PatchDashboardPage', () => ({ default: () => <div>patch-dashboard-page</div> }));
vi.mock('./pages/PatchList', () => ({ default: () => <div>patch-list-page</div> }));
vi.mock('./pages/Inventory', () => ({ default: () => <div>inventory-page</div> }));
vi.mock('./pages/Gatepass', () => ({ default: () => <div>gatepass-page</div> }));
vi.mock('./pages/Chat', () => ({ default: () => <div>chat-page</div> }));
vi.mock('./pages/Alerts', () => ({ default: () => <div>alerts-page</div> }));
vi.mock('./pages/Announcements', () => ({ default: () => <div>announcements-page</div> }));
vi.mock('./pages/live/MyAssetsPage', () => ({ default: () => <div>my-assets-page</div> }));
vi.mock('./pages/live/MyRequestsPage', () => ({ default: () => <div>my-requests-page</div> }));
vi.mock('./pages/live/RequestsQueuePage', () => ({ default: () => <div>requests-queue-page</div> }));
vi.mock('./pages/TerminalConsole', () => ({ default: () => <div>terminal-console-page</div> }));
vi.mock('./pages/SshTerminalPage', () => ({ default: () => <div>ssh-terminal-page</div> }));

vi.mock('./lib/session', () => ({
  getStoredSession: appMocks.getStoredSessionMock,
  getPreferredPortalPath: appMocks.getPreferredPortalPathMock,
}));

vi.mock('./lib/portalGuards', () => ({
  getPageAccessRedirect: appMocks.getPageAccessRedirectMock,
  getPortalAccessRedirect: appMocks.getPortalAccessRedirectMock,
  getRoleAccessRedirect: appMocks.getRoleAccessRedirectMock,
}));

vi.mock('./lib/api', () => ({
  validateStoredSession: appMocks.validateStoredSessionMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div data-router="browser">{children}</div>,
    Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Route: ({ element, children }: { element?: React.ReactNode; children?: React.ReactNode }) => <>{element}{children}</>,
    Navigate: ({ to }: { to: string }) => <div>{`navigate:${to}`}</div>,
    useLocation: () => ({ pathname: '/admin/dashboard' }),
  };
});

import App from './App';

describe('App', () => {
  it('renders the navigation metrics shell and route fallback during static loading', () => {
    appMocks.getStoredSessionMock.mockReturnValue(null);

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('navigation-metrics');
    expect(markup).toContain('Loading ITMS...');
  });

  it('redirects the portal home route to the preferred portal path when a session exists', () => {
    appMocks.getStoredSessionMock.mockReturnValue({
      token: 'token-123',
      user: { id: 'user-1', role: { name: 'employee' } },
    });
    appMocks.getPreferredPortalPathMock.mockReturnValue('/emp/dashboard');

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('navigate:/emp/dashboard');
  });
});