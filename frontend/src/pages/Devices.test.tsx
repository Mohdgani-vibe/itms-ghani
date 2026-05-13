import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

type MockSession = {
  token: string;
  shortName: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    defaultPortal: string;
    portals: string[];
  };
};

let mockSession: MockSession | null = {
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
};

vi.mock('../lib/session', () => ({
  getStoredSession: () => mockSession,
}));

import Devices from './Devices';

describe('Devices', () => {
  it('renders the IT inventory shell with management controls', () => {
    mockSession = {
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
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/it/devices']}>
        <Devices />
      </MemoryRouter>,
    );

    expect(markup).toContain('Asset Inventory');
    expect(markup).toContain('Review all systems, or switch to only unassigned systems that still need an owner.');
    expect(markup).toContain('Show More Columns');
    expect(markup).toContain('Unassigned Systems');
    expect(markup).toContain('Assigned Systems');
    expect(markup).toContain('All Systems');
    expect(markup).toContain('Search by hostname, Asset ID or user...');
    expect(markup).not.toContain('Auditor access is read-only.');
  });

  it('renders the read-only auditor shell without management controls', () => {
    mockSession = {
      token: 'token',
      shortName: 'AU',
      user: {
        id: 'user-2',
        email: 'auditor@example.com',
        fullName: 'Ari User',
        role: 'auditor',
        defaultPortal: '/audit/dashboard',
        portals: ['auditor'],
      },
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/audit/devices']}>
        <Devices />
      </MemoryRouter>,
    );

    expect(markup).toContain('Asset Inventory');
    expect(markup).toContain('Auditor access is read-only.');
    expect(markup).not.toContain('Show More Columns');
    expect(markup).toContain('Showing unassigned systems only');
    expect(markup).toContain('Search by hostname, Asset ID or user...');
  });
});