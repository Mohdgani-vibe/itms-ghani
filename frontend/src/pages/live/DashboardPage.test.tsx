import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/session', () => ({
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

import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  it('renders the active charts-only dashboard shell for the live IT route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('IT Team Workspace');
    expect(markup).toContain('Welcome Alex Kumar');
    expect(markup).toContain('Operational Pulse');
    expect(markup).toContain('Total Systems Added');
    expect(markup).toContain('Active Users Today');
    expect(markup).toContain('Offline Users');
    expect(markup).toContain('...');
  });

  it('maps the employee route to the employee workspace label', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Employee Workspace');
  });
});