import type { PatchRunReport } from '../../lib/patchReports';

export type PatchSecurityKey = 'wazuh' | 'openscap' | 'clamav';
export type PatchSecurityState = 'inactive' | 'error_found' | 'clean';

export interface PatchSecuritySourceStatus {
  status: PatchSecurityState;
  active: boolean;
  openAlerts: number;
}

interface PatchSecurityDeviceLike {
  securityStatus?: Partial<Record<PatchSecurityKey, unknown>> | null;
}

export interface PatchSecuritySummaryItem {
  key: PatchSecurityKey;
  label: string;
  activeCount: number;
  errorCount: number;
  cleanCount: number;
}

const PATCH_SECURITY_LABELS: Record<PatchSecurityKey, string> = {
  wazuh: 'Wazuh',
  openscap: 'OpenSCAP',
  clamav: 'ClamScan',
};

export function normalizePatchSecuritySourceStatus(value: unknown): PatchSecuritySourceStatus {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const openAlerts = typeof candidate.openAlerts === 'number' && candidate.openAlerts > 0
    ? Math.floor(candidate.openAlerts)
    : 0;
  const active = candidate.active === true;
  const status = candidate.status === 'error_found' || candidate.status === 'clean' || candidate.status === 'inactive'
    ? candidate.status
    : openAlerts > 0
    ? 'error_found'
    : active
    ? 'clean'
    : 'inactive';

  return {
    status,
    active: active || status !== 'inactive',
    openAlerts,
  };
}

export function summarizePatchSecurityStatus(devices: PatchSecurityDeviceLike[]): PatchSecuritySummaryItem[] {
  return (Object.keys(PATCH_SECURITY_LABELS) as PatchSecurityKey[]).map((key) => {
    let activeCount = 0;
    let errorCount = 0;
    let cleanCount = 0;

    devices.forEach((device) => {
      const status = normalizePatchSecuritySourceStatus(device.securityStatus?.[key]);
      if (status.active) {
        activeCount += 1;
      }
      if (status.status === 'error_found') {
        errorCount += 1;
      }
      if (status.status === 'clean') {
        cleanCount += 1;
      }
    });

    return {
      key,
      label: PATCH_SECURITY_LABELS[key],
      activeCount,
      errorCount,
      cleanCount,
    };
  });
}

export function shouldResetOpeningReportId(
  openingReportId: string,
  patchReport: PatchRunReport | null,
  requestedReportId: string | null | undefined,
) {
  return Boolean(openingReportId && !patchReport && !(requestedReportId || '').trim());
}