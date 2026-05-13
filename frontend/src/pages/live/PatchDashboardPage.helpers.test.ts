import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });
});

import {
  buildDepartmentPresenceSummary,
  buildPatchMetrics,
  formatPatchStatusLabel,
  formatReportTimestamp,
  getFeaturedReportTone,
  getPatchStatusBadgeClassName,
  isDeviceOnline,
  parseReportDateRange,
  parseReportSort,
  renderPackageChangeSummary,
  shouldShowReportRowMessage,
} from './PatchDashboardPage';

describe('PatchDashboardPage helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds patch metrics and status display labels', () => {
    expect(buildPatchMetrics([
      { id: '1', hostname: 'a', complianceScore: 0, patchStatus: 'up_to_date' },
      { id: '2', hostname: 'b', complianceScore: 0, patchStatus: 'pending' },
      { id: '3', hostname: 'c', complianceScore: 0, patchStatus: 'failed' },
      { id: '4', hostname: 'd', complianceScore: 0, patchStatus: 'reboot_pending' },
      { id: '5', hostname: 'e', complianceScore: 0 },
    ] as never)).toEqual({
      total: 5,
      upToDate: 1,
      pending: 1,
      failed: 1,
      rebootPending: 1,
    });
    expect(formatPatchStatusLabel('reboot_pending')).toBe('reboot pending');
    expect(formatPatchStatusLabel('')).toBe('Unknown');
    expect(getPatchStatusBadgeClassName('failed')).toBe('bg-red-100 text-red-700');
    expect(getPatchStatusBadgeClassName('pending')).toBe('bg-amber-100 text-amber-700');
    expect(getPatchStatusBadgeClassName('up_to_date')).toBe('bg-emerald-100 text-emerald-700');
    expect(getPatchStatusBadgeClassName('other')).toBe('bg-zinc-100 text-zinc-700');
  });

  it('classifies device presence and summarizes departments', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    expect(isDeviceOnline({
      id: '1',
      hostname: 'alpha',
      complianceScore: 95,
      lastSeenAt: '2026-05-09T08:00:00Z',
    } as never)).toBe(true);
    expect(isDeviceOnline({
      id: '2',
      hostname: 'beta',
      complianceScore: 88,
      lastSeenAt: '2026-05-07T08:00:00Z',
    } as never)).toBe(false);

    expect(buildDepartmentPresenceSummary([
      {
        id: '1',
        hostname: 'alpha',
        complianceScore: 95,
        lastSeenAt: '2026-05-09T08:00:00Z',
        department: { name: 'IT' },
      },
      {
        id: '2',
        hostname: 'beta',
        complianceScore: 88,
        lastSeenAt: '2026-05-07T08:00:00Z',
        department: { name: 'IT' },
      },
      {
        id: '3',
        hostname: 'gamma',
        complianceScore: 82,
        lastSeenAt: undefined,
        department: { name: ' Finance ' },
      },
    ] as never)).toEqual([
      { name: 'IT', total: 2, online: 1, offline: 1 },
      { name: 'Finance', total: 1, online: 0, offline: 1 },
    ]);
  });

  it('formats report timestamps and row messaging', () => {
    expect(formatReportTimestamp('not-a-date')).toBe('Unknown time');
    expect(formatReportTimestamp('2026-05-09T10:00:00Z')).not.toBe('Unknown time');

    const packageMarkup = renderToStaticMarkup(renderPackageChangeSummary({
      deviceId: 'dev-1',
      packageChanges: [
        { name: 'openssl', fromVersion: '1.0', toVersion: '1.1' },
        { name: 'curl', toVersion: '8.0' },
      ],
      updatedItems: [],
      message: 'Applied updates',
    } as never));
    expect(packageMarkup).toContain('openssl');
    expect(packageMarkup).toContain('1.0 -&gt; 1.1');
    expect(packageMarkup).toContain('+ 8.0');

    const fallbackMarkup = renderToStaticMarkup(renderPackageChangeSummary({
      deviceId: 'dev-1',
      packageChanges: [],
      updatedItems: ['pkg-a', 'pkg-b'],
      message: 'Applied updates',
    } as never));
    expect(fallbackMarkup).toContain('pkg-a, pkg-b');

    expect(shouldShowReportRowMessage({
      deviceId: 'dev-1',
      packageChanges: [],
      updatedItems: ['pkg-a', 'pkg-b'],
      message: 'pkg-a, pkg-b',
    } as never)).toBe(false);
    expect(shouldShowReportRowMessage({
      deviceId: 'dev-1',
      packageChanges: [],
      updatedItems: [],
      message: 'Manual review needed',
    } as never)).toBe(true);
    expect(shouldShowReportRowMessage({
      deviceId: 'dev-1',
      packageChanges: [{ name: 'openssl' }],
      updatedItems: ['openssl'],
      message: 'Applied updates',
    } as never)).toBe(true);
  });

  it('parses report filters and featured tone defaults', () => {
    expect(getFeaturedReportTone(0)).toBe('border-emerald-200 bg-emerald-50 text-emerald-700');
    expect(getFeaturedReportTone(3)).toBe('border-amber-200 bg-amber-50 text-amber-800');
    expect(parseReportDateRange('7d')).toBe('7d');
    expect(parseReportDateRange('bad-value')).toBe('30d');
    expect(parseReportDateRange(null)).toBe('30d');
    expect(parseReportSort('most-failures')).toBe('most-failures');
    expect(parseReportSort('bad-value')).toBe('newest');
    expect(parseReportSort(null)).toBe('newest');
  });
});