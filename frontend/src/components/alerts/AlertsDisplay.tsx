import { Bell, Bug, Shield, ShieldAlert, ShieldCheck, TerminalSquare, Wrench } from 'lucide-react';

import type { AlertsListRecord } from './types';

export interface ClamAVAlertFacts {
  summary: string;
  detail: string;
  scannedFiles?: number;
  infectedFiles?: number;
  errorCount?: number;
  knownViruses?: number;
  paths?: string[];
  detectedFiles?: string[];
}

function formatAlertInteger(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return value.toLocaleString();
}

export const DEFAULT_SOURCE_OPTIONS = [
  { value: 'terminal', label: 'Terminal' },
  { value: 'patch', label: 'Patch' },
  { value: 'wazuh', label: 'Wazuh' },
  { value: 'openscap', label: 'OpenSCAP Hardening' },
  { value: 'clamav', label: 'ClamScan' },
  { value: 'inotify', label: 'Inotify' },
];

export function renderAlertTitle(alert: AlertsListRecord) {
  if (alert.source.toLowerCase() === 'clamav') {
    return alert.title.replace(/^ClamAV\b/i, 'ClamScan');
  }
  return alert.title;
}

export function renderAlertAsset(alert: AlertsListRecord) {
  const parts = [alert.assetTag, alert.hostname].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' / ');
  }
  if (alert.assetName) {
    return alert.assetName;
  }
  return alert.assetId || alert.deviceId || '-';
}

export function renderAlertUser(alert: AlertsListRecord) {
  return alert.userName || alert.userEmail || '-';
}

export function renderSystemName(alert: AlertsListRecord) {
  return alert.hostname || alert.assetName || alert.assetTag || alert.deviceId || '-';
}

function parseLeadingInteger(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseClamAVAlertFacts(alert: AlertsListRecord): ClamAVAlertFacts | null {
  if (alert.source.toLowerCase() !== 'clamav') {
    return null;
  }

  const raw = (alert.detail || '').replace(/\r/g, '').trim();
  if (!raw) {
    return {
      summary: renderAlertTitle(alert),
      detail: '',
    };
  }

  const compactSummary = (() => {
    const candidates = [
      raw.split('\n')[0]?.trim() || '',
      raw.split('----------')[0]?.trim() || '',
      raw.split(' Start Date:')[0]?.trim() || '',
    ].filter(Boolean);
    return candidates[0] || renderAlertTitle(alert);
  })();
  const sections = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const summaryLine = compactSummary;
  const knownVirusesMatch = raw.match(/Known viruses:\s*([\d,]+)/i);
  const scannedFilesMatch = raw.match(/Scanned(?:\s+files)?[:\s]+([\d,]+)/i);
  const infectedFilesMatch = raw.match(/Infected(?:\s+files)?[:\s]+([\d,]+)/i);
  const errorCountMatch = raw.match(/Errors?[:\s]+([\d,]+)/i);
  const pathsMatch = raw.match(/Paths?:\s*([^\n]+)/i);
  const detectedFilesBlock = raw.match(/Detected files:\s*([\s\S]+)/i);

  const detailLines = sections.filter((line, index) => {
    if (index === 0) {
      return false;
    }
    if (/^(Scanned(?:\s+files)?|Infected(?:\s+files)?|Errors?|Paths?:|Detected files:|Known viruses:)/i.test(line)) {
      return false;
    }
    if (/^[-]{4,}/.test(line)) {
      return false;
    }
    if (/^(Engine version|Data scanned|Data read|Time|Start Date|End Date):/i.test(line)) {
      return false;
    }
    return true;
  });

  const detectedFiles = detectedFilesBlock
    ? detectedFilesBlock[1]
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    : [];

  return {
    summary: summaryLine,
    detail: detailLines.join(' '),
    scannedFiles: scannedFilesMatch ? parseLeadingInteger(scannedFilesMatch[1]) : undefined,
    infectedFiles: infectedFilesMatch ? parseLeadingInteger(infectedFilesMatch[1]) : undefined,
    errorCount: errorCountMatch ? parseLeadingInteger(errorCountMatch[1]) : undefined,
    knownViruses: knownVirusesMatch ? parseLeadingInteger(knownVirusesMatch[1]) : undefined,
    paths: pathsMatch ? pathsMatch[1].split(',').map((item) => item.trim()).filter(Boolean) : [],
    detectedFiles,
  };
}

export function renderClamAVMetricSummary(alert: AlertsListRecord) {
  const facts = parseClamAVAlertFacts(alert);
  if (!facts) {
    return '';
  }

  const parts = [
    facts.scannedFiles !== undefined ? `${formatAlertInteger(facts.scannedFiles)} scanned` : '',
    facts.infectedFiles !== undefined ? `${formatAlertInteger(facts.infectedFiles)} infected` : '',
    facts.errorCount !== undefined ? `${formatAlertInteger(facts.errorCount)} errors` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

export function renderAlertDetailPreview(alert: AlertsListRecord, maxLength = 220) {
  const clamavFacts = parseClamAVAlertFacts(alert);
  if (clamavFacts) {
    const detail = clamavFacts.detail || (clamavFacts.summary.length <= maxLength ? clamavFacts.summary : '') || renderAlertTitle(alert);
    if (detail.length <= maxLength) {
      return detail;
    }
    return detail.slice(0, maxLength).trimEnd() + '...';
  }

  const rawDetail = (alert.detail || '').replace(/\s+/g, ' ').trim();
  if (!rawDetail) {
    return 'No detail provided.';
  }

  let compactDetail = rawDetail;
  if (compactDetail.includes('----------')) {
    compactDetail = compactDetail.split('----------')[0]?.trim() || compactDetail;
  }
  if (compactDetail.includes(' Start Date:')) {
    compactDetail = compactDetail.split(' Start Date:')[0]?.trim() || compactDetail;
  }
  if (compactDetail.includes(' Paths:')) {
    compactDetail = compactDetail.split(' Paths:')[0]?.trim() || compactDetail;
  }

  if (compactDetail.length <= maxLength) {
    return compactDetail;
  }

  return compactDetail.slice(0, maxLength).trimEnd() + '...';
}

export function renderSeverityClassName(alert: AlertsListRecord) {
  const severity = alert.severity.toLowerCase();
  if (severity === 'critical' || severity === 'high') {
    return 'bg-red-100 text-red-700';
  }
  if (severity === 'medium' || severity === 'warning') {
    return 'bg-amber-100 text-amber-700';
  }
  if (severity === 'info' || severity === 'low') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-zinc-100 text-zinc-700';
}

export function renderSeverityDotClassName(alert: AlertsListRecord) {
  const severity = alert.severity.toLowerCase();
  if (severity === 'critical' || severity === 'high') {
    return 'bg-red-500';
  }
  if (severity === 'medium' || severity === 'warning') {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

export function renderAlertStatusLabel(alert: AlertsListRecord) {
  if (alert.resolved) {
    return 'Resolved';
  }
  if (alert.acknowledged) {
    return 'Acknowledged';
  }
  return 'Open';
}

export function renderAlertStatusClassName(alert: AlertsListRecord) {
  if (alert.resolved) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (alert.acknowledged) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-rose-100 text-rose-700';
}

export function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
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
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

export function formatAbsoluteTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Unknown timestamp';
  }
  return new Date(timestamp).toLocaleString();
}

export function renderSourceLabel(value: string) {
  return DEFAULT_SOURCE_OPTIONS.find((option) => option.value === value)?.label || value;
}

export function renderSourceBadgeClassName(value: string) {
  const source = value.toLowerCase();
  if (source === 'wazuh') {
    return 'bg-sky-100 text-sky-700 border-sky-200';
  }
  if (source === 'openscap') {
    return 'bg-violet-100 text-violet-700 border-violet-200';
  }
  if (source === 'clamav') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  if (source === 'patch') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }
  if (source === 'inotify') {
    return 'bg-orange-100 text-orange-700 border-orange-200';
  }
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function renderSourceIcon(value: string, className = 'h-3.5 w-3.5') {
  const source = value.toLowerCase();
  if (source === 'terminal') {
    return <TerminalSquare className={className} />;
  }
  if (source === 'patch') {
    return <Wrench className={className} />;
  }
  if (source === 'wazuh') {
    return <Shield className={className} />;
  }
  if (source === 'openscap') {
    return <ShieldCheck className={className} />;
  }
  if (source === 'clamav') {
    return <Bug className={className} />;
  }
  if (source === 'inotify') {
    return <Bell className={className} />;
  }
  return <ShieldAlert className={className} />;
}