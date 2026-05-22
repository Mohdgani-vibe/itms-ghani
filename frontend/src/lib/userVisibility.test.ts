import { describe, expect, it } from 'vitest';

import { isProbeLikeUser } from './userVisibility';

describe('isProbeLikeUser', () => {
  it('detects probe-like users from name, email, or employee code', () => {
    expect(isProbeLikeUser({ fullName: 'Probe Device' })).toBe(true);
    expect(isProbeLikeUser({ email: 'smoke@example.com' })).toBe(true);
    expect(isProbeLikeUser({ employeeCode: 'EMP-SMOKE-1' })).toBe(true);
  });

  it('returns false for normal users', () => {
    expect(isProbeLikeUser({ fullName: 'Alex Kumar', email: 'alex@example.com', employeeCode: 'EMP-1' })).toBe(false);
  });
});