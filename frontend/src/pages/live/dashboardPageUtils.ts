import type { PatchRunReportSummary } from '../../lib/patchReports';
import { assetPresenceState } from '../../components/users/userDisplayUtils';

export interface SimpleItem {
  id: string;
  title?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
  createdAt?: string;
  status?: string;
  severity?: string;
  kind?: string;
  lastSeenAt?: string | null;
  user?: {
    fullName?: string;
    employeeCode?: string;
  } | null;
}

export interface TrendPoint {
  label: string;
  shortLabel: string;
  value: number;
}

export type TrendWindowDays = 7 | 30 | 90;

export interface WeeklyTrendCard {
  title: string;
  description: string;
  series: Array<{
    label: string;
    tone: string;
    points: TrendPoint[];
    previousPoints?: TrendPoint[];
  }>;
}

interface TrendSummary {
  total: number;
  peakLabel: string;
  peakValue: number;
  latestLabel: string;
  latestValue: number;
  averagePerDay: number;
  activeDays: number;
  dayOverDayChange: number | null;
}

export function formatWhen(value?: string) {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleString();
}

export function formatRelativeWhen(value?: string) {
  if (!value) {
    return 'Just now';
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));
  if (deltaMinutes < 1) {
    return 'Just now';
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  return `${Math.round(deltaHours / 24)}d ago`;
}

export function buildTrendFrame(days: TrendWindowDays, offsetDays = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - offsetDays);

  return Array.from({ length: days }, (_item, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - ((days - 1) - index));
    const isoDay = day.toISOString().slice(0, 10);
    return {
      isoDay,
      label: days <= 7
        ? day.toLocaleDateString([], { weekday: 'short' })
        : day.toLocaleDateString([], { day: 'numeric' }),
      shortLabel: days <= 7
        ? day.toLocaleDateString([], { day: 'numeric' })
        : day.toLocaleDateString([], { month: 'short' }),
    };
  });
}

export function buildTrend(values: Array<string | null | undefined>, days: TrendWindowDays, offsetDays = 0) {
  const frame = buildTrendFrame(days, offsetDays);
  const counts = new Map(frame.map((item) => [item.isoDay, 0]));

  values.forEach((value) => {
    if (!value) {
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const isoDay = parsed.toISOString().slice(0, 10);
    if (!counts.has(isoDay)) {
      return;
    }
    counts.set(isoDay, (counts.get(isoDay) || 0) + 1);
  });

  return frame.map((item) => ({
    label: item.label,
    shortLabel: item.shortLabel,
    value: counts.get(item.isoDay) || 0,
  }));
}

export function buildPatchTrend(reports: PatchRunReportSummary[], days: TrendWindowDays, offsetDays = 0) {
  const frame = buildTrendFrame(days, offsetDays);
  const updated = new Map(frame.map((item) => [item.isoDay, 0]));
  const notUpdated = new Map(frame.map((item) => [item.isoDay, 0]));

  reports.forEach((report) => {
    const sourceDate = report.completedAt || report.requestedAt;
    if (!sourceDate) {
      return;
    }
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const isoDay = parsed.toISOString().slice(0, 10);
    if (!updated.has(isoDay)) {
      return;
    }
    updated.set(isoDay, (updated.get(isoDay) || 0) + report.successCount);
    notUpdated.set(isoDay, (notUpdated.get(isoDay) || 0) + report.failedCount);
  });

  return {
    updated: frame.map((item) => ({
      label: item.label,
      shortLabel: item.shortLabel,
      value: updated.get(item.isoDay) || 0,
    })),
    notUpdated: frame.map((item) => ({
      label: item.label,
      shortLabel: item.shortLabel,
      value: notUpdated.get(item.isoDay) || 0,
    })),
  };
}

export function sumValuesForMonth(values: Array<string | null | undefined>, monthOffset = 0) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);

  return values.reduce((sum, value) => {
    if (!value) {
      return sum;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return sum;
    }
    return parsed >= monthStart && parsed < nextMonthStart ? sum + 1 : sum;
  }, 0);
}

export function sumPatchValuesForMonth(reports: PatchRunReportSummary[], field: 'updated' | 'notUpdated', monthOffset = 0) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);

  return reports.reduce((sum, report) => {
    const sourceDate = report.completedAt || report.requestedAt;
    if (!sourceDate) {
      return sum;
    }
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime()) || parsed < monthStart || parsed >= nextMonthStart) {
      return sum;
    }
    return sum + (field === 'updated' ? report.successCount : report.failedCount);
  }, 0);
}

export function isSameLocalDay(value: string, target: Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === target.getFullYear()
    && parsed.getMonth() === target.getMonth()
    && parsed.getDate() === target.getDate();
}

export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  if (!points.length) {
    return {
      total: 0,
      peakLabel: '-',
      peakValue: 0,
      latestLabel: '-',
      latestValue: 0,
      averagePerDay: 0,
      activeDays: 0,
      dayOverDayChange: null,
    };
  }

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peakPoint = points.reduce((highest, point) => (point.value > highest.value ? point : highest), points[0]);
  const latestPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const activeDays = points.filter((point) => point.value > 0).length;
  const dayOverDayChange = previousPoint
    ? (previousPoint.value === 0 ? (latestPoint.value === 0 ? 0 : null) : ((latestPoint.value - previousPoint.value) / previousPoint.value) * 100)
    : null;

  return {
    total,
    peakLabel: peakPoint.label,
    peakValue: peakPoint.value,
    latestLabel: latestPoint.label,
    latestValue: latestPoint.value,
    averagePerDay: total / points.length,
    activeDays,
    dayOverDayChange,
  };
}

export function formatPercentChange(value: number | null) {
  if (value == null) {
    return 'No prior baseline';
  }
  if (value === 0) {
    return '0.0% vs previous day';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}% vs previous day`;
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

export function formatMonthOverMonthChange(value: number | null) {
  if (value == null) {
    return 'No last month baseline';
  }
  if (value === 0) {
    return '0.0% vs last month';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}% vs last month`;
}

export function formatShare(value: number) {
  return `${value.toFixed(1)}% share`;
}

export function summarizeCardSeries(series: WeeklyTrendCard['series'], usePreviousPoints = false) {
  const sourcePoints = usePreviousPoints ? (series[0]?.previousPoints ?? []) : (series[0]?.points ?? []);
  const dailyTotals = sourcePoints.map((point, index) => ({
    label: point.label,
    shortLabel: point.shortLabel,
    total: series.reduce((sum, item) => sum + ((usePreviousPoints ? item.previousPoints?.[index]?.value : item.points[index]?.value) || 0), 0),
  }));
  const weeklyTotal = dailyTotals.reduce((sum, item) => sum + item.total, 0);
  const peakDay = dailyTotals.reduce((highest, item) => (item.total > highest.total ? item : highest), dailyTotals[0] ?? { label: '-', shortLabel: '-', total: 0 });
  const latestDay = dailyTotals[dailyTotals.length - 1] ?? { label: '-', shortLabel: '-', total: 0 };

  return {
    dailyTotals,
    weeklyTotal,
    averagePerDay: dailyTotals.length ? weeklyTotal / dailyTotals.length : 0,
    peakDay,
    latestDay,
  };
}

export function countOfflineUsersFromDevices(devices: SimpleItem[]) {
  const userPresence = new Map<string, { hasRecent: boolean; hasOffline: boolean }>();

  devices.forEach((device) => {
    const userKey = device.user?.employeeCode || device.user?.fullName;
    if (!userKey) {
      return;
    }

    const presence = assetPresenceState(device.lastSeenAt);
    const current = userPresence.get(userKey) || { hasRecent: false, hasOffline: false };

    if (presence.label === 'Recently Seen') {
      current.hasRecent = true;
    }
    if (presence.label === 'Offline') {
      current.hasOffline = true;
    }

    userPresence.set(userKey, current);
  });

  return Array.from(userPresence.values()).filter((entry) => entry.hasOffline && !entry.hasRecent).length;
}