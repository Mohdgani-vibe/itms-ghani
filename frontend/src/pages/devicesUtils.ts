import { apiRequest } from '../lib/api';

export const DEVICES_PAGE_SIZE = 50;

export type DeviceAssignmentFilter = 'all' | 'assigned' | 'unassigned';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  sourceType: string;
  interval: string;
  running: boolean;
  nextRunAt?: string;
  lastRun?: {
    status: string;
    startedAt: string;
    finishedAt?: string;
    recordsSeen: number;
    recordsUpserted: number;
    error?: string;
  };
}

export interface DeviceRecord {
  id: string;
  assetId: string;
  hostname: string;
  deviceType?: string;
  osName?: string;
  gpu?: string | null;
  macAddress?: string | null;
  lastSeenAt?: string | null;
  cost?: string | null;
  warrantyUntil?: string | null;
  patchStatus: string;
  alertStatus: string;
  status: string;
  user?: { fullName?: string; employeeCode?: string } | null;
  branch?: { name?: string } | null;
  department?: { name?: string } | null;
}

export async function loadUnassignedDeviceCount() {
  const params = new URLSearchParams({
    paginate: '1',
    page: '1',
    page_size: '1',
    assigned: 'unassigned',
  });
  const deviceData = await apiRequest<PaginatedResponse<DeviceRecord>>(`/api/devices?${params.toString()}`);
  return deviceData.total;
}

export async function loadInventoryData(page: number, searchQuery: string, assignmentFilter: DeviceAssignmentFilter, includeSyncStatus: boolean) {
  const params = new URLSearchParams({
    paginate: '1',
    page: String(page),
    page_size: String(DEVICES_PAGE_SIZE),
  });
  if (searchQuery.trim()) {
    params.set('search', searchQuery.trim());
  }
  if (assignmentFilter !== 'all') {
    params.set('assigned', assignmentFilter);
  }
  const deviceData = await apiRequest<PaginatedResponse<DeviceRecord>>(`/api/devices?${params.toString()}`);
  let statusData: SyncStatus | null = null;
  if (includeSyncStatus) {
    try {
      statusData = await apiRequest<SyncStatus>('/api/inventory-sync/status');
    } catch {
      statusData = null;
    }
  }
  return { deviceData, statusData };
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function formatCurrency(value?: string | null) {
  if (!value) {
    return 'Cost not tracked';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(parsed);
}