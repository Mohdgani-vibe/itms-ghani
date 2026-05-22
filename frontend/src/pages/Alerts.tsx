import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bell,
  Bug,
  ChevronRight,
  ClipboardCheck,
  Radar,
  Shield,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import EmbeddedConsoleModal, { buildEmbeddedSaltConsoleState, type EmbeddedConsoleState } from '../components/EmbeddedConsoleModal';
import PatchRunReportModal from '../components/PatchRunReportModal';
import { AlertsDetailPane } from '../components/alerts/AlertsDetailPane';
import { AlertsDashboardSourceGrid } from '../components/alerts/AlertsDashboardSourceGrid';
import { AlertsFeedPane } from '../components/alerts/AlertsFeedPane';
import { AlertsHeroSection } from '../components/alerts/AlertsHeroSection';
import { AlertsMainTabs } from '../components/alerts/AlertsMainTabs';
import { AlertsQueueOverviewCard } from '../components/alerts/AlertsQueueOverviewCard';
import { AlertsRecentTable } from '../components/alerts/AlertsRecentTable';
import { AlertsStatusStrip } from '../components/alerts/AlertsStatusStrip';
import { AlertsSourceWorkspacePanel, type AlertsSourceWorkspaceView } from '../components/alerts/AlertsSourceWorkspacePanel';
import { AlertsToolbar } from '../components/alerts/AlertsToolbar';
import {
  renderAlertAsset as alertsRenderAlertAsset,
  renderAlertStatusClassName as alertsRenderAlertStatusClassName,
  renderAlertStatusLabel as alertsRenderAlertStatusLabel,
  renderAlertUser as alertsRenderAlertUser,
  renderSeverityClassName as alertsRenderSeverityClassName,
  renderSeverityDotClassName as alertsRenderSeverityDotClassName,
  renderSourceBadgeClassName as alertsRenderSourceBadgeClassName,
  renderSourceIcon as alertsRenderSourceIcon,
  renderSourceLabel as alertsRenderSourceLabel,
} from '../components/alerts/AlertsDisplay';
import type { AlertsDashboardResponse, AlertsListRecord, PaginatedAlertsResponse } from '../components/alerts/types';
import { useAlertsDerivedState } from '../hooks/useAlertsDerivedState';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import { hasSaltTarget, resolveSaltTarget, saltTargetConnected, type BootstrapDeviceLike } from '../lib/bootstrap';
import { buildSaltActionConsolePrefill, buildSaltActionRequest, isPatchReportableSaltAction, saltActionInputError, saltActionSuccessMessage, type SaltActionValue } from '../lib/salt';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, createPatchRunRunningEntry, type PatchRunExecutionResponse, type PatchRunReport } from '../lib/patchReports';

type AlertsView = 'dashboard' | 'wazuh' | 'openscap' | 'clamav' | 'threat-hunting' | 'all-alerts';
type SourceKey = 'wazuh' | 'openscap' | 'clamav';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type TimeRangeFilter = '24h' | '7d' | '30d' | 'all';

interface ChartDrilldownState {
  kind: 'timeline' | 'malware' | 'queue';
  label: string;
  detail: string;
  source?: string;
  severity?: SeverityFilter;
  timelineLabel?: string;
  dateLabel?: string;
  queueMetric?: 'Open' | 'Offline' | 'Errors';
}

interface DrilldownSystemPreview {
  key: string;
  label: string;
  sourceLabel: string;
}

interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

const LazyThreatTimelineChart = lazy(() => import('../components/alerts/AlertsThreatTimelineChart').then((module) => ({ default: module.AlertsThreatTimelineChart })));
const LazyMalwareTrendChart = lazy(() => import('../components/alerts/AlertsMalwareTrendChart').then((module) => ({ default: module.AlertsMalwareTrendChart })));
const LazyQueueHealthChart = lazy(() => import('../components/alerts/AlertsQueueHealthChart').then((module) => ({ default: module.AlertsQueueHealthChart })));

function TimelineChartFallback() {
  return <div className="h-72 w-full rounded-2xl bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]" aria-hidden="true" />;
}

function MalwareChartFallback() {
  return <div className="h-72 w-full rounded-2xl bg-[linear-gradient(180deg,_#ffffff_0%,_#fff7f8_100%)]" aria-hidden="true" />;
}

function QueueChartFallback() {
  return <div className="h-72 w-full rounded-2xl bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]" aria-hidden="true" />;
}

interface AlertDeviceRecord extends BootstrapDeviceLike {
  id: string;
  status?: string | null;
}

const PAGE_BG = '#f0f4fa';
const SOURCE_KEYS: SourceKey[] = ['wazuh', 'openscap', 'clamav'];
const SEVERITY_FILTER_OPTIONS: SeverityFilter[] = ['all', 'critical', 'high', 'medium', 'low'];

const SOURCE_CONFIG: Record<
  SourceKey,
  {
    label: string;
    title: string;
    description: string;
    icon: typeof Shield;
    accent: string;
    issueLabel: string;
    issueShortLabel: string;
  }
> = {
  wazuh: {
    label: 'Wazuh',
    title: 'Connected endpoint intelligence',
    description: 'Live detection coverage, rule activity, and integrity drift across monitored systems.',
    icon: Shield,
    accent: 'bg-sky-50 text-sky-700',
    issueLabel: 'Systems with findings',
    issueShortLabel: 'Findings',
  },
  openscap: {
    label: 'OpenSCAP',
    title: 'Hardening posture and CIS drift visibility',
    description: 'Compliance failures, remediation focus areas, and department-level hardening health.',
    icon: ClipboardCheck,
    accent: 'bg-indigo-50 text-indigo-700',
    issueLabel: 'Systems failing',
    issueShortLabel: 'Failures',
  },
  clamav: {
    label: 'ClamAV',
    title: 'Threat detections and scan visibility',
    description: 'Endpoint malware detections, impacted systems, and recent ClamAV activity trends.',
    icon: Bug,
    accent: 'bg-rose-50 text-rose-700',
    issueLabel: 'Systems infected',
    issueShortLabel: 'Threats',
  },
};

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

function formatTimelineBucketLabel(value?: string | null) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return 'Unknown';
  }
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
}

function formatChartDateLabel(value?: string | null) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return 'Unknown';
  }
  return new Date(timestamp).toLocaleDateString('en-US');
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

function SectionCard({
  title,
  children,
  actionLabel,
  onAction,
  actionTone = 'default',
  highlighted = false,
  highlightLabel,
  sectionRef,
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionTone?: 'default' | 'primary';
  highlighted?: boolean;
  highlightLabel?: string;
  sectionRef?: (element: HTMLElement | null) => void;
}) {
  return (
    <section ref={sectionRef} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${highlighted ? 'border-sky-300 ring-1 ring-sky-100' : 'border-zinc-200'}`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
          {highlightLabel ? <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">{highlightLabel}</span> : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${actionTone === 'primary' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-white text-sky-700 hover:bg-sky-50'}`}
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-zinc-400" />
      <div className="mt-3 text-sm font-semibold text-zinc-800">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{detail}</div>
    </div>
  );
}

export default function Alerts() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getStoredSession();
  const role = (session?.user.role || '').toLowerCase();
  const canOperate = ['super_admin', 'it_team'].includes(role);
  const basePath = location.pathname.split('/alerts')[0] || '/admin';
  const [view, setView] = useState<AlertsView>('dashboard');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('24h');
  const [darkMode, setDarkMode] = useState(false);
  const [chartDrilldown, setChartDrilldown] = useState<ChartDrilldownState | null>(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [alertsData, setAlertsData] = useState<PaginatedAlertsResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<Record<SourceKey, AlertsDashboardResponse | null>>(emptyDashboardMap<AlertsDashboardResponse | null>(null));
  const [dashboardErrors, setDashboardErrors] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));
  const [dataLoading, setDataLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertsListRecord | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<AlertDeviceRecord | null>(null);
  const [selectedDeviceLoading, setSelectedDeviceLoading] = useState(false);
  const [detailActionLoading, setDetailActionLoading] = useState('');
  const [detailMessage, setDetailMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [installConfig, setInstallConfig] = useState<{ saltApiConfigured?: boolean; sshConfigured?: boolean } | null>(null);
  const [installConfigLoading, setInstallConfigLoading] = useState(false);
  const [selectedSaltAction, setSelectedSaltAction] = useState<SaltActionValue>('system-update');
  const [customSaltInput, setCustomSaltInput] = useState('');
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [sourceWorkspaceViews, setSourceWorkspaceViews] = useState<Record<SourceKey, AlertsSourceWorkspaceView>>(emptyDashboardMap<AlertsSourceWorkspaceView>('dashboard'));
  const [sourceWorkspaceDepartments, setSourceWorkspaceDepartments] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));
  const [sourceWorkspaceSystemKeys, setSourceWorkspaceSystemKeys] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));
  const timelineSectionRef = useRef<HTMLElement | null>(null);
  const malwareSectionRef = useRef<HTMLElement | null>(null);
  const queueSectionRef = useRef<HTMLElement | null>(null);
  const timelineChartPrefetchedRef = useRef(false);
  const malwareChartPrefetchedRef = useRef(false);
  const queueChartPrefetchedRef = useRef(false);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (view !== 'dashboard') {
      return;
    }

    const prefetchTimelineChart = () => {
      if (timelineChartPrefetchedRef.current) {
        return;
      }
      timelineChartPrefetchedRef.current = true;
      void import('../components/alerts/AlertsThreatTimelineChart');
    };

    const prefetchMalwareChart = () => {
      if (malwareChartPrefetchedRef.current) {
        return;
      }
      malwareChartPrefetchedRef.current = true;
      void import('../components/alerts/AlertsMalwareTrendChart');
    };

    const prefetchQueueChart = () => {
      if (queueChartPrefetchedRef.current) {
        return;
      }
      queueChartPrefetchedRef.current = true;
      void import('../components/alerts/AlertsQueueHealthChart');
    };

    if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') {
      prefetchTimelineChart();
      prefetchMalwareChart();
      prefetchQueueChart();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        if (entry.target === timelineSectionRef.current) {
          prefetchTimelineChart();
        }
        if (entry.target === malwareSectionRef.current) {
          prefetchMalwareChart();
        }
        if (entry.target === queueSectionRef.current) {
          prefetchQueueChart();
        }
      });

      if (timelineChartPrefetchedRef.current && malwareChartPrefetchedRef.current && queueChartPrefetchedRef.current) {
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });

    if (timelineSectionRef.current && !timelineChartPrefetchedRef.current) {
      observer.observe(timelineSectionRef.current);
    }
    if (malwareSectionRef.current && !malwareChartPrefetchedRef.current) {
      observer.observe(malwareSectionRef.current);
    }
    if (queueSectionRef.current && !queueChartPrefetchedRef.current) {
      observer.observe(queueSectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [view]);

  useEffect(() => {
    setAlertsPage(1);
  }, [searchQuery, severityFilter, sourceFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setDataLoading(true);
      setAlertsError('');

      const settled = await Promise.allSettled([
        apiRequest<PaginatedAlertsResponse>('/api/alerts?page=1&pageSize=1000'),
        ...SOURCE_KEYS.map((source) => apiRequest<AlertsDashboardResponse>(`/api/alerts/dashboard?source=${source}`)),
      ]);

      if (cancelled) {
        return;
      }

      const [alertsResult, ...dashboardResults] = settled;

      if (alertsResult.status === 'fulfilled') {
        setAlertsData(alertsResult.value);
      } else {
        setAlertsData(null);
        setAlertsError(alertsResult.reason instanceof Error ? alertsResult.reason.message : 'Failed to load alerts');
      }

      const nextDashboardData = emptyDashboardMap<AlertsDashboardResponse | null>(null);
      const nextDashboardErrors = emptyDashboardMap('');
      dashboardResults.forEach((result, index) => {
        const source = SOURCE_KEYS[index];
        if (!source) {
          return;
        }
        if (result.status === 'fulfilled') {
          nextDashboardData[source] = result.value;
        } else {
          nextDashboardErrors[source] = result.reason instanceof Error ? result.reason.message : `Failed to load ${SOURCE_CONFIG[source].label}`;
        }
      });

      setDashboardData(nextDashboardData);
      setDashboardErrors(nextDashboardErrors);
      setDataLoading(false);
      setLastUpdatedAt(new Date().toISOString());
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReloadToken((current) => current + 1);
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canOperate) {
      setInstallConfig(null);
      return;
    }

    let cancelled = false;

    const loadInstallConfig = async () => {
      try {
        setInstallConfigLoading(true);
        const data = await apiRequest<{ saltApiConfigured?: boolean; sshConfigured?: boolean }>('/api/integrations/install-config');
        if (!cancelled) {
          setInstallConfig(data);
        }
      } catch {
        if (!cancelled) {
          setInstallConfig(null);
        }
      } finally {
        if (!cancelled) {
          setInstallConfigLoading(false);
        }
      }
    };

    void loadInstallConfig();

    return () => {
      cancelled = true;
    };
  }, [canOperate]);

  useEffect(() => {
    if (!selectedAlert?.assetId) {
      setSelectedDevice(null);
      setSelectedDeviceLoading(false);
      return;
    }

    let cancelled = false;

    const loadDevice = async () => {
      try {
        setSelectedDeviceLoading(true);
        const data = await apiRequest<AlertDeviceRecord>(`/api/devices/${selectedAlert.assetId}`);
        if (!cancelled) {
          setSelectedDevice(data);
        }
      } catch {
        if (!cancelled) {
          setSelectedDevice(null);
        }
      } finally {
        if (!cancelled) {
          setSelectedDeviceLoading(false);
        }
      }
    };

    void loadDevice();

    return () => {
      cancelled = true;
    };
  }, [selectedAlert?.assetId]);

  const pushToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToasts((current) => [...current, { id: Date.now() + Math.floor(Math.random() * 1000), message, tone }]);
  };

  const refreshData = () => {
    setReloadToken((current) => current + 1);
  };

  const {
    alerts,
    sourceAlerts,
    moduleCards,
    summarySourceOptions,
    sourceCountMap,
    sourceLabelMap,
    alertsToolbarTabs,
    filteredAlerts,
    alertsPageSize,
    totalAlerts,
    openAlertsCount,
    acknowledgedAlertsCount,
    resolvedAlertsCount,
    dashboardSourceCards,
    recentAlerts,
  } = useAlertsDerivedState({
    alertsData,
    dashboardData,
    sourceKeys: SOURCE_KEYS,
    sourceConfig: SOURCE_CONFIG,
    searchQuery,
    severityFilter,
    sourceFilter,
    alertsPage,
    formatDateTime,
    normalizeSeverity,
    normalizeSourceKey,
    sourceLabel,
  });
  const fadeClass = 'animate-[alerts-fade-in_220ms_ease-out]';
  const departmentOptions = useMemo(
    () => Array.from(new Set(alerts.map((alert) => (alert.department || '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [alerts],
  );
  const dashboardTimeCutoff = useMemo(() => {
    const now = Date.now();
    if (timeRangeFilter === '24h') {
      return now - 24 * 60 * 60 * 1000;
    }
    if (timeRangeFilter === '7d') {
      return now - 7 * 24 * 60 * 60 * 1000;
    }
    if (timeRangeFilter === '30d') {
      return now - 30 * 24 * 60 * 60 * 1000;
    }
    return 0;
  }, [timeRangeFilter]);
  const dashboardScopedAlerts = useMemo(
    () => alerts.filter((alert) => {
      const timestamp = parseTimestamp(alert.createdAt);
      const matchesDepartment = departmentFilter === 'all' || (alert.department || 'Unassigned') === departmentFilter;
      const matchesTime = dashboardTimeCutoff === 0 || timestamp >= dashboardTimeCutoff;
      const matchesSource = sourceFilter === 'all' || normalizeSourceKey(alert.source) === sourceFilter;
      const matchesSeverity = severityFilter === 'all' || normalizeSeverity(alert.severity) === severityFilter;
      const matchesQuery = !searchQuery.trim() || [alert.title, alert.detail, alert.hostname, alert.assetName, alert.assetTag, alert.department]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
      return matchesDepartment && matchesTime && matchesSource && matchesSeverity && matchesQuery;
    }),
    [alerts, dashboardTimeCutoff, departmentFilter, normalizeSeverity, normalizeSourceKey, searchQuery, severityFilter, sourceFilter],
  );
  const criticalAlerts = useMemo(
    () => dashboardScopedAlerts.filter((alert) => normalizeSeverity(alert.severity) === 'critical' || normalizeSeverity(alert.severity) === 'high').slice(0, 8),
    [dashboardScopedAlerts, normalizeSeverity],
  );
  const systemsAffectedCount = useMemo(
    () => new Set(dashboardScopedAlerts.map((alert) => alert.assetId || alert.deviceId).filter(Boolean)).size,
    [dashboardScopedAlerts],
  );
  const criticalCount = useMemo(
    () => dashboardScopedAlerts.filter((alert) => normalizeSeverity(alert.severity) === 'critical').length,
    [dashboardScopedAlerts, normalizeSeverity],
  );
  const latestSourceUpdate = useMemo(() => {
    const timestamps = moduleCards.map((entry) => parseTimestamp(entry.lastUpdated)).filter(Boolean);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : lastUpdatedAt;
  }, [lastUpdatedAt, moduleCards]);
  const liveStatusLabel = dataLoading ? 'Refreshing live telemetry' : 'Live telemetry online';
  const queueHealthCards = useMemo(
    () => SOURCE_KEYS.map((source) => {
      const sourceAlertsList = sourceAlerts[source];
      const openCount = sourceAlertsList.filter((alert) => !alert.resolved).length;
      const latestDashboard = dashboardData[source];
      const systems = latestDashboard?.systems ?? [];
      const staleSystems = systems.filter((system) => parseTimestamp(system.lastScanAt) < Date.now() - 72 * 60 * 60 * 1000).length;
      return {
        source,
        label: SOURCE_CONFIG[source].label,
        openCount,
        staleSystems,
        errorSystems: latestDashboard?.moduleCards.find((entry) => normalizeSourceKey(entry.source) === source)?.errorSystemsCount ?? 0,
      };
    }),
    [dashboardData, normalizeSourceKey, sourceAlerts],
  );
  const threatTimeline = useMemo(() => {
    const buckets = new Map<string, number>();
    dashboardScopedAlerts.forEach((alert) => {
      const date = new Date(parseTimestamp(alert.createdAt));
      if (!Number.isFinite(date.getTime())) {
        return;
      }
      const key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    return Array.from(buckets.entries()).slice(-8);
  }, [dashboardScopedAlerts]);
  const threatTimelinePoints = useMemo(
    () => threatTimeline.map(([label, count]) => ({ label, count })),
    [threatTimeline],
  );
  const offlineSystems = useMemo(
    () => SOURCE_KEYS.flatMap((source) => (dashboardData[source]?.systems ?? [])
      .filter((system) => parseTimestamp(system.lastScanAt) < Date.now() - 72 * 60 * 60 * 1000)
      .map((system) => ({ ...system, source }))).slice(0, 6),
    [dashboardData],
  );
  const clamavTrendPoints = useMemo(() => dashboardData.clamav?.trend.dailyBuckets ?? [], [dashboardData.clamav]);
  const clamavTrendChartPoints = useMemo(
    () => clamavTrendPoints.slice(-8).map((point) => ({ label: point.date || 'Unknown', count: point.count })),
    [clamavTrendPoints],
  );
  const complianceFailures = useMemo(() => (dashboardData.openscap?.systems ?? []).filter((system) => system.status === 'error').slice(0, 6), [dashboardData.openscap]);
  const threatHuntingSystems = useMemo(
    () => dashboardScopedAlerts.filter((alert) => normalizeSeverity(alert.severity) === 'critical' || alert.title.toLowerCase().includes('suspicious') || alert.detail.toLowerCase().includes('threat')).slice(0, 10),
    [dashboardScopedAlerts, normalizeSeverity],
  );
  const chartDrilldownAlerts = useMemo(() => {
    if (!chartDrilldown) {
      return filteredAlerts;
    }

    return filteredAlerts.filter((alert) => {
      if (chartDrilldown.source && normalizeSourceKey(alert.source) !== chartDrilldown.source) {
        return false;
      }
      if (chartDrilldown.severity && chartDrilldown.severity !== 'all' && normalizeSeverity(alert.severity) !== chartDrilldown.severity) {
        return false;
      }
      if (chartDrilldown.timelineLabel && formatTimelineBucketLabel(alert.createdAt) !== chartDrilldown.timelineLabel) {
        return false;
      }
      if (chartDrilldown.dateLabel && formatChartDateLabel(alert.createdAt) !== chartDrilldown.dateLabel) {
        return false;
      }
      return true;
    });
  }, [chartDrilldown, filteredAlerts, normalizeSeverity, normalizeSourceKey]);
  const chartDrilldownTotalAlerts = chartDrilldownAlerts.length;
  const chartDrilldownPaginatedAlerts = useMemo(() => {
    const startIndex = (alertsPage - 1) * alertsPageSize;
    return chartDrilldownAlerts.slice(startIndex, startIndex + alertsPageSize);
  }, [alertsPage, alertsPageSize, chartDrilldownAlerts]);
  const chartDrilldownSystems = useMemo(() => {
    const systems = new Map<string, DrilldownSystemPreview>();
    chartDrilldownAlerts.forEach((alert) => {
      const systemKey = alert.assetId || alert.deviceId || alert.hostname || alert.id;
      if (!systems.has(systemKey)) {
        systems.set(systemKey, {
          key: systemKey,
          label: systemName(alert),
          sourceLabel: sourceLabel(alert.source, alert.sourceLabel),
        });
      }
    });
    return Array.from(systems.values()).slice(0, 4);
  }, [chartDrilldownAlerts]);
  const chartDrilldownOpenCount = useMemo(
    () => chartDrilldownAlerts.filter((alert) => !alert.resolved).length,
    [chartDrilldownAlerts],
  );
  const chartDrilldownCriticalCount = useMemo(
    () => chartDrilldownAlerts.filter((alert) => normalizeSeverity(alert.severity) === 'critical' || normalizeSeverity(alert.severity) === 'high').length,
    [chartDrilldownAlerts, normalizeSeverity],
  );
  const timelineSelectionLabel = chartDrilldown?.kind === 'timeline' ? `Bucket ${chartDrilldown.label}` : undefined;
  const malwareSelectionLabel = chartDrilldown?.kind === 'malware' ? `Bucket ${chartDrilldown.label}` : undefined;
  const queueSelectionLabel = chartDrilldown?.kind === 'queue' ? `${chartDrilldown.label} ${chartDrilldown.queueMetric || 'Open'}` : undefined;
  const selectedAlertSource = normalizeSourceKey(selectedAlert?.source);
  const selectedAssetReadOnly = (selectedDevice?.status || '').trim().toLowerCase() === 'retired';
  const selectedAssetHasSaltTarget = hasSaltTarget(selectedDevice);
  const selectedAssetSaltConnected = saltTargetConnected(selectedDevice);
  const selectedAssetCanStartTerminal = canOperate && Boolean(selectedAlert?.assetId) && !installConfigLoading && Boolean(installConfig?.sshConfigured) && !selectedAssetReadOnly;
  const selectedAssetCanOpenSaltConsole = canOperate && Boolean(selectedAlert?.assetId) && selectedAssetHasSaltTarget && !installConfigLoading && !selectedAssetReadOnly;
  const selectedAssetCanRunPatch = canOperate && Boolean(selectedAlert?.assetId) && selectedAssetHasSaltTarget && selectedAssetSaltConnected && Boolean(installConfig?.saltApiConfigured) && !selectedAssetReadOnly;
  const relatedAlerts = useMemo(() => {
    if (!selectedAlert?.assetId) {
      return [];
    }

    return alerts
      .filter((alert) => alert.id !== selectedAlert.id && alert.assetId === selectedAlert.assetId)
      .slice(0, 6)
      .map((alert) => ({
        id: alert.id,
        source: alert.source,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        acknowledged: alert.acknowledged,
        resolved: alert.resolved,
        createdAt: alert.createdAt,
      }));
  }, [alerts, selectedAlert]);
  const terminalBlockedReason = !selectedAlert?.assetId
    ? ''
    : selectedAssetReadOnly
      ? 'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.'
      : installConfigLoading
        ? 'Checking SSH terminal availability...'
        : !installConfig?.sshConfigured
          ? 'SSH terminal sessions are unavailable until the server SSH username and private key are configured.'
          : '';
  const patchBlockedReason = !selectedAlert?.assetId
    ? ''
    : selectedAssetReadOnly
      ? 'This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.'
      : selectedDeviceLoading || installConfigLoading
        ? 'Checking Salt availability for this asset...'
        : !selectedAssetHasSaltTarget
          ? 'Salt console is unavailable until this asset reports a Salt minion ID.'
          : !selectedAssetSaltConnected
            ? 'The linked Salt minion is not currently connected to the master. You can still open the Salt console, but command execution will stay disabled until it reconnects.'
            : !installConfig?.saltApiConfigured
              ? 'The server Salt API is not reachable. You can still open the Salt console, but actions will stay disabled until the API is restored.'
              : '';

  const openAlertDetails = (alert: AlertsListRecord) => {
    setSelectedAlert(alert);
    setDetailMessage(null);
  };

  const handleOpenAsset = () => {
    if (!selectedAlert?.assetId) {
      return;
    }

    const sectionHash = selectedAlertSource === 'clamav'
      ? '#clamav'
      : selectedAlertSource === 'wazuh'
        ? '#security'
        : selectedAlertSource === 'openscap'
          ? '#updates-salt'
          : '';

    navigate(`${basePath}/devices/${selectedAlert.assetId}${sectionHash}`);
  };

  const handleStartTerminal = async () => {
    if (!selectedAlert?.assetId || !canOperate) {
      return;
    }
    if (selectedAssetReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.' });
      return;
    }
    if (installConfigLoading) {
      setDetailMessage({ tone: 'error', text: 'Checking SSH terminal availability...' });
      return;
    }
    if (!installConfig?.sshConfigured) {
      setDetailMessage({ tone: 'error', text: 'SSH terminal sessions are unavailable until the server SSH username and private key are configured.' });
      return;
    }

    try {
      setDetailActionLoading('terminal');
      setDetailMessage(null);
      await apiRequest<{ connection?: { url?: string } }>('/api/ssh/session', {
        method: 'POST',
        body: JSON.stringify({ deviceId: selectedAlert.assetId }),
      });
      setEmbeddedConsole({
        kind: 'ssh',
        title: 'SSH Terminal',
        subtitle: systemName(selectedAlert),
        assetId: selectedAlert.assetId,
      });
      setDetailMessage({ tone: 'success', text: `SSH terminal session started for ${systemName(selectedAlert)}.` });
    } catch (error) {
      setDetailMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to start terminal session' });
    } finally {
      setDetailActionLoading('');
    }
  };

  const handleOpenSaltConsole = async () => {
    if (!selectedAlert?.assetId || !canOperate) {
      return;
    }
    if (selectedAssetReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.' });
      return;
    }
    if (selectedDeviceLoading) {
      setDetailMessage({ tone: 'error', text: 'Checking Salt availability for this asset...' });
      return;
    }
    const minionId = resolveSaltTarget(selectedDevice);
    if (!minionId) {
      setDetailMessage({ tone: 'error', text: 'Salt console is unavailable until this asset reports a Salt minion ID.' });
      return;
    }

    const prefillCommand = buildSaltActionConsolePrefill(selectedSaltAction, customSaltInput, selectedDevice?.osName);
    setEmbeddedConsole(buildEmbeddedSaltConsoleState({
      title: 'Salt Console',
      systemLabel: systemName(selectedAlert),
      assetId: selectedAlert.assetId,
      minionId,
      departmentName: selectedDevice?.department?.name,
      prefillCommand,
    }));
    setDetailMessage({ tone: 'success', text: `Salt console opened for ${systemName(selectedAlert)}.` });
  };

  const handleRunSaltAction = async () => {
    if (!selectedAlert?.assetId || !canOperate) {
      return;
    }
    if (selectedAssetReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.' });
      return;
    }
    if (selectedDeviceLoading || installConfigLoading) {
      setDetailMessage({ tone: 'error', text: 'Checking Salt availability for this asset...' });
      return;
    }

    const validationError = saltActionInputError(selectedSaltAction, customSaltInput);
    if (validationError) {
      setDetailMessage({ tone: 'error', text: validationError });
      return;
    }

    const minionId = resolveSaltTarget(selectedDevice);
    if (!minionId) {
      setDetailMessage({ tone: 'error', text: 'Salt console is unavailable until this asset reports a Salt minion ID.' });
      return;
    }

    if (!selectedAssetSaltConnected) {
      await handleOpenSaltConsole();
      setDetailMessage({ tone: 'error', text: 'The linked Salt minion is not currently connected to the master. The Salt console is open, but commands will stay disabled until it reconnects.' });
      return;
    }

    if (!installConfig?.saltApiConfigured) {
      await handleOpenSaltConsole();
      setDetailMessage({ tone: 'error', text: 'The server Salt API is not reachable. The Salt console is open, but actions will stay disabled until the API is restored.' });
      return;
    }

    try {
      setDetailActionLoading('patch');
      setDetailMessage(null);
      const isReportable = isPatchReportableSaltAction(selectedSaltAction, customSaltInput);
      const reportDevice = {
        id: selectedAlert.assetId,
        hostname: systemName(selectedAlert),
        department: selectedDevice?.department?.name ? { name: selectedDevice.department.name } : null,
      };
      const requestedAt = new Date().toISOString();
      if (isReportable) {
        setPatchReport({
          ...createPatchRunProgressReport(systemName(selectedAlert), requestedAt, 1),
          rows: [createPatchRunRunningEntry(reportDevice)],
        });
      }

      const result = await apiRequest<PatchRunExecutionResponse>(`/api/assets/${selectedAlert.assetId}/patch`, {
        method: 'POST',
        body: JSON.stringify(buildSaltActionRequest(selectedSaltAction, customSaltInput)),
      });

      if (isReportable) {
        const row = createPatchRunReportEntry(reportDevice, result);
        setPatchReport(createPatchRunReport(systemName(selectedAlert), requestedAt, [row]));
      }

      setDetailMessage({ tone: 'success', text: saltActionSuccessMessage(selectedSaltAction, result.status, systemName(selectedAlert), false) });
    } catch (error) {
      if (isPatchReportableSaltAction(selectedSaltAction, customSaltInput) && selectedAlert?.assetId) {
        const row = createPatchRunReportEntry({
          id: selectedAlert.assetId,
          hostname: systemName(selectedAlert),
          department: selectedDevice?.department?.name ? { name: selectedDevice.department.name } : null,
        }, undefined, error);
        setPatchReport(createPatchRunReport(systemName(selectedAlert), new Date().toISOString(), [row]));
      }
      setDetailMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to run Salt action' });
    } finally {
      setDetailActionLoading('');
    }
  };

  async function handleAlertAction(alert: AlertsListRecord, action: 'acknowledge' | 'resolve') {
    if (action === 'acknowledge' && alert.acknowledged) {
      return;
    }
    if (action === 'resolve' && alert.resolved) {
      return;
    }

    try {
      await apiRequest(`/api/alerts/${alert.id}/${action}`, { method: 'PUT' });
      pushToast(action === 'acknowledge' ? `Alert ${alert.id} acknowledged.` : `Alert ${alert.id} resolved.`);
      setSelectedAlert((current) => {
        if (!current || current.id !== alert.id) {
          return current;
        }
        return {
          ...current,
          acknowledged: action === 'acknowledge' ? true : current.acknowledged,
          resolved: action === 'resolve' ? true : current.resolved,
        };
      });
      refreshData();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : `Failed to ${action} alert`, 'error');
    }
  }

  function renderSourceWorkspace(source: SourceKey) {
    const config = SOURCE_CONFIG[source];

    return (
      <div className={`space-y-6 ${fadeClass}`}>
        <AlertsSourceWorkspacePanel
          source={source}
          sourceLabel={config.label}
          alerts={sourceAlerts[source]}
          dashboard={dashboardData[source]}
          loading={dataLoading}
          error={dashboardErrors[source]}
          activeView={sourceWorkspaceViews[source]}
          selectedDepartment={sourceWorkspaceDepartments[source]}
          selectedSystemKey={sourceWorkspaceSystemKeys[source]}
          darkMode={darkMode}
          readOnlyReview={!canOperate}
          onActiveViewChange={(nextView) => {
            setSourceWorkspaceViews((current) => ({ ...current, [source]: nextView }));
          }}
          onSelectDepartment={(department) => {
            setSourceWorkspaceDepartments((current) => ({ ...current, [source]: department }));
          }}
          onSelectSystemKey={(systemKey) => {
            setSourceWorkspaceSystemKeys((current) => ({ ...current, [source]: systemKey }));
          }}
          onSelectAlert={openAlertDetails}
          renderSourceIcon={alertsRenderSourceIcon}
          formatRelativeTime={formatRelativeTime}
        />
      </div>
    );
  }

  const mainTabs = [
    { id: 'dashboard' as const, label: 'Dashboard', count: totalAlerts, icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'wazuh' as const, label: 'Wazuh', count: sourceAlerts.wazuh.length, icon: <Shield className="h-4 w-4" /> },
    { id: 'openscap' as const, label: 'OpenSCAP', count: sourceAlerts.openscap.length, icon: <ClipboardCheck className="h-4 w-4" /> },
    { id: 'clamav' as const, label: 'ClamAV', count: sourceAlerts.clamav.length, icon: <Bug className="h-4 w-4" /> },
    { id: 'threat-hunting' as const, label: 'Threat Hunting', count: threatHuntingSystems.length, icon: <Radar className="h-4 w-4" /> },
    { id: 'all-alerts' as const, label: 'All Alerts', count: filteredAlerts.length, icon: <Bell className="h-4 w-4" /> },
  ];

  const sourceDashboardCards = dashboardSourceCards.map((card) => {
    const dashboard = dashboardData[card.source as SourceKey];
    const moduleCard = dashboard?.moduleCards.find((entry) => normalizeSourceKey(entry.source) === card.source);
    const riskScore = Math.min(100, Math.round((card.issueCount * 8) + (card.alertCount * 4)));
    return {
      ...card,
      systemsAffected: dashboard?.systems.filter((system) => system.status === 'error').length ?? 0,
      healthStatus: moduleCard?.statusColor === 'red' ? 'Critical' : moduleCard?.statusColor === 'yellow' ? 'Warning' : 'Healthy',
      healthTone: moduleCard?.statusColor === 'red' ? 'critical' as const : moduleCard?.statusColor === 'yellow' ? 'warning' as const : 'healthy' as const,
      riskScore,
      sparklineValues: dashboard?.trend.dailyBuckets.map((bucket) => bucket.count) ?? [0, 0, 0, 0, 0],
    };
  });

  const openSourceConsole = (source: SourceKey) => {
    const candidate = sourceAlerts[source][0];
    if (candidate) {
      openAlertDetails(candidate);
      setView(source);
      setDetailMessage({ tone: 'success', text: `Source console path primed for ${SOURCE_CONFIG[source].label}. Open the selected alert to continue into endpoint response.` });
      return;
    }
    pushToast(`No live ${SOURCE_CONFIG[source].label} alerts are available for console pivoting.`, 'error');
  };

  const investigateSource = (source: SourceKey) => {
    setSourceFilter(source);
    setView('all-alerts');
  };

  const clearChartDrilldown = () => {
    setChartDrilldown(null);
  };

  const handleThreatTimelineSelect = (label: string) => {
    setChartDrilldown({
      kind: 'timeline',
      label,
      detail: `Timeline bucket ${label}`,
      timelineLabel: label,
    });
    setView('all-alerts');
    setAlertsPage(1);
  };

  const handleMalwareTrendSelect = (label: string) => {
    setSourceFilter('clamav');
    setChartDrilldown({
      kind: 'malware',
      label,
      detail: `ClamAV detections for ${label}`,
      source: 'clamav',
      dateLabel: label,
    });
    setView('all-alerts');
    setAlertsPage(1);
  };

  const handleQueueHealthSelect = (selection: { label: string; metric: 'Open' | 'Offline' | 'Errors' }) => {
    const sourceKey = SOURCE_KEYS.find((source) => SOURCE_CONFIG[source].label === selection.label);
    const nextSeverity: SeverityFilter = selection.metric === 'Errors' ? 'high' : 'all';
    if (sourceKey) {
      setSourceFilter(sourceKey);
    }
    setSeverityFilter(nextSeverity);
    setChartDrilldown({
      kind: 'queue',
      label: selection.label,
      detail: `${selection.label} ${selection.metric.toLowerCase()} queue`,
      source: sourceKey,
      severity: nextSeverity,
      queueMetric: selection.metric,
    });
    setView('all-alerts');
    setAlertsPage(1);
  };

  return (
    <div className={`min-h-screen px-4 py-6 xl:px-6 ${darkMode ? 'text-white' : 'text-zinc-900'}`} style={{ backgroundColor: darkMode ? '#07111f' : PAGE_BG }}>
      <style>{`
        @keyframes alerts-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
        <div className="sticky top-4 z-40 space-y-4">
          <AlertsHeroSection
            feedLabel="Security Operations"
            totalAlerts={totalAlerts}
            openCount={openAlertsCount}
            criticalCount={criticalCount}
            acknowledgedCount={acknowledgedAlertsCount}
            resolvedCount={resolvedAlertsCount}
            systemsAffectedCount={systemsAffectedCount}
            sourceCountMap={sourceCountMap}
            moduleCards={moduleCards}
            sourceFilter={sourceFilter}
            sourceOptions={summarySourceOptions}
            severityFilter={severityFilter}
            departmentFilter={departmentFilter}
            departmentOptions={departmentOptions}
            timeRangeFilter={timeRangeFilter}
            searchQuery={searchQuery}
            lastUpdatedLabel={formatRelativeTime(latestSourceUpdate)}
            liveStatusLabel={liveStatusLabel}
            notificationCount={criticalCount + offlineSystems.length}
            darkMode={darkMode}
            readOnlyReview={!canOperate}
            onSelectSourceFilter={setSourceFilter}
            onSelectSeverityFilter={(value) => setSeverityFilter(value as SeverityFilter)}
            onSelectDepartmentFilter={setDepartmentFilter}
            onSelectTimeRangeFilter={(value) => setTimeRangeFilter(value as TimeRangeFilter)}
            onSearchQueryChange={setSearchQuery}
            onToggleDarkMode={() => setDarkMode((current) => !current)}
            renderSourceIcon={alertsRenderSourceIcon}
          />

          <AlertsStatusStrip
            loading={dataLoading}
            alertsError={alertsError}
            hasAlertsData={Boolean(alertsData)}
            totalAlertsLabel={`${formatNumber(totalAlerts)} alerts visible across configured sources`}
            liveLabel={liveStatusLabel}
            lastUpdatedLabel={formatRelativeTime(latestSourceUpdate)}
            notificationCount={criticalCount + offlineSystems.length}
            onRefresh={refreshData}
          />

          <AlertsMainTabs tabs={mainTabs} activeTab={view} onSelectTab={(value) => setView(value as AlertsView)} />
        </div>

        <main className="space-y-6 overflow-y-auto">
          {view === 'dashboard' ? (
            <div className={`space-y-6 ${fadeClass}`}>
              <AlertsDashboardSourceGrid
                cards={sourceDashboardCards}
                formatNumber={formatNumber}
                onOpenSource={(source) => setView(source as AlertsView)}
                onOpenConsole={(source) => openSourceConsole(source as SourceKey)}
                onInvestigate={(source) => investigateSource(source as SourceKey)}
              />

              {chartDrilldown ? (
                <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,_#f7fbff_0%,_#ffffff_50%,_#f2f8ff_100%)] p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                        Active Analyst Selection
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{chartDrilldown.detail}</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">The dashboard is highlighting the currently selected chart slice. Use this preview to inspect the matching scope before moving into the full queue.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setView('all-alerts')} className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50">
                        Open Queue
                      </button>
                      <button type="button" onClick={clearChartDrilldown} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50">
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Matching alerts</div>
                        <div className="mt-2 text-3xl font-black text-zinc-950">{chartDrilldownTotalAlerts}</div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Open in slice</div>
                        <div className="mt-2 text-3xl font-black text-sky-700">{chartDrilldownOpenCount}</div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Critical or high</div>
                        <div className="mt-2 text-3xl font-black text-rose-700">{chartDrilldownCriticalCount}</div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Matching systems</div>
                        <div className="mt-3 space-y-2">
                          {chartDrilldownSystems.length === 0 ? (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">No systems matched the active selection.</div>
                          ) : (
                            chartDrilldownSystems.map((system) => (
                              <div key={system.key} className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3">
                                <div className="text-sm font-semibold text-zinc-950">{system.label}</div>
                                <div className="mt-1 text-xs text-zinc-500">{system.sourceLabel}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Alert preview</div>
                        <div className="mt-3 space-y-2">
                          {chartDrilldownAlerts.slice(0, 3).map((alert) => (
                            <button key={alert.id} type="button" onClick={() => openAlertDetails(alert)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3 text-left transition hover:bg-zinc-50">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-zinc-950">{systemName(alert)}</div>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${alertsRenderSeverityClassName(alert)}`}>{normalizeSeverity(alert.severity)}</span>
                              </div>
                              <div className="mt-1 text-sm text-zinc-600">{alert.title}</div>
                              <div className="mt-2 text-xs text-zinc-500">{sourceLabel(alert.source, alert.sourceLabel)} • {formatRelativeTime(alert.createdAt)}</div>
                            </button>
                          ))}
                          {chartDrilldownAlerts.length === 0 ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">No alerts matched the active selection.</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
                <SectionCard title="Recent Critical Alerts Table" actionLabel="All Alerts" onAction={() => setView('all-alerts')} actionTone="primary">
                  {criticalAlerts.length === 0 ? (
                    <EmptyState title="No critical alerts in the current scope" detail="Change filters or widen the time range to inspect older incidents." />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-zinc-200">
                      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                        <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-4 py-3">System</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">Department</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 bg-white">
                          {criticalAlerts.map((alert) => (
                            <tr key={alert.id} onClick={() => openAlertDetails(alert)} className="cursor-pointer hover:bg-zinc-50">
                              <td className="px-4 py-3 font-semibold text-zinc-950">
                                {systemName(alert)}
                                <div className="text-xs font-normal text-zinc-500">{alert.title}</div>
                              </td>
                              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${alertsRenderSeverityClassName(alert)}`}>{normalizeSeverity(alert.severity)}</span></td>
                              <td className="px-4 py-3 text-zinc-600">{alert.department || 'Unassigned'}</td>
                              <td className="px-4 py-3 text-zinc-600">{sourceLabel(alert.source, alert.sourceLabel)}</td>
                              <td className="px-4 py-3 text-zinc-600">{formatRelativeTime(alert.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Threat Activity Timeline" highlighted={chartDrilldown?.kind === 'timeline'} highlightLabel={timelineSelectionLabel} sectionRef={(element) => {
                  timelineSectionRef.current = element;
                }}>
                  {threatTimelinePoints.length === 0 ? (
                    <EmptyState title="No timeline points in scope" detail="The activity timeline fills as alerts enter the selected time window." />
                  ) : (
                    <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Event pressure</div>
                          <div className="mt-1 text-sm text-zinc-600">Live activity spikes across the current SOC scope. Click a plotted point to open the matching alert window.</div>
                        </div>
                        <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">{threatTimelinePoints.reduce((sum, point) => sum + point.count, 0)} total</div>
                      </div>
                      <Suspense fallback={<TimelineChartFallback />}>
                        <LazyThreatTimelineChart points={threatTimelinePoints} activeLabel={chartDrilldown?.kind === 'timeline' ? chartDrilldown.label : null} onSelectPoint={handleThreatTimelineSelect} />
                      </Suspense>
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <SectionCard title="Agent Offline Systems">
                  {offlineSystems.length === 0 ? (
                    <EmptyState title="No stale agents detected" detail="Systems with scans older than 72 hours will appear here for analyst follow-up." />
                  ) : (
                    <div className="space-y-3">
                      {offlineSystems.map((system) => (
                        <button key={`${system.source}-${system.key}`} type="button" onClick={() => setView(system.source as AlertsView)} className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50">
                          <div>
                            <div className="font-semibold text-zinc-950">{system.hostname}</div>
                            <div className="mt-1 text-xs text-zinc-500">{system.department} • {SOURCE_CONFIG[system.source as SourceKey].label}</div>
                          </div>
                          <div className="text-xs font-semibold text-amber-600">Last scan {formatRelativeTime(system.lastScanAt)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Malware Detection Trends" highlighted={chartDrilldown?.kind === 'malware'} highlightLabel={malwareSelectionLabel} sectionRef={(element) => {
                  malwareSectionRef.current = element;
                }}>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">ClamAV trendline</div>
                      <div className="mt-2 text-3xl font-black text-zinc-950">{clamavTrendPoints.reduce((sum, point) => sum + point.count, 0)}</div>
                      <div className="mt-1 text-sm text-zinc-500">detections across visible daily buckets</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fff7f8_100%)] p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-sm text-zinc-600">Click any malware detection point to pivot into that day&apos;s ClamAV alerts.</div>
                        <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">Interactive</div>
                      </div>
                      <Suspense fallback={<MalwareChartFallback />}>
                        <LazyMalwareTrendChart points={clamavTrendChartPoints} activeLabel={chartDrilldown?.kind === 'malware' ? chartDrilldown.label : null} onSelectPoint={handleMalwareTrendSelect} />
                      </Suspense>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Compliance Failures">
                  {complianceFailures.length === 0 ? (
                    <EmptyState title="No compliance failures in scope" detail="OpenSCAP failures will appear here when hardening drift is detected." />
                  ) : (
                    <div className="space-y-3">
                      {complianceFailures.map((system) => (
                        <div key={system.key} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                          <div className="font-semibold text-zinc-950">{system.hostname}</div>
                          <div className="mt-1 text-xs text-zinc-500">{system.department}</div>
                          <div className="mt-2 text-sm text-amber-700">{system.errorCount} failing controls</div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <SectionCard title="Queue Health Monitoring" highlighted={chartDrilldown?.kind === 'queue'} highlightLabel={queueSelectionLabel} sectionRef={(element) => {
                queueSectionRef.current = element;
              }}>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-sm text-zinc-600">Select any bar to open the matching source queue with severity context.</div>
                      <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-700">Source drilldown</div>
                    </div>
                    <Suspense fallback={<QueueChartFallback />}>
                      <LazyQueueHealthChart
                        items={queueHealthCards}
                        activeSelection={chartDrilldown?.kind === 'queue' ? { label: chartDrilldown.label, metric: chartDrilldown.queueMetric || 'Open' } : null}
                        onSelectBar={handleQueueHealthSelect}
                      />
                    </Suspense>
                  </div>
                  <div className="grid gap-4">
                    {queueHealthCards.map((card) => (
                      <div key={card.source} className={`rounded-2xl border px-4 py-4 shadow-sm ${chartDrilldown?.kind === 'queue' && chartDrilldown.label === card.label ? 'border-sky-300 bg-sky-50/70 ring-1 ring-sky-100' : 'border-zinc-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-black text-zinc-950">{card.label}</div>
                          <TrendingUp className="h-4 w-4 text-sky-500" />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-zinc-50 px-3 py-3"><div className="text-xl font-black text-zinc-950">{card.openCount}</div><div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Open</div></div>
                          <div className="rounded-xl bg-zinc-50 px-3 py-3"><div className="text-xl font-black text-amber-700">{card.staleSystems}</div><div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Offline</div></div>
                          <div className="rounded-xl bg-zinc-50 px-3 py-3"><div className="text-xl font-black text-rose-700">{card.errorSystems}</div><div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Errors</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Recent Alerts" actionLabel="All Alerts" onAction={() => setView('all-alerts')}>
                {recentAlerts.length === 0 ? (
                  <EmptyState title="No recent alerts" detail="Recent alerts appear here as new events are received." />
                ) : (
                  <AlertsRecentTable
                    alerts={recentAlerts}
                    renderSystemName={systemName}
                    renderSeverityClassName={alertsRenderSeverityClassName}
                    renderSourceLabel={alertsRenderSourceLabel}
                    formatDateTime={formatDateTime}
                  />
                )}
              </SectionCard>
            </div>
          ) : null}

          {view === 'wazuh' ? renderSourceWorkspace('wazuh') : null}
          {view === 'openscap' ? renderSourceWorkspace('openscap') : null}
          {view === 'clamav' ? renderSourceWorkspace('clamav') : null}

          {view === 'threat-hunting' ? (
            <div className={`space-y-6 ${fadeClass}`}>
              <SectionCard title="Threat Hunting">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Hunt Queue</div>
                      <div className="mt-2 text-xl font-black text-zinc-950">Potential escalations and suspicious systems</div>
                    </div>
                    {threatHuntingSystems.length === 0 ? (
                      <EmptyState title="No active hunt leads" detail="Critical or suspicious alerts in the current filter scope will appear here." />
                    ) : threatHuntingSystems.map((alert) => (
                      <button key={alert.id} type="button" onClick={() => openAlertDetails(alert)} className="flex w-full items-start justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-left hover:bg-zinc-50">
                        <div>
                          <div className="font-semibold text-zinc-950">{systemName(alert)}</div>
                          <div className="mt-1 text-sm text-zinc-600">{alert.title}</div>
                          <div className="mt-1 text-xs text-zinc-500">{alert.department || 'Unassigned'} • {sourceLabel(alert.source, alert.sourceLabel)}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${alertsRenderSeverityClassName(alert)}`}>{normalizeSeverity(alert.severity)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Hunt guidance</div>
                      <div className="mt-2 text-lg font-black text-zinc-950">Investigation launch points</div>
                      <div className="mt-3 space-y-2 text-sm text-zinc-600">
                        <div className="rounded-xl bg-zinc-50 px-3 py-3">Start with Wazuh rule spikes, then pivot into OpenSCAP drift for the same department.</div>
                        <div className="rounded-xl bg-zinc-50 px-3 py-3">Use the selected alert drawer to reach endpoint terminal and Salt console actions.</div>
                        <div className="rounded-xl bg-zinc-50 px-3 py-3">Track malware detections against compliance drift to prioritize high-risk systems.</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Priority risk score</div>
                      <div className="mt-2 text-4xl font-black text-zinc-950">{Math.min(100, criticalCount * 12 + offlineSystems.length * 4)}</div>
                      <div className="mt-2 text-sm text-zinc-500">Weighted from critical alerts, stale agents, and active compliance failures in the visible scope.</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {view === 'all-alerts' ? (
            <div className={`space-y-6 ${fadeClass}`}>
              {chartDrilldown ? (
                <section className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Chart Drilldown Active</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">{chartDrilldown.detail}</div>
                      <div className="mt-1 text-xs text-zinc-600">This queue is narrowed from a dashboard chart selection. Clear it to return to the broader alert feed.</div>
                    </div>
                    <button type="button" onClick={clearChartDrilldown} className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-100">
                      Clear Drilldown
                    </button>
                  </div>
                </section>
              ) : null}

              <AlertsQueueOverviewCard
                severityFilter={severityFilter}
                severityOptions={SEVERITY_FILTER_OPTIONS}
                onSeverityFilterChange={(value) => setSeverityFilter(value as SeverityFilter)}
                onBackToDashboard={() => setView('dashboard')}
              />

              <div className="overflow-hidden rounded-[24px] border border-sky-100 bg-white/95 shadow-sm">
                <AlertsToolbar
                  tabs={alertsToolbarTabs}
                  sourceFilter={sourceFilter}
                  totalAlerts={chartDrilldownTotalAlerts}
                  sourceCountMap={sourceCountMap}
                  onSelectSourceFilter={setSourceFilter}
                  renderSourceIcon={alertsRenderSourceIcon}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  sourceOptions={summarySourceOptions.map((option) => ({ value: option.value, label: option.label }))}
                  sourceLabelMap={sourceLabelMap}
                />
                <AlertsFeedPane
                  loading={dataLoading}
                  alerts={chartDrilldownPaginatedAlerts}
                  selectedAlertId={selectedAlert?.id}
                  readOnlyReview={!canOperate}
                  onSelectAlert={openAlertDetails}
                  totalAlerts={chartDrilldownTotalAlerts}
                  currentPage={alertsPage}
                  pageSize={alertsPageSize}
                  onPageChange={setAlertsPage}
                  renderSystemName={systemName}
                  renderAlertStatusClassName={alertsRenderAlertStatusClassName}
                  renderAlertStatusLabel={alertsRenderAlertStatusLabel}
                  renderSeverityDotClassName={alertsRenderSeverityDotClassName}
                  formatRelativeTime={formatRelativeTime}
                  renderSourceBadgeClassName={alertsRenderSourceBadgeClassName}
                  renderSourceIcon={alertsRenderSourceIcon}
                  renderSourceLabel={alertsRenderSourceLabel}
                  renderAlertAsset={alertsRenderAlertAsset}
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {selectedAlert ? (
        <div className={`fixed inset-0 z-[60] ${darkMode ? 'bg-slate-950/70 backdrop-blur-sm' : 'bg-zinc-950/35'}`} onClick={() => setSelectedAlert(null)}>
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l shadow-2xl ${darkMode ? 'border-white/10 bg-[#07111f]' : 'border-zinc-200 bg-white'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
              className={`absolute right-5 top-5 z-10 rounded-xl border px-3 py-2 text-sm font-bold ${darkMode ? 'border-white/10 bg-slate-950/60 text-slate-100 hover:bg-slate-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-5 py-5">
              <AlertsDetailPane
                selectedAlert={selectedAlert}
                selectedAlertSource={selectedAlertSource}
                darkMode={darkMode}
                canAcknowledge={true}
                canResolve={true}
                detailActionLoading={detailActionLoading}
                detailMessage={detailMessage}
                selectedAssetCanStartTerminal={selectedAssetCanStartTerminal}
                selectedAssetCanOpenPatchConsole={selectedAssetCanOpenSaltConsole}
                selectedAssetCanRunPatch={selectedAssetCanRunPatch}
                terminalBlockedReason={terminalBlockedReason}
                patchBlockedReason={patchBlockedReason}
                selectedSaltAction={selectedSaltAction}
                customSaltInput={customSaltInput}
                selectedPatchActionLabel="Run Salt Action"
                relatedAlerts={relatedAlerts}
                relatedAlertsLoading={false}
                onOpenAsset={handleOpenAsset}
                onStartTerminal={() => void handleStartTerminal()}
                onOpenSaltConsole={() => void handleOpenSaltConsole()}
                onAcknowledge={(id) => {
                  const alert = alerts.find((item) => item.id === id);
                  if (alert) {
                    void handleAlertAction(alert, 'acknowledge');
                  }
                }}
                onResolve={(id) => {
                  const alert = alerts.find((item) => item.id === id);
                  if (alert) {
                    void handleAlertAction(alert, 'resolve');
                  }
                }}
                onRunPatch={() => void handleRunSaltAction()}
                onSelectedSaltActionChange={setSelectedSaltAction}
                onCustomSaltInputChange={setCustomSaltInput}
                renderSystemName={systemName}
                renderSeverityClassName={alertsRenderSeverityClassName}
                renderSourceBadgeClassName={alertsRenderSourceBadgeClassName}
                renderSourceIcon={alertsRenderSourceIcon}
                renderSourceLabel={alertsRenderSourceLabel}
                renderAlertStatusClassName={alertsRenderAlertStatusClassName}
                renderAlertStatusLabel={alertsRenderAlertStatusLabel}
                renderAlertUser={alertsRenderAlertUser}
                renderSeverityDotClassName={alertsRenderSeverityDotClassName}
                formatRelativeTime={formatRelativeTime}
                formatAbsoluteTime={formatDateTime}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <EmbeddedConsoleModal consoleState={embeddedConsole} titleId="alerts-console-title" onClose={() => setEmbeddedConsole(null)} />
      <PatchRunReportModal report={patchReport} onClose={() => setPatchReport(null)} />

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.24)] animate-[alerts-fade-in_220ms_ease-out] ${toast.tone === 'error' ? 'bg-rose-600' : 'bg-zinc-900'}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
