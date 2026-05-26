export interface PatchRunExecutionResponse {
  status?: string;
  target?: string;
  action?: string;
  state?: string;
  command?: string;
  result?: unknown;
}

export interface PatchPackageChange {
  name: string;
  fromVersion: string | null;
  toVersion: string | null;
}

export interface PatchRunReportEntry {
  deviceId: string;
  hostname: string;
  department: string;
  status: 'success' | 'failed' | 'running';
  patchStatus: string;
  target: string;
  action: string;
  message: string;
  updatedItems: string[];
  packageChanges: PatchPackageChange[];
}

export interface PatchRunReport {
  id?: string;
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount: number;
  failedCount: number;
  totalCount?: number;
  inProgress?: boolean;
  rows: PatchRunReportEntry[];
}

interface PatchRunReportRowLike {
  deviceId?: unknown;
  hostname?: unknown;
  department?: unknown;
  status?: unknown;
  patchStatus?: unknown;
  target?: unknown;
  action?: unknown;
  message?: unknown;
  updatedItems?: unknown;
  packageChanges?: unknown;
}

interface PatchRunReportLike {
  id?: unknown;
  scopeLabel?: unknown;
  requestedAt?: unknown;
  completedAt?: unknown;
  successCount?: unknown;
  failedCount?: unknown;
  totalCount?: unknown;
  inProgress?: unknown;
  rows?: PatchRunReportRowLike[];
}

export interface PatchRunReportSummary {
  id: string;
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount: number;
  failedCount: number;
  rowCount: number;
  departments: string[];
  requestedBy?: string | null;
}

export type PatchRunReportDateRange = 'all' | '7d' | '30d' | '90d';
export type PatchRunReportSort = 'newest' | 'oldest' | 'most-failures' | 'most-successes';

export function listPatchReportDepartments(reports: PatchRunReportSummary[]) {
  return ['all', ...Array.from(new Set(reports.flatMap((report) => report.departments || []).filter(Boolean))).sort()];
}

export function filterPatchRunReports(reports: PatchRunReportSummary[], department: string, dateRange: PatchRunReportDateRange, searchQuery = '') {
  const now = Date.now();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const maxAgeMs = dateRange === '7d'
    ? 7 * 24 * 60 * 60 * 1000
    : dateRange === '30d'
    ? 30 * 24 * 60 * 60 * 1000
    : dateRange === '90d'
    ? 90 * 24 * 60 * 60 * 1000
    : 0;

  return reports.filter((report) => {
    const departmentMatch = department === 'all' || (report.departments || []).includes(department);
    if (!departmentMatch) {
      return false;
    }
    if (normalizedQuery) {
      const haystack = [
        report.scopeLabel,
        report.requestedBy || '',
        ...(report.departments || []),
      ].join(' ').toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    if (maxAgeMs === 0) {
      return true;
    }
    const completedAt = Date.parse(report.completedAt);
    if (Number.isNaN(completedAt)) {
      return false;
    }
    return now - completedAt <= maxAgeMs;
  });
}

export function sortPatchRunReports(reports: PatchRunReportSummary[], sortBy: PatchRunReportSort) {
  const copy = [...reports];
  copy.sort((left, right) => {
    if (sortBy === 'oldest') {
      return Date.parse(left.completedAt) - Date.parse(right.completedAt);
    }
    if (sortBy === 'most-failures') {
      if (right.failedCount !== left.failedCount) {
        return right.failedCount - left.failedCount;
      }
      return Date.parse(right.completedAt) - Date.parse(left.completedAt);
    }
    if (sortBy === 'most-successes') {
      if (right.successCount !== left.successCount) {
        return right.successCount - left.successCount;
      }
      return Date.parse(right.completedAt) - Date.parse(left.completedAt);
    }
    return Date.parse(right.completedAt) - Date.parse(left.completedAt);
  });
  return copy;
}

interface PatchRunDeviceLike {
  id: string;
  hostname: string;
  department?: { name?: string } | null;
}

function normalizePatchStatus(value: string | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) {
    return 'queued';
  }
  return normalized.replace(/_/g, ' ');
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all';
}

function normalizeVersionValue(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
}

function sortPackageChanges(changes: PatchPackageChange[]) {
  return [...changes].sort((left, right) => left.name.localeCompare(right.name));
}

function extractPackageChanges(result: unknown) {
  const changeMap = new Map<string, PatchPackageChange>();
  const updatedFallback = new Set<string>();

  const recordPackageChange = (name: string, fromVersion: string | null, toVersion: string | null) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }
    changeMap.set(`${normalizedName}::${fromVersion || ''}::${toVersion || ''}`, {
      name: normalizedName,
      fromVersion,
      toVersion,
    });
  };

  const collectPackageChanges = (changes: Record<string, unknown>) => {
    Object.entries(changes).forEach(([changeKey, changeValue]) => {
      if (changeValue && typeof changeValue === 'object' && !Array.isArray(changeValue)) {
        const changeRecord = changeValue as Record<string, unknown>;
        const fromVersion = normalizeVersionValue(changeRecord.old);
        const toVersion = normalizeVersionValue(changeRecord.new);
        const hasVersionDelta = fromVersion !== null || toVersion !== null || 'old' in changeRecord || 'new' in changeRecord;

        if (hasVersionDelta) {
          recordPackageChange(changeKey, fromVersion, toVersion);
          return;
        }

        collectPackageChanges(changeRecord);
        return;
      }

      if (typeof changeValue === 'string' && changeValue.trim().length > 0) {
        updatedFallback.add(changeKey.trim());
      }
    });
  };

  const collectFromStateMap = (stateMap: Record<string, unknown>) => {
    Object.entries(stateMap).forEach(([stateKey, rawValue]) => {
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        return;
      }
      const value = rawValue as Record<string, unknown>;
      const resultFlag = value.result;
      const changes = value.changes;
      if (resultFlag !== true || !changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes as Record<string, unknown>).length === 0) {
        return;
      }

      collectPackageChanges(changes as Record<string, unknown>);
      const candidate = [value.name, value.__id__, stateKey].find((entry) => typeof entry === 'string' && entry.trim().length > 0);
      if (changeMap.size === 0 && typeof candidate === 'string') {
        updatedFallback.add(candidate.trim());
      }
    });
  };

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {
      packageChanges: [] as PatchPackageChange[],
      updatedItems: [] as string[],
    };
  }
  const resultMap = result as Record<string, unknown>;
  const returns = resultMap.return;
  if (!Array.isArray(returns)) {
    return {
      packageChanges: [] as PatchPackageChange[],
      updatedItems: [] as string[],
    };
  }
  returns.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    Object.values(item as Record<string, unknown>).forEach((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }
      collectFromStateMap(value as Record<string, unknown>);
    });
  });

  const packageChanges = sortPackageChanges(Array.from(changeMap.values()));
  const updatedItems = packageChanges.length > 0
    ? Array.from(new Set(packageChanges.map((change) => change.name))).sort()
    : Array.from(updatedFallback).filter(Boolean).sort();

  return { packageChanges, updatedItems };
}

function extractPatchRunMessage(response: PatchRunExecutionResponse | undefined, updatedItems: string[]) {
  if (updatedItems.length > 0) {
    return response?.state?.trim() || response?.command?.trim() || `Updated ${updatedItems.length} package(s)`;
  }

  if (normalizePatchStatus(response?.status) === 'completed') {
    return 'No packages required updates';
  }

  return response?.state?.trim() || response?.command?.trim() || 'Patch run requested successfully';
}

export function createPatchRunReportEntry(device: PatchRunDeviceLike, response?: PatchRunExecutionResponse, requestError?: unknown): PatchRunReportEntry {
  const department = device.department?.name?.trim() || 'Unassigned';
  if (requestError) {
    return {
      deviceId: device.id,
      hostname: device.hostname,
      department,
      status: 'failed',
      patchStatus: 'failed',
      target: '',
      action: 'system-update',
      message: requestError instanceof Error ? requestError.message : 'Patch run failed',
      updatedItems: [],
      packageChanges: [],
    };
  }

  const { updatedItems, packageChanges } = extractPackageChanges(response?.result);

  return {
    deviceId: device.id,
    hostname: device.hostname,
    department,
    status: 'success',
    patchStatus: normalizePatchStatus(response?.status),
    target: response?.target?.trim() || '',
    action: response?.action?.trim() || 'system-update',
    message: extractPatchRunMessage(response, updatedItems),
    updatedItems,
    packageChanges,
  };
}

export function createPatchRunReport(scopeLabel: string, requestedAt: string, rows: PatchRunReportEntry[]): PatchRunReport {
  const successCount = rows.filter((row) => row.status === 'success').length;
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  return {
    scopeLabel,
    requestedAt,
    completedAt: new Date().toISOString(),
    successCount,
    failedCount,
    totalCount: rows.length,
    inProgress: false,
    rows,
  };
}

export function createPatchRunProgressReport(scopeLabel: string, requestedAt: string, totalCount: number): PatchRunReport {
  return {
    scopeLabel,
    requestedAt,
    completedAt: requestedAt,
    successCount: 0,
    failedCount: 0,
    totalCount,
    inProgress: true,
    rows: [],
  };
}

export function createPatchRunRunningEntry(device: PatchRunDeviceLike, action = 'system-update'): PatchRunReportEntry {
  return {
    deviceId: device.id,
    hostname: device.hostname,
    department: device.department?.name?.trim() || 'Unassigned',
    status: 'running',
    patchStatus: 'running',
    target: device.hostname,
    action,
    message: 'Executing Salt patch state and collecting updated package details...',
    updatedItems: [],
    packageChanges: [],
  };
}

function normalizeUpdatedItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizePackageChanges(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PatchPackageChange[];
  }

  return sortPackageChanges(value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [] as PatchPackageChange[];
    }

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) {
      return [] as PatchPackageChange[];
    }

    return [{
      name,
      fromVersion: normalizeVersionValue(candidate.fromVersion),
      toVersion: normalizeVersionValue(candidate.toVersion),
    }];
  }));
}

export function normalizePatchRunReport(report: PatchRunReportLike | null | undefined): PatchRunReport | null {
  if (!report) {
    return null;
  }

  return {
    id: typeof report.id === 'string' ? report.id : undefined,
    scopeLabel: typeof report.scopeLabel === 'string' ? report.scopeLabel : '',
    requestedAt: typeof report.requestedAt === 'string' ? report.requestedAt : new Date().toISOString(),
    completedAt: typeof report.completedAt === 'string' ? report.completedAt : typeof report.requestedAt === 'string' ? report.requestedAt : new Date().toISOString(),
    successCount: typeof report.successCount === 'number' ? report.successCount : 0,
    failedCount: typeof report.failedCount === 'number' ? report.failedCount : 0,
    totalCount: typeof report.totalCount === 'number' ? report.totalCount : undefined,
    inProgress: report.inProgress === true,
    rows: Array.isArray(report.rows)
      ? report.rows.map((row, index) => ({
          deviceId: typeof row.deviceId === 'string' && row.deviceId.trim().length > 0 ? row.deviceId : `row-${index}`,
          hostname: typeof row.hostname === 'string' ? row.hostname : 'Unknown device',
          department: typeof row.department === 'string' && row.department.trim().length > 0 ? row.department : 'Unassigned',
          status: row.status === 'success' || row.status === 'failed' || row.status === 'running' ? row.status : 'failed',
          patchStatus: typeof row.patchStatus === 'string' && row.patchStatus.trim().length > 0 ? row.patchStatus : 'unknown',
          target: typeof row.target === 'string' ? row.target : '',
          action: typeof row.action === 'string' && row.action.trim().length > 0 ? row.action : 'system-update',
          message: typeof row.message === 'string' && row.message.trim().length > 0 ? row.message : 'No patch details reported',
          updatedItems: normalizeUpdatedItems(row.updatedItems),
          packageChanges: normalizePackageChanges(row.packageChanges),
        }))
      : [],
  };
}

export function patchRunReportRowsForCsv(report: PatchRunReport, mode: 'all' | 'updated' = 'all') {
  const normalizedReport = normalizePatchRunReport(report);
  if (!normalizedReport) {
    return [] as PatchRunReportEntry[];
  }

  if (mode === 'updated') {
    return normalizedReport.rows.filter((row) => row.updatedItems.length > 0);
  }

  return normalizedReport.rows;
}

export function downloadPatchRunReportCsv(report: PatchRunReport, mode: 'all' | 'updated' = 'all') {
  const normalizedReport = normalizePatchRunReport(report);
  if (!normalizedReport) {
    return;
  }
  const rows = patchRunReportRowsForCsv(normalizedReport, mode);
  const lines = [
    ['scope', 'requested_at', 'completed_at', 'hostname', 'department', 'result', 'patch_status', 'target', 'action', 'updated_items', 'package_changes', 'message'],
    ...rows.map((row) => [
      normalizedReport.scopeLabel,
      normalizedReport.requestedAt,
      normalizedReport.completedAt,
      row.hostname,
      row.department,
      row.status,
      row.patchStatus,
      row.target,
      row.action,
      row.updatedItems.join('; '),
      row.packageChanges.map((change) => `${change.name}:${change.fromVersion || '-'}=>${change.toVersion || '-'}`).join('; '),
      row.message,
    ]),
  ];
  const csv = lines.map((line) => line.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateSegment = normalizedReport.completedAt.slice(0, 10);
  anchor.href = objectUrl;
  anchor.download = `${mode === 'updated' ? 'patch-updated-report' : 'patch-run-report'}-${slugifySegment(normalizedReport.scopeLabel)}-${dateSegment}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function loadJsPdf() {
  const module = await import('jspdf');
  return module.jsPDF;
}

export async function downloadPatchRunReportPdf(report: PatchRunReport) {
  const normalizedReport = normalizePatchRunReport(report);
  if (!normalizedReport) {
    return;
  }

  const jsPDF = await loadJsPdf();
  const document = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - (margin * 2);
  const bottomLimit = pageHeight - 48;
  let cursorY = 42;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= bottomLimit) {
      return;
    }
    document.addPage();
    cursorY = 42;
  };

  const writeHeading = (title: string, subtitle?: string) => {
    ensureSpace(44);
    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.text(title, margin, cursorY);
    cursorY += 18;
    if (subtitle) {
      document.setFont('helvetica', 'normal');
      document.setFontSize(10);
      document.setTextColor(90, 90, 90);
      const lines = document.splitTextToSize(subtitle, contentWidth);
      document.text(lines, margin, cursorY);
      cursorY += lines.length * 12;
      document.setTextColor(0, 0, 0);
    }
    cursorY += 10;
  };

  const writeLines = (lines: string[]) => {
    for (const line of lines) {
      ensureSpace(18);
      document.setFont('helvetica', 'normal');
      document.setFontSize(10);
      const wrapped = document.splitTextToSize(line, contentWidth);
      document.text(wrapped, margin, cursorY);
      cursorY += wrapped.length * 12 + 4;
    }
  };

  writeHeading('Patch Run Report', `${normalizedReport.scopeLabel} · Generated ${new Date(normalizedReport.completedAt).toLocaleString()}`);
  writeHeading('Summary');
  writeLines([
    `Scope: ${normalizedReport.scopeLabel}`,
    `Requested at: ${normalizedReport.requestedAt}`,
    `Completed at: ${normalizedReport.completedAt}`,
    `Success count: ${normalizedReport.successCount}`,
    `Failed count: ${normalizedReport.failedCount}`,
    `Systems processed: ${normalizedReport.totalCount || normalizedReport.rows.length}`,
  ]);
  writeHeading('Systems');
  writeLines((normalizedReport.rows.length > 0 ? normalizedReport.rows : [{ hostname: 'No patch rows available', department: '', status: 'failed', patchStatus: '', target: '', action: '', updatedItems: [], packageChanges: [], message: '' }]).map((row) => {
    const packageSummary = row.packageChanges.length > 0
      ? row.packageChanges.map((change) => `${change.name}:${change.fromVersion || '-'}=>${change.toVersion || '-'}`).join('; ')
      : row.updatedItems.join('; ') || 'No package updates reported';
    return `${row.hostname} · ${row.department} · ${row.status.toUpperCase()} · ${row.patchStatus} · ${packageSummary} · ${row.message}`;
  }));

  document.save(`patch-run-report-${slugifySegment(normalizedReport.scopeLabel)}-${normalizedReport.completedAt.slice(0, 10)}.pdf`);
}