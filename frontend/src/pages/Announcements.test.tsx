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

import Announcements from './Announcements';

describe('Announcements', () => {
  it('renders the broadcast shell and publish controls for IT managers', () => {
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

    const markup = renderToStaticMarkup(<Announcements />);

    expect(markup).toContain('Broadcast Center');
    expect(markup).toContain('Company announcements with a clearer broadcast view.');
    expect(markup).toContain('Broadcast pulse');
    expect(markup).toContain('New announcement');
    expect(markup).toContain('Publish panel');
    expect(markup).toContain('Post Announcement');
    expect(markup).toContain('Audience Filters');
  });

  it('renders the read-only auditor notice without publish controls', () => {
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

    const markup = renderToStaticMarkup(<Announcements />);

    expect(markup).toContain('Broadcast Center');
    expect(markup).toContain('Auditor access is read-only.');
    expect(markup).not.toContain('Publish panel');
    expect(markup).not.toContain('Post Announcement');
    expect(markup).not.toContain('Audience Filters');
  });
});