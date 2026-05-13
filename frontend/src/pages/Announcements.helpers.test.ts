import { describe, expect, it } from 'vitest';

import { formatAnnouncementTimestamp, getVisibleAudiences } from './Announcements';

describe('Announcements helpers', () => {
  it('formats valid timestamps and falls back for invalid values', () => {
    expect(formatAnnouncementTimestamp('not-a-date')).toBe('-');
    expect(formatAnnouncementTimestamp('2026-05-09T10:30:00Z')).not.toBe('-');
  });

  it('returns the publishable audiences for posters', () => {
    expect(getVisibleAudiences('super_admin', true)).toEqual([
      'All Employees',
      'IT Team',
      'Super Admin',
    ]);
  });

  it('limits visible audiences for read-only roles', () => {
    expect(getVisibleAudiences('super_admin', false)).toEqual(['All Employees', 'Super Admin']);
    expect(getVisibleAudiences('it_team', false)).toEqual(['All Employees', 'IT Team']);
    expect(getVisibleAudiences('auditor', false)).toEqual(['All Employees']);
  });
});