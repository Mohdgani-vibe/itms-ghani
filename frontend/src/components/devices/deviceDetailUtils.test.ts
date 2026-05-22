import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  alertStatusBadgeClassName,
  alertStatusLabel,
  formatDate,
  formatDetailValue,
  severityBadgeClassName,
} from './deviceDetailUtils';

describe('deviceDetailUtils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats missing and present detail values', () => {
    expect(formatDetailValue()).toBe('Not reported');
    expect(formatDetailValue('', 'Unavailable')).toBe('Unavailable');
    expect(formatDetailValue('Ubuntu 24.04')).toBe('Ubuntu 24.04');
  });

  it('formats missing and present dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T04:00:00Z'));

    expect(formatDate()).toBe('Not available');
    expect(formatDate('2026-05-01T10:20:00Z')).toBe(new Date('2026-05-01T10:20:00Z').toLocaleString());
  });

  it('maps severity and alert statuses to the expected labels and classes', () => {
    expect(severityBadgeClassName('critical')).toBe('bg-red-100 text-red-700');
    expect(severityBadgeClassName('warning')).toBe('bg-amber-100 text-amber-700');
    expect(severityBadgeClassName('low')).toBe('bg-emerald-100 text-emerald-700');

    expect(alertStatusLabel({ acknowledged: false, resolved: false })).toBe('Open');
    expect(alertStatusLabel({ acknowledged: true, resolved: false })).toBe('Acknowledged');
    expect(alertStatusLabel({ acknowledged: false, resolved: true })).toBe('Resolved');

    expect(alertStatusBadgeClassName({ acknowledged: false, resolved: false })).toBe('bg-rose-100 text-rose-700');
    expect(alertStatusBadgeClassName({ acknowledged: true, resolved: false })).toBe('bg-amber-100 text-amber-700');
    expect(alertStatusBadgeClassName({ acknowledged: false, resolved: true })).toBe('bg-emerald-100 text-emerald-700');
  });
});