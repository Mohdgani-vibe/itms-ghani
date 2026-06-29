import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRecentChatPanelItems,
  buildPatchTrend,
  buildTrend,
  buildTrendFrame,
  calculatePercentChange,
  countOfflineUsersFromDevices,
  formatWhen,
  formatMonthOverMonthChange,
  formatPercentChange,
  formatRelativeWhen,
  formatShare,
  isSameLocalDay,
  sumPatchValuesForMonth,
  sumValuesForMonth,
  summarizeCardSeries,
  summarizeTrend,
} from './dashboardPageUtils';

describe('DashboardPage helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats recent timestamps relative to the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    expect(formatWhen()).toBe('Just now');
    expect(formatWhen('2026-05-09T11:00:00Z')).not.toBe('Just now');
    expect(formatRelativeWhen()).toBe('Just now');
    expect(formatRelativeWhen('2026-05-09T11:59:30Z')).toBe('1m ago');
    expect(formatRelativeWhen('2026-05-09T10:00:00Z')).toBe('2h ago');
    expect(formatRelativeWhen('2026-05-07T12:00:00Z')).toBe('2d ago');
  });

  it('builds trend points inside the derived frame window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    const frame = buildTrendFrame(7);
    const lastDay = frame[6].isoDay;
    const previousDay = frame[5].isoDay;
    const points = buildTrend([
      `${previousDay}T12:00:00Z`,
      `${lastDay}T08:00:00Z`,
      `${lastDay}T09:00:00Z`,
      'invalid',
      null,
    ], 7);

    expect(points).toHaveLength(7);
    expect(points[5]?.value).toBe(1);
    expect(points[6]?.value).toBe(2);
    expect(points.reduce((sum, point) => sum + point.value, 0)).toBe(3);
  });

  it('summarizes trend totals and percent changes', () => {
    const summary = summarizeTrend([
      { label: 'Mon', shortLabel: '1', value: 1 },
      { label: 'Tue', shortLabel: '2', value: 3 },
      { label: 'Wed', shortLabel: '3', value: 6 },
    ]);

    expect(summary).toMatchObject({
      total: 10,
      peakLabel: 'Wed',
      peakValue: 6,
      latestLabel: 'Wed',
      latestValue: 6,
      activeDays: 3,
    });
    expect(summary.averagePerDay).toBeCloseTo(10 / 3);
    expect(summary.dayOverDayChange).toBe(100);
    expect(calculatePercentChange(6, 3)).toBe(100);
    expect(calculatePercentChange(0, 0)).toBe(0);
    expect(calculatePercentChange(5, 0)).toBeNull();
    expect(formatPercentChange(100)).toBe('+100.0% vs previous day');
    expect(formatPercentChange(0)).toBe('0.0% vs previous day');
    expect(formatPercentChange(null)).toBe('No prior baseline');
    expect(formatMonthOverMonthChange(-12.5)).toBe('-12.5% vs last month');
    expect(formatMonthOverMonthChange(null)).toBe('No last month baseline');
    expect(formatShare(37.25)).toBe('37.3% share');
  });

  it('counts users as offline only when none of their devices are recently seen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    expect(countOfflineUsersFromDevices([
      {
        id: '1',
        lastSeenAt: '2026-05-07T08:00:00Z',
        user: { fullName: 'Alex Kumar', employeeCode: 'EMP-1' },
      },
      {
        id: '2',
        lastSeenAt: '2026-05-09T08:00:00Z',
        user: { fullName: 'Sam Lee', employeeCode: 'EMP-2' },
      },
      {
        id: '3',
        lastSeenAt: '2026-05-07T08:00:00Z',
        user: { fullName: 'Sam Lee', employeeCode: 'EMP-2' },
      },
      {
        id: '4',
        lastSeenAt: undefined,
        user: { fullName: 'No Signal', employeeCode: 'EMP-3' },
      },
    ] as never)).toBe(1);
  });

  it('aggregates patch trends and monthly totals from the current date window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    const frame = buildTrendFrame(7);
    const lastDay = frame[6].isoDay;
    const previousDay = frame[5].isoDay;
    const trend = buildPatchTrend([
      {
        requestedAt: `${previousDay}T09:00:00Z`,
        completedAt: `${previousDay}T10:00:00Z`,
        successCount: 2,
        failedCount: 1,
      },
      {
        requestedAt: `${lastDay}T09:00:00Z`,
        completedAt: `${lastDay}T10:00:00Z`,
        successCount: 3,
        failedCount: 2,
      },
    ] as never, 7);

    expect(trend.updated[5]?.value).toBe(2);
    expect(trend.updated[6]?.value).toBe(3);
    expect(trend.notUpdated[5]?.value).toBe(1);
    expect(trend.notUpdated[6]?.value).toBe(2);

    expect(sumValuesForMonth([
      '2026-05-01T00:00:00Z',
      '2026-05-09T00:00:00Z',
      '2026-04-30T23:59:59Z',
      'invalid',
    ])).toBe(2);
    expect(sumPatchValuesForMonth([
      {
        requestedAt: '2026-05-02T00:00:00Z',
        completedAt: '2026-05-02T01:00:00Z',
        successCount: 5,
        failedCount: 1,
      },
      {
        requestedAt: '2026-04-28T00:00:00Z',
        completedAt: '2026-04-28T01:00:00Z',
        successCount: 4,
        failedCount: 3,
      },
    ] as never, 'updated')).toBe(5);
    expect(sumPatchValuesForMonth([
      {
        requestedAt: '2026-05-02T00:00:00Z',
        completedAt: '2026-05-02T01:00:00Z',
        successCount: 5,
        failedCount: 1,
      },
    ] as never, 'notUpdated')).toBe(1);
  });

  it('checks local-day equality and summarizes card series totals', () => {
    expect(isSameLocalDay('2026-05-09T10:00:00Z', new Date('2026-05-09T00:00:00Z'))).toBe(true);
    expect(isSameLocalDay('invalid', new Date('2026-05-09T00:00:00Z'))).toBe(false);

    const summary = summarizeCardSeries([
      {
        label: 'Updated',
        tone: 'green',
        points: [
          { label: 'Mon', shortLabel: '1', value: 1 },
          { label: 'Tue', shortLabel: '2', value: 3 },
        ],
        previousPoints: [
          { label: 'Mon', shortLabel: '1', value: 2 },
          { label: 'Tue', shortLabel: '2', value: 1 },
        ],
      },
      {
        label: 'Failed',
        tone: 'red',
        points: [
          { label: 'Mon', shortLabel: '1', value: 4 },
          { label: 'Tue', shortLabel: '2', value: 2 },
        ],
        previousPoints: [
          { label: 'Mon', shortLabel: '1', value: 1 },
          { label: 'Tue', shortLabel: '2', value: 5 },
        ],
      },
    ]);

    expect(summary.weeklyTotal).toBe(10);
    expect(summary.averagePerDay).toBe(5);
    expect(summary.peakDay).toMatchObject({ label: 'Mon', total: 5 });
    expect(summary.latestDay).toMatchObject({ label: 'Tue', total: 5 });

    const previousSummary = summarizeCardSeries([
      {
        label: 'Updated',
        tone: 'green',
        points: [
          { label: 'Mon', shortLabel: '1', value: 1 },
        ],
        previousPoints: [
          { label: 'Mon', shortLabel: '1', value: 2 },
        ],
      },
      {
        label: 'Failed',
        tone: 'red',
        points: [
          { label: 'Mon', shortLabel: '1', value: 4 },
        ],
        previousPoints: [
          { label: 'Mon', shortLabel: '1', value: 1 },
        ],
      },
    ], true);

    expect(previousSummary.weeklyTotal).toBe(3);
    expect(previousSummary.peakDay).toMatchObject({ label: 'Mon', total: 3 });
  });

  it('builds recent chat panel items with preview and fallback labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    const items = buildRecentChatPanelItems([
      {
        id: 'chat-1',
        name: 'VPN Support',
        kind: 'support',
        latestMessage: {
          authorName: 'Employee One',
          body: 'Need help with VPN',
          createdAt: '2026-05-09T11:30:00Z',
        },
      },
      {
        id: 'chat-2',
        title: 'Ops Queue',
        kind: 'operations',
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'chat-1',
      title: 'VPN Support',
      meta: 'Employee One: Need help with VPN',
      badge: 'Support',
    });
    expect(items[0]?.timestamp).toBe('30m ago');
    expect(items[1]).toMatchObject({
      id: 'chat-2',
      title: 'Ops Queue',
      meta: 'operations chat channel',
      badge: 'Operations',
      timestamp: 'Waiting for activity',
    });
  });
});