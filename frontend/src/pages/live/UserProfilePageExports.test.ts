import { describe, expect, it } from 'vitest';

import UserProfilePage, { UserProfilePage as NamedUserProfilePage } from './UserProfilePage';

describe('UserProfilePage exports', () => {
  it('exports the page component as both default and named functions', () => {
    expect(typeof UserProfilePage).toBe('function');
    expect(typeof NamedUserProfilePage).toBe('function');
  });
});