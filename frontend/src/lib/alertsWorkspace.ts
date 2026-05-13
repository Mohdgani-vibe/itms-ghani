import type {
  AlertsDashboardDepartmentSummary,
  AlertsDashboardReport,
  AlertsDashboardSystemSummary,
  AlertsListRecord,
} from '../components/alerts/types';

export interface AlertSourceDepartmentSummary {
  key: string;
  name: string;
  alertCount: number;
  openCount: number;
  resolvedCount: number;
  systemCount: number;
  latestCreatedAt: string;
}

export interface AlertSourceSystemSummary {
  key: string;
  assetId?: string | null;
  deviceId: string;
  department: string;
  name: string;
  assetTag?: string | null;
  hostname?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  alertCount: number;
  openCount: number;
  criticalCount: number;
  latestCreatedAt: string;
}

function normalizeDepartmentName(value?: string | null) {
  const trimmed = (value || '').trim();
  return trimmed || 'Unassigned';
}

function alertTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function systemKey(alert: AlertsListRecord) {
  return (alert.assetId || alert.deviceId || alert.hostname || alert.assetTag || alert.id || '').trim();
}

function systemName(alert: AlertsListRecord) {
  return (alert.hostname || alert.assetName || alert.assetTag || alert.deviceId || 'Unknown system').trim();
}

function isCriticalSeverity(value?: string) {
  const severity = (value || '').trim().toLowerCase();
  return severity === 'critical' || severity === 'high';
}

export function summarizeAlertSourceDepartments(alerts: AlertsListRecord[]) {
  const departmentMap = new Map<string, { name: string; alertCount: number; openCount: number; resolvedCount: number; systems: Set<string>; latestCreatedAt: string }>();

  for (const alert of alerts) {
    const name = normalizeDepartmentName(alert.department);
    const entry = departmentMap.get(name) || {
      name,
      alertCount: 0,
      openCount: 0,
      resolvedCount: 0,
      systems: new Set<string>(),
      latestCreatedAt: '',
    };
    entry.alertCount += 1;
    if (alert.resolved) {
      entry.resolvedCount += 1;
    } else {
      entry.openCount += 1;
    }
    entry.systems.add(systemKey(alert));
    if (alertTimestamp(alert.createdAt) > alertTimestamp(entry.latestCreatedAt)) {
      entry.latestCreatedAt = alert.createdAt;
    }
    departmentMap.set(name, entry);
  }

  return Array.from(departmentMap.values())
    .map((entry) => ({
      key: entry.name,
      name: entry.name,
      alertCount: entry.alertCount,
      openCount: entry.openCount,
      resolvedCount: entry.resolvedCount,
      systemCount: entry.systems.size,
      latestCreatedAt: entry.latestCreatedAt,
    }))
    .sort((left, right) => {
      if (right.alertCount !== left.alertCount) {
        return right.alertCount - left.alertCount;
      }
      return left.name.localeCompare(right.name);
    });
}

export function summarizeAlertSourceSystems(alerts: AlertsListRecord[], department?: string) {
  const departmentName = department ? normalizeDepartmentName(department) : '';
  const filtered = departmentName ? alerts.filter((alert) => normalizeDepartmentName(alert.department) === departmentName) : alerts;
  const systemMap = new Map<string, AlertSourceSystemSummary>();

  for (const alert of filtered) {
    const key = systemKey(alert);
    const existing = systemMap.get(key);
    if (existing) {
      existing.alertCount += 1;
      if (!alert.resolved) {
        existing.openCount += 1;
      }
      if (isCriticalSeverity(alert.severity)) {
        existing.criticalCount += 1;
      }
      if (alertTimestamp(alert.createdAt) > alertTimestamp(existing.latestCreatedAt)) {
        existing.latestCreatedAt = alert.createdAt;
      }
      continue;
    }

    systemMap.set(key, {
      key,
      assetId: alert.assetId,
      deviceId: alert.deviceId,
      department: normalizeDepartmentName(alert.department),
      name: systemName(alert),
      assetTag: alert.assetTag,
      hostname: alert.hostname,
      userName: alert.userName,
      userEmail: alert.userEmail,
      alertCount: 1,
      openCount: alert.resolved ? 0 : 1,
      criticalCount: isCriticalSeverity(alert.severity) ? 1 : 0,
      latestCreatedAt: alert.createdAt,
    });
  }

  return Array.from(systemMap.values()).sort((left, right) => {
    if (right.alertCount !== left.alertCount) {
      return right.alertCount - left.alertCount;
    }
    return left.name.localeCompare(right.name);
  });
}

export function sourceAlertsForSystem(alerts: AlertsListRecord[], key: string) {
  return alerts
    .filter((alert) => systemKey(alert) === key)
    .sort((left, right) => alertTimestamp(right.createdAt) - alertTimestamp(left.createdAt));
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

export function alertSourceRowsForCsv(alerts: AlertsListRecord[]) {
  return alerts
    .slice()
    .sort((left, right) => alertTimestamp(right.createdAt) - alertTimestamp(left.createdAt))
    .map((alert) => ({
      department: normalizeDepartmentName(alert.department),
      system: systemName(alert),
      assetTag: alert.assetTag || '',
      hostname: alert.hostname || '',
      assetId: alert.assetId || '',
      deviceId: alert.deviceId || '',
      user: alert.userName || '',
      userEmail: alert.userEmail || '',
      severity: alert.severity,
      status: alert.resolved ? 'Resolved' : alert.acknowledged ? 'Acknowledged' : 'Open',
      title: alert.title,
      detail: alert.detail,
      createdAt: alert.createdAt,
      source: alert.sourceLabel || alert.source,
    }));
}

export function downloadAlertSourceCsv(sourceLabel: string, alerts: AlertsListRecord[], scopeLabel = 'all-departments') {
  const rows = alertSourceRowsForCsv(alerts);
  const lines = [
    ['Department', 'System', 'Asset Tag', 'Hostname', 'Asset ID', 'Device ID', 'User', 'User Email', 'Severity', 'Status', 'Title', 'Detail', 'Created At', 'Source'],
    ...rows.map((row) => [
      row.department,
      row.system,
      row.assetTag,
      row.hostname,
      row.assetId,
      row.deviceId,
      row.user,
      row.userEmail,
      row.severity,
      row.status,
      row.title,
      row.detail,
      row.createdAt,
      row.source,
    ]),
  ];
  const csv = lines.map((line) => line.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugifySegment(sourceLabel)}-${slugifySegment(scopeLabel)}-alerts.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, lines: string[][]) {
  const csv = lines.map((line) => line.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export function downloadAlertsDashboardSystemsCsv(sourceLabel: string, systems: AlertsDashboardSystemSummary[], scopeLabel = 'all-systems') {
  const lines = [
    ['Asset ID', 'Asset Tag', 'Hostname', 'Username', 'User Email', 'Department', 'Module', 'Status', 'Error Count', 'Error Details', 'Last Scan At'],
    ...systems.map((system) => [
      system.assetId,
      system.assetTag,
      system.hostname,
      system.username,
      system.userEmail,
      system.department,
      system.moduleLabel,
      system.status,
      String(system.errorCount),
      system.errorDetails.join(' | '),
      system.lastScanAt,
    ]),
  ];
  downloadCsv(`${slugifySegment(sourceLabel)}-${slugifySegment(scopeLabel)}-dashboard.csv`, lines);
}

function summarizeReportDepartments(departments: AlertsDashboardDepartmentSummary[]) {
  return departments.map((department) => `${department.name}: ${department.totalSystems} systems, ${department.cleanCount} clean, ${department.errorCount} error`).join(' | ');
}

async function loadJsPdf() {
  const module = await import('jspdf');
  return module.jsPDF;
}

export async function downloadAlertsDashboardPdf(sourceLabel: string, report: AlertsDashboardReport) {
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
      ensureSpace(16);
      document.setFont('helvetica', 'normal');
      document.setFontSize(10);
      const wrapped = document.splitTextToSize(line, contentWidth);
      document.text(wrapped, margin, cursorY);
      cursorY += wrapped.length * 12 + 4;
    }
  };

  writeHeading(`${sourceLabel} Alerts Report`, `Generated ${new Date(report.generatedAt).toLocaleString()}${report.selectedDepartment ? ` · Department ${report.selectedDepartment}` : ''}`);
  writeHeading('Department Summary');
  writeLines(report.departmentSummary.map((department) => `${department.name}: ${department.totalSystems} total, ${department.cleanCount} clean, ${department.errorCount} error, updated ${department.lastUpdated}`));
  writeHeading('System Status Summary');
  writeLines(report.systemStatuses.slice(0, 24).map((system) => `${system.hostname} (${system.assetId || system.assetTag}) · ${system.username} · ${system.department} · ${system.status.toUpperCase()} · ${system.errorCount} issue(s) · ${system.lastScanAt}`));
  writeHeading('Error Details');
  writeLines((report.errorDetails.length > 0 ? report.errorDetails : [{ hostname: 'No active errors', department: '', title: '', detail: '', createdAt: '' }]).slice(0, 30).map((detail) => `${detail.hostname}${detail.department ? ` · ${detail.department}` : ''}${detail.title ? ` · ${detail.title}` : ''}${detail.detail ? ` · ${detail.detail}` : ''}${detail.createdAt ? ` · ${detail.createdAt}` : ''}`));
  writeHeading('Last 7 Days Trend');
  writeLines([
    `Current 7 days: ${report.last7DaysTrend.last7DaysTotal}`,
    `Previous 7 days: ${report.last7DaysTrend.previous7Days}`,
    `Trend: ${report.last7DaysTrend.trendDirection} (${report.last7DaysTrend.trendDelta >= 0 ? '+' : ''}${report.last7DaysTrend.trendDelta}, ${report.last7DaysTrend.trendPercent.toFixed(1)}%)`,
    `Daily buckets: ${report.last7DaysTrend.dailyBuckets.map((bucket) => `${bucket.date}=${bucket.count}`).join(', ')}`,
    `Department rollup: ${summarizeReportDepartments(report.departmentSummary) || 'No department data available.'}`,
  ]);

  document.save(`${slugifySegment(sourceLabel)}-alerts-report.pdf`);
}