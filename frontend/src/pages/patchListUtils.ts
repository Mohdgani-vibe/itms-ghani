import { patchDeviceActionsReadOnly } from '../components/patch/patchDeviceActions';
import type { PatchRunReport } from '../lib/patchReports';

export { patchDeviceActionsReadOnly } from '../components/patch/patchDeviceActions';

export const PATCH_PAGE_SIZE = 20;

export interface PatchDevice {
  id: string;
  hostname: string;
  osName?: string | null;
  status?: string | null;
  patchStatus: string;
  department?: { name?: string } | null;
  user?: { fullName?: string } | null;
  patchGroup?: { name?: string } | null;
}

export interface LookupOption {
  id: string;
  name: string;
}

export function buildPatchDevicesUrl(currentPage: number, searchQuery: string, selectedDepartment: string) {
  const params = new URLSearchParams({ paginate: '1', page: String(currentPage), page_size: String(PATCH_PAGE_SIZE) });
  if (searchQuery.trim()) {
    params.set('search', searchQuery.trim());
  }
  if (selectedDepartment !== 'all') {
    params.set('department', selectedDepartment);
  }
  return `/api/patch/devices?${params.toString()}`;
}

export function formatPatchDevicesTotalLabel(
  loading: boolean,
  searchQuery: string,
  selectedDepartment: string,
  totalDevices: number,
) {
  if (loading) {
    return 'Loading devices';
  }
  if (searchQuery.trim()) {
    return `${totalDevices} devices match this search`;
  }
  if (selectedDepartment !== 'all') {
    return `${totalDevices} managed devices in ${selectedDepartment}`;
  }
  return `${totalDevices} managed devices`;
}

export function formatPatchDepartmentSystemsLabel(selectedDepartment: string) {
  return selectedDepartment === 'all' ? 'Current Systems' : `${selectedDepartment} Systems`;
}

export function formatPatchDepartmentConsoleTitle(selectedDepartment: string) {
  return selectedDepartment === 'all'
    ? 'Choose a system from all departments'
    : `Choose a system from ${selectedDepartment}`;
}

export function selectActionablePatchDevices(devices: PatchDevice[]) {
  return devices.filter((device) => !patchDeviceActionsReadOnly(device.status));
}

export function countActionablePatchDevices(devices: PatchDevice[]) {
  return selectActionablePatchDevices(devices).length;
}

export function formatPatchScopeLabel(selectedDepartment: string) {
  return selectedDepartment === 'all' ? 'All departments' : `${selectedDepartment} department`;
}

export function buildPatchBatchDevicesUrl(selectedDepartment: string) {
  const params = new URLSearchParams();
  if (selectedDepartment !== 'all') {
    params.set('department', selectedDepartment);
  }
  return `/api/patch/devices${params.toString() ? `?${params.toString()}` : ''}`;
}

export function normalizePatchDepartmentOptions(departments?: LookupOption[]) {
  return ['all', ...Array.from(new Set((departments || []).map((department) => department.name).filter(Boolean))).sort()];
}

export function summarizePatchRunRows(rows: PatchRunReport['rows']) {
  return {
    successCount: rows.filter((entry) => entry.status === 'success').length,
    failedCount: rows.filter((entry) => entry.status === 'failed').length,
  };
}

export function formatPatchRunSuccessMessage(report: Pick<PatchRunReport, 'successCount' | 'failedCount'>, scopeLabel: string) {
  return report.failedCount > 0
    ? `Requested ${report.successCount} Salt patch run(s). ${report.failedCount} device(s) failed.`
    : `Requested ${report.successCount} Salt patch run(s) for ${scopeLabel.toLowerCase()}.`;
}

export function selectVisiblePatchReports<T>(sortedRecentReports: T[], showAllReports: boolean) {
  return showAllReports ? sortedRecentReports : sortedRecentReports.slice(0, 5);
}

export function selectDepartmentSystems(devices: PatchDevice[]) {
  return devices.slice(0, 8);
}

export function derivePatchPermissions(role?: string | null) {
  const normalizedRole = (role || '').trim().toLowerCase();
  const canOperate = normalizedRole === 'super_admin' || normalizedRole === 'it_team';
  return {
    canOperate,
    canViewReports: canOperate,
  };
}