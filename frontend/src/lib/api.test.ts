import { afterEach, describe, expect, it, vi } from 'vitest';

const { getStoredSessionMock, clearStoredSessionMock } = vi.hoisted(() => ({
  getStoredSessionMock: vi.fn(),
  clearStoredSessionMock: vi.fn(),
}));

vi.mock('./session', () => ({
  getStoredSession: getStoredSessionMock,
  clearStoredSession: clearStoredSessionMock,
}));

import {
  apiRequest,
  resetAuthRedirectState,
  resolveApiUrl,
  resolveWebSocketUrl,
  validateStoredSession,
} from './api';

function createJsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    getStoredSessionMock.mockReset();
    clearStoredSessionMock.mockReset();
    resetAuthRedirectState();
  });

  it('resolves relative api and websocket urls against the current window location', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        host: 'itms.example.com',
      },
    });

    expect(resolveApiUrl('/api/users')).toBe('/api/users');
    expect(resolveApiUrl('https://external.example.com')).toBe('https://external.example.com');
    expect(resolveWebSocketUrl('/ws/ssh')).toBe('wss://itms.example.com/ws/ssh');
    expect(resolveWebSocketUrl('wss://other/ws')).toBe('wss://other/ws');
  });

  it('sends auth and json headers on successful api requests', async () => {
    getStoredSessionMock.mockReturnValue({ token: 'token-123' });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toBeInstanceOf(Headers);
      const headers = init?.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer token-123');
      expect(headers.get('Content-Type')).toBe('application/json');
      return createJsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ ok: boolean }>('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alex' }),
    })).resolves.toEqual({ ok: true });
  });

  it('turns network failures into a backend-offline ApiError', async () => {
    getStoredSessionMock.mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    await expect(apiRequest('/api/test')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      message: 'Backend is not running. Start the API and try again.',
    });
  });

  it('clears the session and redirects to login on unauthorized responses', async () => {
    getStoredSessionMock.mockReturnValue({ token: 'token-123' });
    const replace = vi.fn();
    vi.stubGlobal('window', {
      location: {
        origin: 'https://itms.example.com',
        pathname: '/it/dashboard',
        search: '?tab=alerts',
        replace,
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => createJsonResponse({ error: 'Unauthorized' }, { status: 401 })));

    await expect(apiRequest('/api/protected')).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
    expect(clearStoredSessionMock).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('https://itms.example.com/login?next=%2Fit%2Fdashboard%3Ftab%3Dalerts');
  });

  it('validates stored sessions and clears them when the backend rejects the token', async () => {
    getStoredSessionMock.mockReturnValue({ token: 'token-123' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));

    await expect(validateStoredSession()).resolves.toBe(false);
    expect(clearStoredSessionMock).toHaveBeenCalled();
  });
});