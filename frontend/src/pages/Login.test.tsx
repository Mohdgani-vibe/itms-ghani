import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const loginMocks = vi.hoisted(() => ({
  useNavigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: loginMocks.useNavigateMock,
  };
});

import Login from './Login';

describe('Login', () => {
  it('renders the initial sign-in shell before the password form is opened', () => {
    loginMocks.useNavigateMock.mockReturnValue(vi.fn());

    const markup = renderToStaticMarkup(<Login />);

    expect(markup).toContain('Zerodha ITMS');
    expect(markup).toContain('Sign in to your portal');
    expect(markup).toContain('Use email and password');
    expect(markup).toContain('Google SSO not configured');
    expect(markup).not.toContain('href="#"');
    expect(markup).not.toContain('Email / Employee ID');
    expect(markup).not.toContain('Signing in...');
  });
});