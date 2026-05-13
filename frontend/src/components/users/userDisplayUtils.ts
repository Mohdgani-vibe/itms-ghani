export const TOOL_STATUS_ITEMS = [
  ['salt', 'Salt'],
  ['wazuh', 'Wazuh'],
  ['openscap', 'OpenSCAP'],
  ['clamav', 'ClamScan'],
] as const;

export type AuditModule = 'all' | 'access' | 'assets' | 'gatepass' | 'chat' | 'terminal' | 'requests' | 'announcements' | 'alerts' | 'settings';

export const ACCESS_AUDIT_ACTION_PRESETS = ['user_updated', 'user_deactivated', 'user_added', 'profile_updated', 'user_import', 'user_imported'] as const;

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

export function getToolBadgeClasses(status?: 'linked' | 'detected' | 'installed' | 'missing') {
  switch (status) {
    case 'linked':
      return 'bg-emerald-100 text-emerald-700';
    case 'installed':
      return 'bg-brand-100 text-brand-700';
    case 'detected':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-zinc-100 text-zinc-600';
  }
}

export function formatToolStatusLabel(status?: 'linked' | 'detected' | 'installed' | 'missing') {
  switch (status) {
    case 'linked':
      return 'Linked';
    case 'installed':
      return 'Installed';
    case 'detected':
      return 'Detected';
    default:
      return 'Missing';
  }
}

export function getAuditModule(entry: { entityType: string }): AuditModule {
  if (entry.entityType === 'user') {
    return 'access';
  }
  if (entry.entityType === 'device' || entry.entityType === 'inventory_item' || entry.entityType === 'patch_job' || entry.entityType === 'asset') {
    return 'assets';
  }
  if (entry.entityType === 'gatepass') {
    return 'gatepass';
  }
  if (entry.entityType === 'chat_channel') {
    return 'chat';
  }
  if (entry.entityType === 'terminal_session') {
    return 'terminal';
  }
  if (entry.entityType === 'request') {
    return 'requests';
  }
  if (entry.entityType === 'announcement') {
    return 'announcements';
  }
  if (entry.entityType === 'alert') {
    return 'alerts';
  }
  if (entry.entityType === 'setting') {
    return 'settings';
  }
  return 'all';
}

export function formatAuditModuleLabel(module: AuditModule) {
  switch (module) {
    case 'access':
      return 'Access';
    case 'assets':
      return 'Assets';
    case 'gatepass':
      return 'Gatepass';
    case 'chat':
      return 'Chat';
    case 'terminal':
      return 'Terminal';
    case 'requests':
      return 'Requests';
    case 'announcements':
      return 'Announcements';
    case 'alerts':
      return 'Alerts';
    case 'settings':
      return 'Settings';
    default:
      return 'All';
  }
}

export function formatAuditActionLabel(action: string) {
  switch (action) {
    case 'user_updated':
      return 'User Updates';
    case 'user_deactivated':
      return 'Deactivated';
    case 'user_added':
      return 'Created';
    case 'profile_updated':
      return 'Profile Updates';
    case 'user_import':
      return 'CSV Imports';
    case 'user_imported':
      return 'Imported Users';
    default:
      return action.replaceAll('_', ' ');
  }
}

export function resolveAuditEntityPath(basePath: string, entry: { entityType: string; entityId: string }) {
  switch (entry.entityType) {
    case 'user':
      return `${basePath}/users/${entry.entityId}`;
    case 'device':
    case 'asset':
      return `${basePath}/devices/${entry.entityId}`;
    case 'request':
      return `${basePath}/requests`;
    case 'announcement':
      return `${basePath}/announcements`;
    case 'alert':
      return `${basePath}/alerts`;
    case 'chat_channel':
      return `${basePath}/chat`;
    default:
      return '';
  }
}

export function formatWarranty(value: string) {
  if (!value) {
    return 'Warranty not tracked';
  }

  return new Date(value).toLocaleDateString();
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

export function formatAssignmentAge(value?: string) {
  if (!value) {
    return 'Assignment date unavailable';
  }

  const diffDays = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));
  return `${diffDays} day${diffDays === 1 ? '' : 's'} in use`;
}

export function assetPresenceState(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return {
      label: 'Retained',
      detail: 'This asset stays linked to the user until it is explicitly unassigned or deleted.',
      classes: 'bg-zinc-100 text-zinc-700',
    };
  }

  const seenAt = new Date(lastSeenAt);
  if (Number.isNaN(seenAt.getTime())) {
    return {
      label: 'Retained',
      detail: 'This asset stays linked to the user until it is explicitly unassigned or deleted.',
      classes: 'bg-zinc-100 text-zinc-700',
    };
  }

  const ageHours = (Date.now() - seenAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 24) {
    return {
      label: 'Recently Seen',
      detail: `Last inventory heartbeat ${seenAt.toLocaleString()}.`,
      classes: 'bg-emerald-100 text-emerald-700',
    };
  }

  return {
    label: 'Offline',
    detail: `Last inventory heartbeat ${seenAt.toLocaleString()}. The record remains attached until you remove it.`,
    classes: 'bg-amber-100 text-amber-800',
  };
}