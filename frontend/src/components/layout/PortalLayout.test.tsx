import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./TopNav', () => ({
  default: () => <div>Mock Portal Nav</div>,
}));

vi.mock('../../lib/session', () => ({
  getAllowedPortalSegments: () => ['it'],
  getPortalSegmentForRole: () => 'it',
  getStoredSession: () => ({
    token: 'token',
    shortName: 'AK',
    user: {
      id: 'user-1',
      email: 'alex@example.com',
      fullName: 'Alex Kumar',
      role: 'it_team',
      defaultPortal: '/it/dashboard',
      portals: ['it_team'],
    },
  }),
}));

import PortalLayout from './PortalLayout';

describe('PortalLayout', () => {
  it('renders the shared portal shell and nested route content', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <Routes>
          <Route path="/it" element={<PortalLayout />}>
            <Route path="dashboard" element={<div>Portal body content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('Mock Portal Nav');
    expect(markup).toContain('Portal body content');
    expect(markup).toContain('min-h-screen');
    expect(markup).toContain('flex-1');
  });
});