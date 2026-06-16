import type { DevicePatchJobRecord } from '../../components/devices/types';

export interface ApiUserRecord {
  id: string;
  full_name: string;
  email: string;
  emp_id: string;
  status: string;
  role?: string;
}

export interface AssignableUserRecord {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  status: string;
}

export interface EditableAssetRecord {
  id: string;
  asset_tag: string;
  name: string;
  hostname?: string | null;
  category: string;
  is_compute: boolean;
  serial_number?: string | null;
  model?: string | null;
  entity_id: string;
  assigned_to?: string | null;
  dept_id?: string | null;
  location_id?: string | null;
  purchase_date?: string | null;
  cost?: string | null;
  warranty_until?: string | null;
  status: string;
  condition: string;
  glpi_id?: number | null;
  salt_minion_id?: string | null;
  wazuh_agent_id?: string | null;
  notes?: string | null;
}

export interface DeviceLifecycleFormState {
  assetTag: string;
  category: string;
  model: string;
  purchaseDate: string;
  warrantyUntil: string;
  cost: string;
  notes: string;
}

interface PatchJobMatchDevice {
  hostname: string;
  assetId: string;
  toolStatus?: {
    salt?: {
      identifier?: string | null;
    };
  };
}

interface ComputeAssetLike {
  deviceType?: string | null;
  osName?: string | null;
}

interface ToolStatusEntry {
  status: 'linked' | 'detected' | 'installed' | 'missing';
  detail: string;
  identifier?: string | null;
  connected?: boolean;
}

export function isPatchJobForDevice(job: DevicePatchJobRecord, device: PatchJobMatchDevice) {
  const scope = job.scope.trim().toLowerCase();
  const candidates = [
    device.hostname,
    device.assetId,
    device.toolStatus?.salt?.identifier || '',
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return candidates.includes(scope);
}

export function isComputeAsset(device: ComputeAssetLike) {
  const kind = (device.deviceType || '').toLowerCase();
  return ['laptop', 'desktop', 'workstation', 'server'].some((value) => kind.includes(value)) || Boolean(device.osName);
}

export function parseEnrollmentDetails(description: string) {
  return description
    .split('\n')
    .map((line) => line.trim())
    .reduce<Record<string, string>>((details, line) => {
      const separator = line.indexOf(':');
      if (separator <= 0) {
        return details;
      }

      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (value) {
        details[key] = value;
      }
      return details;
    }, {});
}

export function formatStatusLabel(status: string) {
  const normalizedStatus = status.trim();
  if (!normalizedStatus) {
    return 'Unknown';
  }
  return normalizedStatus.replaceAll('_', ' ');
}

export function formatLifecycleCurrency(value?: string | null) {
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

export function normalizeAssignableUsers(data: ApiUserRecord[]): AssignableUserRecord[] {
  return data
    .filter((user) => user.role !== 'super_admin')
    .map((user) => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      employeeCode: user.emp_id,
      status: user.status,
    }));
}

export function dedupeAssignableUsers(data: AssignableUserRecord[]) {
  const seen = new Map<string, AssignableUserRecord>();
  data.forEach((user) => {
    if (!seen.has(user.id)) {
      seen.set(user.id, user);
    }
  });
  return Array.from(seen.values());
}

export function alertSourceLabel(source: string) {
  switch ((source || '').toLowerCase()) {
    case 'openscap':
      return 'OpenSCAP Hardening';
    case 'clamav':
      return 'ClamScan';
    case 'wazuh':
      return 'Wazuh';
    case 'patch':
      return 'Patch';
    case 'terminal':
      return 'Terminal';
    default:
      return source || 'Unknown source';
  }
}

export function softwareSourceLabel(source?: string | null) {
  switch ((source || '').trim().toLowerCase()) {
    case 'apt':
      return 'APT';
    case 'dpkg':
      return 'dpkg';
    case 'snap':
      return 'Snap';
    case 'snapd':
      return 'snapd';
    case 'flatpak':
      return 'Flatpak';
    case 'appimage':
      return 'AppImage';
    case 'pip':
      return 'pip';
    case 'npm':
      return 'npm';
    case 'cargo':
      return 'cargo';
    case 'registry':
      return 'Registry';
    default:
      return source || 'Unknown source';
  }
}

export function toolStatusTone(status?: ToolStatusEntry['status']) {
  switch (status) {
    case 'linked':
    case 'installed':
    case 'detected':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

export function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function buildLifecycleFormState(asset: EditableAssetRecord): DeviceLifecycleFormState {
  return {
    assetTag: asset.asset_tag || '',
    category: asset.category || '',
    model: asset.model || '',
    purchaseDate: toDateInputValue(asset.purchase_date),
    warrantyUntil: toDateInputValue(asset.warranty_until),
    cost: asset.cost || '',
    notes: asset.notes || '',
  };
}