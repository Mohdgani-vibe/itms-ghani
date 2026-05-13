import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/admin/users/user-1', hash: '' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'user-1' }),
}));

vi.mock('../../lib/session', () => ({
  getPreferredPortalPath: vi.fn(() => '/admin/dashboard'),
  getShortName: vi.fn(() => 'Admin'),
  getStoredSession: vi.fn(() => ({
    token: 'token-1',
    user: { id: 'admin-1', role: 'super_admin' },
  })),
  normalizeAuthUser: vi.fn((value) => value),
  setStoredSession: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import UserProfilePage from './UserProfilePage';

describe('UserProfilePage', () => {
  it('renders the initial loading shell during static rendering', () => {
    const markup = renderToStaticMarkup(<UserProfilePage />);

    expect(markup).toContain('Loading user profile...');
  });
});
