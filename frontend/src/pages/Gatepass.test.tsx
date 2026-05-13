import { renderToStaticMarkup } from 'react-dom/server';
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

import Gatepass from './Gatepass';

describe('Gatepass', () => {
  it('renders the operator reports shell with creation access', () => {
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

    const markup = renderToStaticMarkup(<Gatepass />);

    expect(markup).toContain('Gatepass');
    expect(markup).toContain('Admin and IT dispatch tracking with creation, pending signatures, saved PDFs, and reporting.');
    expect(markup).toContain('Create Gatepass');
    expect(markup).toContain('Pending Signatures');
    expect(markup).toContain('Vault &amp; Records');
    expect(markup).toContain('Gatepass report register');
    expect(markup).toContain('Export CSV');
    expect(markup).not.toContain('Auditor access is read-only on gatepass.');
  });

  it('renders the auditor shell without the create workflow entry', () => {
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

    const markup = renderToStaticMarkup(<Gatepass />);

    expect(markup).toContain('Gatepass');
    expect(markup).toContain('Auditor access is read-only on gatepass.');
    expect(markup).not.toContain('Create Gatepass');
    expect(markup).toContain('Pending Signatures');
    expect(markup).toContain('Reports');
    expect(markup).toContain('Gatepass report register');
  });
});