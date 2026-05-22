export function formatDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
}

export function formatDetailValue(value?: string | null, fallback = 'Not reported') {
  if (!value) {
    return fallback;
  }

  return value;
}

export function severityBadgeClassName(severity: string) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'medium':
    case 'warning':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
}

export function alertStatusLabel(alert: Pick<{ acknowledged: boolean; resolved: boolean }, 'acknowledged' | 'resolved'>) {
  if (alert.resolved) {
    return 'Resolved';
  }
  if (alert.acknowledged) {
    return 'Acknowledged';
  }
  return 'Open';
}

export function alertStatusBadgeClassName(alert: Pick<{ acknowledged: boolean; resolved: boolean }, 'acknowledged' | 'resolved'>) {
  if (alert.resolved) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (alert.acknowledged) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-rose-100 text-rose-700';
}