export interface AssignedDevice {
  id: string;
  assetTag: string;
  hostname: string;
  rustdeskId?: string | null;
  cost?: string | null;
  serialNumber: string;
  specs: string;
  status: string;
  lastSeenAt?: string | null;
  warrantyExpiresAt: string;
  assignedAt?: string;
  warrantyBadge?: string;
}

export interface AssignedItem {
  id: string;
  itemCode: string;
  name: string;
  serialNumber: string;
  specs: string;
  status: string;
  warrantyExpiresAt: string;
  cost?: string | null;
  assignedAt?: string;
  warrantyBadge?: string;
}

export function getWarrantyBadge(value: string) {
  if (!value) {
    return 'active';
  }

  const diffDays = Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return '7_days';
  }
  if (diffDays <= 15) {
    return '15_days';
  }
  if (diffDays <= 30) {
    return '30_days';
  }
  return 'active';
}

export function warrantyTone(value: string) {
  if (value === '7_days' || value === '15_days') {
    return 'bg-red-100 text-red-700';
  }

  if (value === '30_days') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-emerald-100 text-emerald-700';
}

export function formatWarrantyWindow(value: string) {
  if (!value) {
    return 'Warranty date not set';
  }

  const diffDays = Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
  }
  if (diffDays === 0) {
    return 'Expires today';
  }
  return `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
}

export function formatAssignmentAge(value?: string) {
  if (!value) {
    return 'Assignment date not available';
  }

  const diffDays = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));
  return `In use for ${diffDays} day${diffDays === 1 ? '' : 's'}`;
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

export function assetPresenceState(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return {
      label: 'Retained',
      detail: 'This assigned device remains visible until IT removes it from your profile.',
      classes: 'bg-zinc-100 text-zinc-700',
    };
  }

  const seenAt = new Date(lastSeenAt);
  if (Number.isNaN(seenAt.getTime())) {
    return {
      label: 'Retained',
      detail: 'This assigned device remains visible until IT removes it from your profile.',
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
    detail: `Last inventory heartbeat ${seenAt.toLocaleString()}. The device still stays listed here until IT removes it.`,
    classes: 'bg-amber-100 text-amber-800',
  };
}