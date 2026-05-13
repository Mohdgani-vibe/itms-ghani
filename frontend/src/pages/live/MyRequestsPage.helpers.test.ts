import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatDateTime,
  formatRelativeTime,
  getStatusClasses,
  normalizeRequestRecord,
} from './MyRequestsPage';

describe('MyRequestsPage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes optional request fields and comments', () => {
    expect(normalizeRequestRecord({
      id: 'req-1',
      type: 'Other',
      title: '',
      description: '',
      status: 'pending',
      notes: '',
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:00:00Z',
      comments: [null, { id: 'c-1', author: 'A', note: 'note', createdAt: '2026-05-09T10:00:00Z' }] as never,
    })).toMatchObject({
      title: '',
      description: '',
      notes: '',
      comments: [{ id: 'c-1', author: 'A', note: 'note', createdAt: '2026-05-09T10:00:00Z' }],
    });
  });

  it('formats absolute and relative times from the current clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T12:00:00Z').getTime());

    expect(formatDateTime('2026-05-09T10:00:00Z')).not.toBe('Invalid Date');
    expect(formatRelativeTime('2026-05-09T11:59:00Z')).toBe('1m ago');
    expect(formatRelativeTime('2026-05-09T10:00:00Z')).toBe('2h ago');
    expect(formatRelativeTime('2026-05-07T12:00:00Z')).toBe('2d ago');
  });

  it('returns the expected status class names', () => {
    expect(getStatusClasses('resolved')).toBe('bg-emerald-100 text-emerald-700');
    expect(getStatusClasses('rejected')).toBe('bg-rose-100 text-rose-700');
    expect(getStatusClasses('in_progress')).toBe('bg-amber-100 text-amber-700');
    expect(getStatusClasses('pending')).toBe('bg-zinc-100 text-zinc-600');
  });
});