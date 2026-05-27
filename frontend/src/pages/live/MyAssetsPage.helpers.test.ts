import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assetPresenceState,
  formatAssignmentAge,
  formatCurrency,
  formatWarrantyWindow,
  getWarrantyBadge,
  warrantyTone,
} from './myAssetsPageUtils';

describe('MyAssetsPage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('categorizes warranty dates into urgency badges', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T00:00:00Z').getTime());

    expect(getWarrantyBadge('')).toBe('active');
    expect(getWarrantyBadge('2026-05-14T00:00:00Z')).toBe('7_days');
    expect(getWarrantyBadge('2026-05-21T00:00:00Z')).toBe('15_days');
    expect(getWarrantyBadge('2026-06-01T00:00:00Z')).toBe('30_days');
    expect(getWarrantyBadge('2026-07-01T00:00:00Z')).toBe('active');
  });

  it('formats warranty and assignment age messaging from the current date', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T00:00:00Z').getTime());

    expect(formatWarrantyWindow('')).toBe('Warranty date not set');
    expect(formatWarrantyWindow('2026-05-08T00:00:00Z')).toBe('Expired 1 day ago');
    expect(formatWarrantyWindow('2026-05-09T00:00:00Z')).toBe('Expires today');
    expect(formatWarrantyWindow('2026-05-12T00:00:00Z')).toBe('3 days remaining');
    expect(formatAssignmentAge()).toBe('Assignment date not available');
    expect(formatAssignmentAge('2026-05-07T00:00:00Z')).toBe('In use for 2 days');
  });

  it('formats cost and warranty tone labels', () => {
    expect(formatCurrency()).toBe('Cost not tracked');
    expect(formatCurrency('abc')).toBe('abc');
    expect(formatCurrency('1200')).toContain('1,200');
    expect(warrantyTone('7_days')).toBe('bg-red-100 text-red-700');
    expect(warrantyTone('30_days')).toBe('bg-amber-100 text-amber-700');
    expect(warrantyTone('active')).toBe('bg-emerald-100 text-emerald-700');
  });

  it('reports retained, recent, and offline device presence', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T12:00:00Z').getTime());

    expect(assetPresenceState()).toMatchObject({
      label: 'Retained',
      classes: 'bg-zinc-100 text-zinc-700',
    });
    expect(assetPresenceState('not-a-date')).toMatchObject({
      label: 'Retained',
      classes: 'bg-zinc-100 text-zinc-700',
    });
    expect(assetPresenceState('2026-05-09T08:00:00Z')).toMatchObject({
      label: 'Recently Seen',
      classes: 'bg-emerald-100 text-emerald-700',
    });
    expect(assetPresenceState('2026-05-07T08:00:00Z')).toMatchObject({
      label: 'Offline',
      classes: 'bg-amber-100 text-amber-800',
    });
  });
});