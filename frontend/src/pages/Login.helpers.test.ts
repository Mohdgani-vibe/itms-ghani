import { describe, expect, it } from 'vitest';

import { normalizeAuthErrorMessage } from './loginUtils';

describe('Login helpers', () => {
  it('maps known authentication failures to the shared support message', () => {
    expect(normalizeAuthErrorMessage('authentication failed')).toBe(
      'Sign-in failed. Check your email or employee ID and password, or contact IT if you need access help.',
    );
    expect(normalizeAuthErrorMessage(' Wrong Password ')).toBe(
      'Sign-in failed. Check your email or employee ID and password, or contact IT if you need access help.',
    );
    expect(normalizeAuthErrorMessage('non-zerodha domain is not allowed')).toBe(
      'Sign-in failed. Check your email or employee ID and password, or contact IT if you need access help.',
    );
  });

  it('preserves unrelated error messages', () => {
    expect(normalizeAuthErrorMessage('Temporary outage')).toBe('Temporary outage');
  });
});