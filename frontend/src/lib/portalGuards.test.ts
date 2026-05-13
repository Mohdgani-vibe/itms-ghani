import { describe, expect, it } from 'vitest';
import { getPageAccessRedirect, getPortalAccessRedirect, getRoleAccessRedirect } from './portalGuards';
import type { SessionUser } from './session';

function buildUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'auditor@example.com',
    fullName: 'Auditor Example',
    role: 'auditor',
    defaultPortal: '/audit/dashboard',
    portals: ['auditor'],
    ...overrides,
  };
}

describe('getPortalAccessRedirect', () => {
  it('redirects employees away from admin inventory routes', () => {
    const redirect = getPortalAccessRedirect(
      '/admin/inventory',
      buildUser({
        role: 'employee',
        departmentId: 'dept-1',
        locationId: 'loc-1',
        defaultPortal: '/emp/dashboard',
        portals: ['employee'],
      }),
    );

    expect(redirect).toBe('/emp/dashboard');
  });

  it('redirects auditors away from admin routes', () => {
    const redirect = getPortalAccessRedirect('/admin/alerts', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('redirects auditors away from it routes', () => {
    const redirect = getPortalAccessRedirect('/it/patch/devices', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('allows auditors to stay on audit routes', () => {
    const redirect = getPortalAccessRedirect('/audit/alerts', buildUser());

    expect(redirect).toBeNull();
  });

  it('allows it team users to stay on it inventory routes', () => {
    const redirect = getPortalAccessRedirect(
      '/it/inventory',
      buildUser({
        role: 'it_team',
        defaultPortal: '/it/dashboard',
        portals: ['it_team', 'employee'],
      }),
    );

    expect(redirect).toBeNull();
  });

  it('allows super admins to stay on admin inventory routes', () => {
    const redirect = getPortalAccessRedirect(
      '/admin/inventory',
      buildUser({
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin', 'it_team', 'employee'],
      }),
    );

    expect(redirect).toBeNull();
  });

  it('ignores paths outside the portal shells', () => {
    const redirect = getPortalAccessRedirect('/login', buildUser());

    expect(redirect).toBeNull();
  });
});

describe('getRoleAccessRedirect', () => {
  it('redirects auditors away from restricted standalone routes', () => {
    const redirect = getRoleAccessRedirect(buildUser(), ['super_admin', 'it_team']);

    expect(redirect).toBe('/audit/dashboard');
  });

  it('allows matching roles through restricted standalone routes', () => {
    const redirect = getRoleAccessRedirect(
      buildUser({
        role: 'it_team',
        defaultPortal: '/it/dashboard',
        portals: ['it_team', 'employee'],
      }),
      ['super_admin', 'it_team'],
    );

    expect(redirect).toBeNull();
  });
});

describe('getPageAccessRedirect', () => {
  it('redirects auditors away from audit requests pages', () => {
    const redirect = getPageAccessRedirect('/audit/requests', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('redirects auditors away from audit patch pages', () => {
    const redirect = getPageAccessRedirect('/audit/patch/devices', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('redirects auditors away from audit chat pages', () => {
    const redirect = getPageAccessRedirect('/audit/chat', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('redirects auditors away from audit settings pages', () => {
    const redirect = getPageAccessRedirect('/audit/settings', buildUser());

    expect(redirect).toBe('/audit/dashboard');
  });

  it('allows auditors to stay on allowed audit pages', () => {
    const redirect = getPageAccessRedirect('/audit/alerts', buildUser());

    expect(redirect).toBeNull();
  });

  it('allows auditors to stay on audit inventory pages', () => {
    const redirect = getPageAccessRedirect('/audit/inventory', buildUser());

    expect(redirect).toBeNull();
  });
});