import type { AlertsListRecord } from '../components/alerts/types';

export type SourceKey = 'wazuh' | 'openscap' | 'clamav';
export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

export function emptyDashboardMap<T>(value: T) {
  return {
    wazuh: value,
    openscap: value,
    clamav: value,
  } as Record<SourceKey, T>;
}

export function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function parseTimestamp(value?: string | null) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatDateTime(value?: string | null) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return 'Unknown time';
  }
  return new Date(timestamp).toLocaleString();
}

export function formatRelativeTime(value?: string | null) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return 'Unknown time';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function normalizeSeverity(value?: string | null): SeverityFilter {
  const severity = (value || '').trim().toLowerCase();
  if (severity === 'critical') {
    return 'critical';
  }
  if (severity === 'high') {
    return 'high';
  }
  if (severity === 'medium' || severity === 'warning') {
    return 'medium';
  }
  return 'low';
}

export function normalizeSourceKey(value?: string | null): string {
  const source = (value || '').trim().toLowerCase();
  if (source === 'open_scap' || source === 'hardening') {
    return 'openscap';
  }
  if (source === 'clam' || source === 'clamwin' || source === 'clamscan') {
    return 'clamav';
  }
  if (source === 'salt' || source === 'salt_patch' || source === 'patch') {
    return 'patch';
  }
  if (source === 'terminal_session') {
    return 'terminal';
  }
  return source;
}

export function sourceLabel(value: string, fallback?: string | null) {
  const normalized = normalizeSourceKey(value);
  if (fallback && fallback.trim()) {
    return fallback.trim();
  }
  if (normalized === 'wazuh') {
    return 'Wazuh';
  }
  if (normalized === 'openscap') {
    return 'OpenSCAP';
  }
  if (normalized === 'clamav') {
    return 'ClamAV';
  }
  if (normalized === 'patch') {
    return 'Patch';
  }
  if (normalized === 'terminal') {
    return 'Terminal';
  }
  return value || 'Unknown';
}

export function systemName(alert: AlertsListRecord) {
  return (alert.hostname || alert.assetName || alert.assetTag || alert.deviceId || 'Unknown system').trim();
}