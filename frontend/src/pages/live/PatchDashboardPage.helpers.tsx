import { assetPresenceState } from '../../components/users/userDisplayUtils';
import type { PatchRunReport, PatchRunReportDateRange, PatchRunReportSort } from '../../lib/patchReports';

export interface PatchMetrics {
  total: number;
  upToDate: number;
  pending: number;
  failed: number;
  rebootPending: number;
}

export interface PatchDevice {
  id: string;
  assetId?: string;
  assetTag?: string;
  hostname: string;
  patchStatus?: string;
  complianceScore: number;
  osName?: string | null;
  lastSeenAt?: string | null;
  department?: { name: string } | null;
  user?: { fullName: string } | null;
  installedApps?: {
    wps?: boolean;
    libreOffice?: boolean;
    chrome?: boolean;
    salt?: boolean;
  } | null;
}

export type PatchWorkspaceView = 'systems' | 'terminal';

const REPORT_DATE_RANGES: PatchRunReportDateRange[] = ['all', '7d', '30d', '90d'];
const REPORT_SORT_OPTIONS: PatchRunReportSort[] = ['newest', 'oldest', 'most-failures', 'most-successes'];

export function buildPatchMetrics(devices: PatchDevice[]): PatchMetrics {
  return devices.reduce<PatchMetrics>((summary, device) => {
    summary.total += 1;
    if (device.patchStatus === 'up_to_date') {
      summary.upToDate += 1;
    } else if (device.patchStatus === 'pending') {
      summary.pending += 1;
    } else if (device.patchStatus === 'failed') {
      summary.failed += 1;
    } else if (device.patchStatus === 'reboot_pending') {
      summary.rebootPending += 1;
    }
    return summary;
  }, { total: 0, upToDate: 0, pending: 0, failed: 0, rebootPending: 0 });
}

export function formatPatchStatusLabel(status?: string | null) {
  const normalizedStatus = (status || '').trim();
  return normalizedStatus ? normalizedStatus.replaceAll('_', ' ') : 'Unknown';
}

export function getPatchStatusBadgeClassName(status?: string | null) {
  if (status === 'failed') {
    return 'bg-red-100 text-red-700';
  }
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'up_to_date') {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-zinc-100 text-zinc-700';
}

export function isDeviceOnline(device: PatchDevice) {
  return assetPresenceState(device.lastSeenAt).label === 'Recently Seen';
}

export function buildDepartmentPresenceSummary(devices: PatchDevice[]) {
  const summaryByDepartment = new Map<string, { name: string; total: number; online: number; offline: number }>();

  devices.forEach((device) => {
    const departmentName = device.department?.name?.trim() || 'Unassigned';
    const current = summaryByDepartment.get(departmentName) || {
      name: departmentName,
      total: 0,
      online: 0,
      offline: 0,
    };

    current.total += 1;
    if (isDeviceOnline(device)) {
      current.online += 1;
    } else {
      current.offline += 1;
    }

    summaryByDepartment.set(departmentName, current);
  });

  return Array.from(summaryByDepartment.values()).sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }
    return left.name.localeCompare(right.name);
  });
}

export function formatReportTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

export function renderPackageChangeSummary(row: PatchRunReport['rows'][number]) {
  if (row.packageChanges.length > 0) {
    return (
      <div className="mt-2 space-y-2">
        {row.packageChanges.slice(0, 6).map((change) => (
          <div key={`${row.deviceId}-${change.name}-${change.fromVersion || ''}-${change.toVersion || ''}`} className="rounded-xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-3 py-3 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">{change.name}</div>
            <div className="mt-1 text-xs text-zinc-600">
              {change.fromVersion && change.toVersion ? `${change.fromVersion} -> ${change.toVersion}` : change.toVersion ? `+ ${change.toVersion}` : change.fromVersion ? `${change.fromVersion} -> removed` : 'Version details unavailable'}
            </div>
          </div>
        ))}
        {row.packageChanges.length > 6 ? <div className="text-xs text-zinc-500">+ {row.packageChanges.length - 6} more package change(s)</div> : null}
      </div>
    );
  }

  return <div className="mt-2 text-sm leading-6 text-zinc-700">{row.updatedItems.length > 0 ? row.updatedItems.join(', ') : row.message}</div>;
}

export function shouldShowReportRowMessage(row: PatchRunReport['rows'][number]) {
  const normalizedMessage = row.message.trim();
  if (!normalizedMessage) {
    return false;
  }

  if (row.packageChanges.length > 0) {
    return true;
  }

  const normalizedUpdatedItems = row.updatedItems.join(', ').trim();
  return !normalizedUpdatedItems || normalizedUpdatedItems !== normalizedMessage;
}

export function getFeaturedReportTone(failedCount: number) {
  return failedCount > 0
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function parseReportDateRange(value: string | null): PatchRunReportDateRange {
  if (value && REPORT_DATE_RANGES.includes(value as PatchRunReportDateRange)) {
    return value as PatchRunReportDateRange;
  }
  return '30d';
}

export function parseReportSort(value: string | null): PatchRunReportSort {
  if (value && REPORT_SORT_OPTIONS.includes(value as PatchRunReportSort)) {
    return value as PatchRunReportSort;
  }
  return 'newest';
}

export function parsePatchWorkspaceView(value: string | null, canViewReports: boolean): PatchWorkspaceView {
  const normalizedValue = (value || '').trim().toLowerCase();
  if (normalizedValue === 'systems' || normalizedValue === 'devices' || normalizedValue === 'department') {
    return 'systems';
  }
  if (!canViewReports) {
    return 'systems';
  }
  if (
    normalizedValue === 'terminal'
    || normalizedValue === 'console'
    || normalizedValue === 'reports'
    || normalizedValue === 'history'
    || normalizedValue === 'job-history'
    || normalizedValue === 'terminal-history'
    || normalizedValue === 'scripts'
    || normalizedValue === 'script-studio'
    || normalizedValue === 'automation'
  ) {
    return 'terminal';
  }
  return 'systems';
}

export function getPatchProgressValue(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}