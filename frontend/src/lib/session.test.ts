import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredSession,
  getAllowedPortalSegments,
  getDefaultPortalForRole,
  getPortalSegmentForRole,
  getPreferredPortalPath,
  getShortName,
  getStoredSession,
  isProfileSetupRequired,
  normalizeAuthUser,
  normalizeLoginIdentifier,
  setStoredSession,
} from './session';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function encodeBase64(value: string) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new TextEncoder().encode(value);
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;

    output += characters[(combined >> 18) & 63];
    output += characters[(combined >> 12) & 63];
    output += index + 1 < bytes.length ? characters[(combined >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? characters[combined & 63] : '=';
  }

  return output;
}

function decodeBase64(value: string) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sanitized = value.replace(/=+$/g, '');
  const bytes: number[] = [];

  for (let index = 0; index < sanitized.length; index += 4) {
    const first = characters.indexOf(sanitized[index] ?? 'A');
    const second = characters.indexOf(sanitized[index + 1] ?? 'A');
    const thirdChar = sanitized[index + 2];
    const fourthChar = sanitized[index + 3];
    const third = thirdChar ? characters.indexOf(thirdChar) : -1;
    const fourth = fourthChar ? characters.indexOf(fourthChar) : -1;
    const combined = (first << 18) | (second << 12) | ((Math.max(third, 0) & 63) << 6) | (Math.max(fourth, 0) & 63);

    bytes.push((combined >> 16) & 255);
    if (thirdChar && thirdChar !== '=') {
      bytes.push((combined >> 8) & 255);
    }
    if (fourthChar && fourthChar !== '=') {
      bytes.push(combined & 255);
    }
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}

function createToken(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  const base64 = encodeBase64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `header.${base64}.signature`;
}

describe('session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps roles to portal segments, default portals, and preferred destinations', () => {
    expect(getPortalSegmentForRole('super_admin')).toBe('admin');
    expect(getPortalSegmentForRole('it_team')).toBe('it');
    expect(getPortalSegmentForRole('auditor')).toBe('it');
    expect(getPortalSegmentForRole('employee')).toBe('emp');

    expect(getDefaultPortalForRole('super_admin')).toBe('/admin/dashboard');
    expect(getDefaultPortalForRole('employee')).toBe('/emp/dashboard');

    expect(isProfileSetupRequired({ role: 'employee', departmentId: null, locationId: 'loc-1' })).toBe(true);
    expect(isProfileSetupRequired({ role: 'employee', departmentId: 'dept-1', locationId: 'loc-1' })).toBe(false);
    expect(getPreferredPortalPath({
      id: 'user-1',
      email: 'alex@example.com',
      fullName: 'Alex Kumar',
      role: 'employee',
      departmentId: null,
      locationId: null,
      defaultPortal: '/emp/dashboard',
      portals: ['employee'],
    })).toBe('/emp/profile');
  });

  it('normalizes portal access, short names, login identifiers, and auth user payloads', () => {
    expect(getAllowedPortalSegments({ role: 'super_admin', portals: ['super_admin'] })).toEqual(['admin']);
    expect(getAllowedPortalSegments({ role: 'auditor', portals: ['auditor'] })).toEqual(['audit']);

    expect(getShortName('Alex Kumar', 'employee')).toBe('AK');
    expect(getShortName('Any User', 'it_team')).toBe('IT');
    expect(getShortName('Any User', 'super_admin')).toBe('SA');

    expect(normalizeLoginIdentifier(' Alex ')).toBe('alex@zerodha.com');
    expect(normalizeLoginIdentifier('alex@example.com')).toBe('alex@example.com');

    expect(normalizeAuthUser({
      id: 'user-1',
      email: 'alex@example.com',
      role: 'employee',
      full_name: 'Alex Kumar',
      dept_id: 'dept-1',
      location_id: 'loc-1',
      default_portal: '/employee/dashboard',
      portals: ['employee'],
    })).toMatchObject({
      fullName: 'Alex Kumar',
      departmentId: 'dept-1',
      locationId: 'loc-1',
      defaultPortal: '/emp/dashboard',
      portals: ['employee'],
    });
  });

  it('stores, reads, and clears normalized sessions from local storage', () => {
    const storage = createStorage();
    vi.stubGlobal('window', {
      localStorage: storage,
      atob: (value: string) => decodeBase64(value),
    });

    const token = createToken({
      uid: 'user-1',
      email: 'alex@example.com',
      role: 'employee',
      name: 'Alex Kumar',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    setStoredSession({
      token,
      shortName: '',
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        fullName: 'Alex Kumar',
        role: 'employee',
        departmentId: 'dept-1',
        locationId: 'loc-1',
        defaultPortal: '/employee/dashboard',
        portals: [],
      },
    });

    expect(getStoredSession()).toMatchObject({
      token,
      shortName: 'AK',
      user: {
        defaultPortal: '/emp/dashboard',
        portals: ['employee'],
      },
    });
    expect(storage.getItem('itms_token')).toBe(token);

    clearStoredSession();
    expect(storage.getItem('itms_session')).toBeNull();
    expect(storage.getItem('itms_token')).toBeNull();
  });
});