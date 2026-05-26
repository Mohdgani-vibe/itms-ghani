import { isProbeLikeUser } from '../../lib/userVisibility';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  status: string;
  entityId?: string | null;
  departmentId?: string | null;
  branchId?: string | null;
  portals?: string[];
  role?: { name: string } | null;
  department?: { name: string } | null;
  branch?: { name: string } | null;
  _count?: { devices: number; items: number; assets: number };
}

export interface ApiUserRecord {
  id: string;
  full_name: string;
  email: string;
  emp_id: string;
  status: string;
  entity_id?: string | null;
  dept_id?: string | null;
  location_id?: string | null;
  role: string;
  department?: string | null;
  location?: string | null;
  device_count?: number;
  item_count?: number;
  asset_count: number;
}

export interface LookupOption {
  id: string;
  name: string;
}

const PRESET_DEPARTMENTS = [
  'Accounts',
  'BOCO',
  'HR',
  'IT Team',
  'Mutual Funds',
  'Quality',
  'Sales-ACOP',
  'Customer Support',
  'Account Opening',
  'Process',
  'Business Analysis (ZTeam)',
  'Varsity',
  'Tech Support',
  'Institutional Broking Support',
];

export const PORTAL_CHOICES = [
  { id: 'employee', label: 'Employee' },
  { id: 'auditor', label: 'Auditor' },
  { id: 'it_team', label: 'IT Team' },
  { id: 'super_admin', label: 'Super Admin' },
] as const;

const PORTAL_LABELS = Object.fromEntries(PORTAL_CHOICES.map((portal) => [portal.id, portal.label])) as Record<string, string>;

function portalsForRole(role: string) {
  if (role === 'super_admin') {
    return ['super_admin', 'it_team', 'employee'];
  }
  if (role === 'it_team') {
    return ['it_team', 'employee'];
  }
  if (role === 'auditor') {
    return ['auditor'];
  }
  return ['employee'];
}

export function normalizePortalSelection(portals: string[]) {
  const validPortalIds = new Set<string>(PORTAL_CHOICES.map((portal) => portal.id));
  const selected = new Set(
    portals
      .map((portal) => portal.trim())
      .filter((portal) => validPortalIds.has(portal)),
  );

  if (selected.has('super_admin')) {
    selected.delete('auditor');
    selected.add('it_team');
    selected.add('employee');
  }
  if (selected.has('it_team')) {
    selected.delete('auditor');
    selected.add('employee');
  }
  if (selected.has('auditor')) {
    selected.delete('employee');
    selected.delete('it_team');
    selected.delete('super_admin');
  }
  if (!selected.size) {
    selected.add('employee');
  }

  return PORTAL_CHOICES.map((portal) => portal.id).filter((portal) => selected.has(portal));
}

export function formatPortalLabel(portalId: string) {
  return PORTAL_LABELS[portalId] || portalId.replaceAll('_', ' ');
}

export function portalsToRole(portals: string[]) {
  const normalized = normalizePortalSelection(portals);
  if (normalized.includes('super_admin')) {
    return 'super_admin';
  }
  if (normalized.includes('it_team')) {
    return 'it_team';
  }
  if (normalized.includes('auditor')) {
    return 'auditor';
  }
  return 'employee';
}

export function mergeDepartmentSuggestions(options: LookupOption[]) {
  const seen = new Set<string>();
  const merged: LookupOption[] = [];

  [...PRESET_DEPARTMENTS, ...options.map((option) => option.name)]
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name, index) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const existing = options.find((option) => option.name.trim().toLowerCase() === key);
      merged.push(existing || { id: `manual-${index}`, name });
    });

  return merged;
}

export function normalizeUsers(data: ApiUserRecord[]): UserRecord[] {
  return data
    .filter((user) => !isProbeLikeUser({ fullName: user.full_name, email: user.email, employeeCode: user.emp_id }))
    .map((user) => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      employeeCode: user.emp_id,
      status: user.status,
      entityId: user.entity_id || null,
      departmentId: user.dept_id || null,
      branchId: user.location_id || null,
      portals: portalsForRole(user.role),
      role: { name: user.role },
      department: user.department ? { name: user.department } : null,
      branch: user.location ? { name: user.location } : null,
      _count: {
        devices: user.device_count ?? user.asset_count,
        items: user.item_count ?? 0,
        assets: user.asset_count,
      },
    }));
}

export function formatRoleNameLabel(roleName: string) {
  if (!roleName) {
    return 'Employee';
  }

  return roleName.replaceAll('_', ' ');
}

export function normalizeSelectFilterValue(value: string) {
  return value || 'all';
}