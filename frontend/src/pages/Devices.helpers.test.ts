import { describe, expect, it } from 'vitest';

import { formatCurrency, formatDateTime } from './Devices';

describe('Devices helpers', () => {
  it('formats timestamps with graceful fallbacks', () => {
    expect(formatDateTime()).toBe('-');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('2026-05-09T10:00:00Z')).not.toBe('-');
  });

  it('formats device costs with currency and fallback handling', () => {
    expect(formatCurrency()).toBe('Cost not tracked');
    expect(formatCurrency('abc')).toBe('abc');
    expect(formatCurrency('1200')).toContain('1,200');
  });
});