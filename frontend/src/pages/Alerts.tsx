import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bell,
  Bug,
  ChevronRight,
  ClipboardCheck,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import EmbeddedConsoleModal, { type EmbeddedConsoleState } from '../components/EmbeddedConsoleModal';
import PatchRunReportModal from '../components/PatchRunReportModal';
import { AlertsDetailPane } from '../components/alerts/AlertsDetailPane';
import { AlertsDashboardSourceGrid } from '../components/alerts/AlertsDashboardSourceGrid';
import { AlertsFeedPane } from '../components/alerts/AlertsFeedPane';
import { AlertsMainTabs } from '../components/alerts/AlertsMainTabs';
import { AlertsQueueOverviewCard } from '../components/alerts/AlertsQueueOverviewCard';
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
import { buildEmbeddedSaltConsoleState } from '../components/embeddedConsoleModalUtils';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import { hasSaltTarget, resolveSaltTarget, saltTargetConnected, type BootstrapDeviceLike } from '../lib/bootstrap';
import { buildSaltActionConsolePrefill, buildSaltActionRequest, isPatchReportableSaltAction, saltActionInputError, saltActionSuccessMessage, type SaltActionValue } from '../lib/salt';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, createPatchRunRunningEntry, type PatchRunExecutionResponse, type PatchRunReport } from '../lib/patchReports';
import {
  emptyDashboardMap,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  normalizeSeverity,
  normalizeSourceKey,
  parseTimestamp,
  sourceLabel,
  systemName,
  type SeverityFilter,
  type SourceKey,
} from './alertsUtils';

type AlertsView = 'dashboard' | 'all-alerts';
type TimeRangeFilter = '24h' | '7d' | '30d' | 'all';

interface ChartDrilldownState {
  kind: 'timeline' | 'malware';
  label: string;
  detail: string;
  source?: string;
  severity?: SeverityFilter;
  timelineLabel?: string;
  dateLabel?: string;
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

function TimelineChartFallback() {
  return <div className="h-72 w-full rounded-2xl bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)]" aria-hidden="true" />;
}

function MalwareChartFallback() {
  return <div className="h-72 w-full rounded-2xl bg-[linear-gradient(180deg,_#ffffff_0%,_#fff7f8_100%)]" aria-hidden="true" />;
}

interface AlertDeviceRecord extends BootstrapDeviceLike {
  id: string;
  status?: string | null;
}

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
    <section ref={sectionRef} className={`overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition ${highlighted ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'}`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Dashboard section</div>
          <h2 className="text-lg font-black text-zinc-950">{title}</h2>
          {highlightLabel ? <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">{highlightLabel}</span> : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition ${actionTone === 'primary' ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-zinc-200 bg-white text-sky-700 hover:bg-sky-50'}`}
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
    <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-zinc-400" />
      <div className="mt-3 text-sm font-semibold text-zinc-800">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{detail}</div>
    </div>
  );
}

function sourceSubnavButtonClass(source: SourceKey, active: boolean) {
  if (source === 'openscap') {
    return `group inline-flex min-w-[220px] items-start gap-3 rounded-[18px] border px-4 py-3 text-left backdrop-blur-xl transition ${active ? 'border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(238,242,255,0.9)_100%)] text-indigo-900 shadow-[0_20px_40px_rgba(99,102,241,0.16)] ring-1 ring-white/60' : 'border-white/60 bg-[linear-gradient(135deg,_rgba(255,255,255,0.48)_0%,_rgba(255,255,255,0.28)_100%)] text-zinc-700 shadow-[0_16px_34px_rgba(15,23,42,0.08)] hover:border-indigo-200/70 hover:bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(238,242,255,0.8)_100%)] hover:text-indigo-800'}`;
  }
  if (source === 'clamav') {
    return `group inline-flex min-w-[220px] items-start gap-3 rounded-[18px] border px-4 py-3 text-left backdrop-blur-xl transition ${active ? 'border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(255,241,242,0.9)_100%)] text-rose-900 shadow-[0_20px_40px_rgba(244,63,94,0.16)] ring-1 ring-white/60' : 'border-white/60 bg-[linear-gradient(135deg,_rgba(255,255,255,0.48)_0%,_rgba(255,255,255,0.28)_100%)] text-zinc-700 shadow-[0_16px_34px_rgba(15,23,42,0.08)] hover:border-rose-200/70 hover:bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(255,241,242,0.82)_100%)] hover:text-rose-800'}`;
  }
  return `group inline-flex min-w-[220px] items-start gap-3 rounded-[18px] border px-4 py-3 text-left backdrop-blur-xl transition ${active ? 'border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(239,248,255,0.88)_100%)] text-sky-900 shadow-[0_20px_40px_rgba(14,165,233,0.16)] ring-1 ring-white/60' : 'border-white/60 bg-[linear-gradient(135deg,_rgba(255,255,255,0.48)_0%,_rgba(255,255,255,0.28)_100%)] text-zinc-700 shadow-[0_16px_34px_rgba(15,23,42,0.08)] hover:border-sky-200/70 hover:bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(240,249,255,0.78)_100%)] hover:text-sky-800'}`;
}

function sourceSubnavIconClass(source: SourceKey, active: boolean) {
  if (source === 'openscap') {
    return active ? 'border-white/80 bg-white/70 text-indigo-700 shadow-sm' : 'border-white/70 bg-white/45 text-zinc-500 shadow-sm group-hover:border-indigo-200/70 group-hover:bg-white/70 group-hover:text-indigo-700';
  }
  if (source === 'clamav') {
    return active ? 'border-white/80 bg-white/70 text-rose-700 shadow-sm' : 'border-white/70 bg-white/45 text-zinc-500 shadow-sm group-hover:border-rose-200/70 group-hover:bg-white/70 group-hover:text-rose-700';
  }
  return active ? 'border-white/80 bg-white/70 text-sky-700 shadow-sm' : 'border-white/70 bg-white/45 text-zinc-500 shadow-sm group-hover:border-sky-200/70 group-hover:bg-white/70 group-hover:text-sky-700';
}

function sourceSubnavBadgeClass(source: SourceKey, active: boolean) {
  if (source === 'openscap') {
    return active ? 'bg-indigo-100/90 text-indigo-800' : 'bg-white/70 text-zinc-500 group-hover:bg-indigo-100/90 group-hover:text-indigo-700';
  }
  if (source === 'clamav') {
    return active ? 'bg-rose-100/90 text-rose-800' : 'bg-white/70 text-zinc-500 group-hover:bg-rose-100/90 group-hover:text-rose-700';
  }
  return active ? 'bg-sky-100/90 text-sky-800' : 'bg-white/70 text-zinc-500 group-hover:bg-sky-100/90 group-hover:text-sky-700';
}

export default function Alerts() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getStoredSession();
  const role = (session?.user.role || '').toLowerCase();
  const canOperate = ['super_admin', 'it_team'].includes(role);
  const basePath = location.pathname.split('/alerts')[0] || '/admin';
  const [view, setView] = useState<AlertsView>('dashboard');
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter] = useState('all');
  const [timeRangeFilter] = useState<TimeRangeFilter>('24h');
  const [darkMode] = useState(false);
  const [chartDrilldown, setChartDrilldown] = useState<ChartDrilldownState | null>(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [, setLastUpdatedAt] = useState('');
  const [alertsData, setAlertsData] = useState<PaginatedAlertsResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<Record<SourceKey, AlertsDashboardResponse | null>>(emptyDashboardMap<AlertsDashboardResponse | null>(null));
  const [, setDashboardErrors] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));
  const [dataLoading, setDataLoading] = useState(true);
  const [, setAlertsError] = useState('');
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
  const [selectedDashboardSource, setSelectedDashboardSource] = useState<SourceKey>('wazuh');
  const [sourceWorkspaceView, setSourceWorkspaceView] = useState<AlertsSourceWorkspaceView>('dashboard');
  const [sourceWorkspaceDepartment, setSourceWorkspaceDepartment] = useState('');
  const [sourceWorkspaceSystemKey, setSourceWorkspaceSystemKey] = useState('');
  const timelineSectionRef = useRef<HTMLElement | null>(null);
  const malwareSectionRef = useRef<HTMLElement | null>(null);
  const timelineChartPrefetchedRef = useRef(false);
  const malwareChartPrefetchedRef = useRef(false);

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

    if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') {
      prefetchTimelineChart();
      prefetchMalwareChart();
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
      });

      if (timelineChartPrefetchedRef.current && malwareChartPrefetchedRef.current) {
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });

    if (timelineSectionRef.current && !timelineChartPrefetchedRef.current) {
      observer.observe(timelineSectionRef.current);
    }
    if (malwareSectionRef.current && !malwareChartPrefetchedRef.current) {
      observer.observe(malwareSectionRef.current);
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

      const alertsParams = new URLSearchParams({ page: '1', pageSize: '1000' });
      if (severityFilter !== 'all') {
        alertsParams.set('severity', severityFilter);
      }
      if (sourceFilter !== 'all') {
        alertsParams.set('source', sourceFilter);
      }

      const settled = await Promise.allSettled([
        apiRequest<PaginatedAlertsResponse>(`/api/alerts?${alertsParams.toString()}`),
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
  }, [reloadToken, severityFilter, sourceFilter]);

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
    summarySourceOptions,
    sourceCountMap,
    sourceLabelMap,
    alertsToolbarTabs,
    filteredAlerts,
    alertsPageSize,
    totalAlerts,
    dashboardSourceCards,
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
    [alerts, dashboardTimeCutoff, departmentFilter, searchQuery, severityFilter, sourceFilter],
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
  const clamavTrendPoints = useMemo(() => dashboardData.clamav?.trend.dailyBuckets ?? [], [dashboardData.clamav]);
  const clamavTrendChartPoints = useMemo(
    () => clamavTrendPoints.slice(-8).map((point) => ({ label: point.date || 'Unknown', count: Number(point.count) || 0 })),
    [clamavTrendPoints],
  );
  const clamavTrendTotal = useMemo(
    () => clamavTrendChartPoints.reduce((sum, point) => sum + point.count, 0),
    [clamavTrendChartPoints],
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
  }, [chartDrilldown, filteredAlerts]);
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
    [chartDrilldownAlerts],
  );
  const timelineSelectionLabel = chartDrilldown?.kind === 'timeline' ? `Bucket ${chartDrilldown.label}` : undefined;
  const malwareSelectionLabel = chartDrilldown?.kind === 'malware' ? `Bucket ${chartDrilldown.label}` : undefined;
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

  const mainTabs = [
    { id: 'dashboard' as const, label: 'Dashboard', count: totalAlerts, icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'all-alerts' as const, label: 'All Alerts', count: filteredAlerts.length, icon: <Bell className="h-4 w-4" /> },
  ];

  const selectedSourceAlerts = sourceAlerts[selectedDashboardSource] ?? [];
  const selectedSourceDashboard = dashboardData[selectedDashboardSource] ?? null;

  const sourceDashboardCards = dashboardSourceCards.map((card) => {
    const dashboard = dashboardData[card.source as SourceKey];
    const moduleCard = dashboard?.moduleCards.find((entry) => normalizeSourceKey(entry.source) === card.source);
    const departmentCount = dashboard?.departments.length ?? 0;
    const affectedDepartmentCount = dashboard?.departments.filter((entry) => entry.errorCount > 0).length ?? 0;
    const scannedCount = moduleCard?.totalSystemsScanned ?? 0;
    const fixedRatePercent = scannedCount > 0 ? Math.round(((moduleCard?.cleanSystemsCount ?? 0) / scannedCount) * 100) : 0;
    const affectedDepartmentPercent = departmentCount > 0 ? Math.round((affectedDepartmentCount / departmentCount) * 100) : 0;
    const riskScore = Math.min(100, Math.round((card.issueCount * 8) + (card.alertCount * 4)));
    return {
      ...card,
      systemsAffected: dashboard?.systems.filter((system) => system.status === 'error').length ?? 0,
      healthStatus: moduleCard?.statusColor === 'red' ? 'Critical' : moduleCard?.statusColor === 'yellow' ? 'Warning' : 'Healthy',
      healthTone: moduleCard?.statusColor === 'red' ? 'critical' as const : moduleCard?.statusColor === 'yellow' ? 'warning' as const : 'healthy' as const,
      riskScore,
      sparklineValues: dashboard?.trend.dailyBuckets.map((bucket) => bucket.count) ?? [0, 0, 0, 0, 0],
      departmentCount,
      affectedDepartmentCount,
      affectedDepartmentPercent,
      fixedRatePercent,
    };
  });

  const openSourceAlerts = (source: SourceKey) => {
    setSelectedDashboardSource(source);
    setSourceWorkspaceView('department');
    setSourceWorkspaceDepartment('');
    setSourceWorkspaceSystemKey('');
    setChartDrilldown(null);
    setView('dashboard');
    setSourceDetailOpen(true);
  };

  const handleOpenSourceSystem = (system: { assetId: string }) => {
    if (!system.assetId) {
      return;
    }
    navigate(`${basePath}/devices/${system.assetId}`);
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
      dateLabel: label,
    });
    setView('all-alerts');
    setAlertsPage(1);
  };

  return (
    <div className={`min-h-screen overflow-hidden px-4 py-8 xl:px-6 alerts-page-root ${darkMode ? 'text-white bg-zinc-950' : 'text-zinc-900 bg-gradient-to-br from-blue-50 via-white to-cyan-50'}`}>
      <style>{`
        .alerts-page-root { color: #0F1B2D !important; }
        .alerts-page-root *, .alerts-page-root *::before, .alerts-page-root *::after { color: #0F1B2D !important; }
        .alerts-page-root .text-ink { color: #0F1B2D !important; }
        .alerts-page-root .text-muted { color: #8C96A4 !important; }
        .alerts-page-root .text-primary { color: #2667E8 !important; }
        .alerts-page-root .text-white { color: white !important; }
        .alerts-page-root .text-success { color: #30A46C !important; }
        .alerts-page-root .text-warning { color: #FFB224 !important; }
        .alerts-page-root .text-danger { color: #E5484D !important; }
        .alerts-page-root .bg-white { background-color: white !important; }
        
        @keyframes alerts-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="relative mx-auto max-w-[1600px] space-y-6 pb-10">
        <div className={`space-y-4 ${view === 'all-alerts' ? 'relative z-10' : 'sticky top-3 z-30'}`}>
          <div className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur-sm px-8 py-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Security Alerts</h1>
                  <p className="mt-1 text-sm text-zinc-600 font-medium">Monitor threats, compliance scans, and malware detections across your infrastructure.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={refreshData}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>

          <div>
            <AlertsMainTabs
              tabs={mainTabs}
              activeTab={view}
              onSelectTab={(value) => {
                const nextView = value as AlertsView;
                setView(nextView);
                if (nextView === 'dashboard') {
                  setSourceDetailOpen(false);
                }
              }}
            />
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur-sm p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Source Navigation</div>
                <div className="mt-1 text-sm text-zinc-600">Jump straight into Wazuh, OpenSCAP, or ClamAV without leaving the Alerts workspace.</div>
              </div>
              <div className="rounded-full border border-white/70 bg-[linear-gradient(135deg,_rgba(224,242,254,0.9)_0%,_rgba(255,255,255,0.7)_100%)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-sky-700 shadow-sm backdrop-blur-xl">Always visible</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SOURCE_KEYS.map((source) => {
                const config = SOURCE_CONFIG[source];
                const Icon = config.icon;
                const active = selectedDashboardSource === source && sourceDetailOpen;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => openSourceAlerts(source)}
                    className={sourceSubnavButtonClass(source, active)}
                  >
                    <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border backdrop-blur-xl ${sourceSubnavIconClass(source, active)}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-inherit">{config.label}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] backdrop-blur-lg ${sourceSubnavBadgeClass(source, active)}`}>{active ? 'Active' : 'Open'}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500 group-hover:text-sky-700">{config.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <main className="space-y-6">
          {view === 'dashboard' && !sourceDetailOpen ? (
            <div className={`space-y-6 ${fadeClass}`}>
              <AlertsDashboardSourceGrid
                cards={sourceDashboardCards}
                formatNumber={formatNumber}
                onOpenSource={(source) => openSourceAlerts(source as SourceKey)}
              />

              {chartDrilldown ? (
                <section className="rounded-[28px] border border-white/65 bg-[linear-gradient(135deg,_rgba(247,251,255,0.70)_0%,_rgba(255,255,255,0.55)_50%,_rgba(242,248,255,0.72)_100%)] p-5 shadow-[0_26px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                        Active Analyst Selection
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{chartDrilldown.detail}</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">The dashboard is highlighting the currently selected chart slice. Use this preview to inspect the matching scope before moving into the full queue.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setView('all-alerts')} className="rounded-full border border-white/75 bg-white/70 px-4 py-2 text-sm font-bold text-sky-700 shadow-sm backdrop-blur-xl transition hover:bg-white/90">
                        Open Queue
                      </button>
                      <button type="button" onClick={clearChartDrilldown} className="rounded-full border border-white/75 bg-white/70 px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm backdrop-blur-xl transition hover:bg-white/90">
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/75 bg-white/68 px-4 py-4 shadow-sm backdrop-blur-xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Matching alerts</div>
                        <div className="mt-2 text-3xl font-black text-zinc-950">{chartDrilldownTotalAlerts}</div>
                      </div>
                      <div className="rounded-2xl border border-white/75 bg-white/68 px-4 py-4 shadow-sm backdrop-blur-xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Open in slice</div>
                        <div className="mt-2 text-3xl font-black text-sky-700">{chartDrilldownOpenCount}</div>
                      </div>
                      <div className="rounded-2xl border border-white/75 bg-white/68 px-4 py-4 shadow-sm backdrop-blur-xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Critical or high</div>
                        <div className="mt-2 text-3xl font-black text-rose-700">{chartDrilldownCriticalCount}</div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/75 bg-white/68 p-4 shadow-sm backdrop-blur-xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Matching systems</div>
                        <div className="mt-3 space-y-2">
                          {chartDrilldownSystems.length === 0 ? (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">No systems matched the active selection.</div>
                          ) : (
                            chartDrilldownSystems.map((system) => (
                              <div key={system.key} className="rounded-xl border border-white/75 bg-white/55 px-3 py-3 backdrop-blur-lg">
                                <div className="text-sm font-semibold text-zinc-950">{system.label}</div>
                                <div className="mt-1 text-xs text-zinc-500">{system.sourceLabel}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/75 bg-white/68 p-4 shadow-sm backdrop-blur-xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Alert preview</div>
                        <div className="mt-3 space-y-2">
                          {chartDrilldownAlerts.slice(0, 3).map((alert) => (
                            <button key={alert.id} type="button" onClick={() => openAlertDetails(alert)} className="w-full rounded-xl border border-white/75 bg-white/55 px-3 py-3 text-left backdrop-blur-lg transition hover:bg-white/72">
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

              <div className="grid gap-6 xl:grid-cols-2">
                <SectionCard title="Threat Activity Timeline" highlighted={chartDrilldown?.kind === 'timeline'} highlightLabel={timelineSelectionLabel} sectionRef={(element) => {
                  timelineSectionRef.current = element;
                }}>
                  {threatTimelinePoints.length === 0 ? (
                    <EmptyState title="No timeline points in scope" detail="The activity timeline fills as alerts enter the selected time window." />
                  ) : (
                    <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#eef7ff_100%)] p-4 shadow-sm">
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
                <SectionCard title="Malware Detection Trends" highlighted={chartDrilldown?.kind === 'malware'} highlightLabel={malwareSelectionLabel} sectionRef={(element) => {
                  malwareSectionRef.current = element;
                }}>
                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fff6f7_100%)] px-4 py-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">ClamAV trendline</div>
                      <div className="mt-2 text-3xl font-black text-zinc-950">{clamavTrendTotal}</div>
                      <div className="mt-1 text-sm text-zinc-500">detections across visible daily buckets</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fff7f8_100%)] p-4 shadow-sm">
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
              </div>

            </div>
          ) : null}

          {view === 'dashboard' && sourceDetailOpen ? (
            <div className={`space-y-6 ${fadeClass}`}>
              <section className="rounded-[28px] border border-white/65 bg-[linear-gradient(135deg,_rgba(255,255,255,0.72)_0%,_rgba(245,249,255,0.55)_100%)] px-5 py-5 shadow-[0_26px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Source Detail View</div>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{SOURCE_CONFIG[selectedDashboardSource].label} alert details</h2>
                    <p className="mt-1 text-sm text-zinc-600">Department coverage, system owners, latest alert details, and direct system links for the selected source.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceDetailOpen(false);
                      setSourceWorkspaceView('department');
                      setSourceWorkspaceDepartment('');
                      setSourceWorkspaceSystemKey('');
                    }}
                    className="inline-flex items-center justify-center rounded-[16px] border border-white/75 bg-white/72 px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm backdrop-blur-xl transition hover:bg-white/90"
                  >
                    Back to source cards
                  </button>
                </div>
              </section>

              <AlertsSourceWorkspacePanel
                source={selectedDashboardSource}
                sourceLabel={SOURCE_CONFIG[selectedDashboardSource].label}
                alerts={selectedSourceAlerts}
                dashboard={selectedSourceDashboard}
                loading={dataLoading}
                error=""
                activeView={sourceWorkspaceView}
                selectedDepartment={sourceWorkspaceDepartment}
                selectedSystemKey={sourceWorkspaceSystemKey}
                onActiveViewChange={setSourceWorkspaceView}
                onSelectDepartment={setSourceWorkspaceDepartment}
                onSelectSystemKey={setSourceWorkspaceSystemKey}
                onSelectAlert={openAlertDetails}
                onOpenSystem={handleOpenSourceSystem}
                renderSourceIcon={alertsRenderSourceIcon}
                formatRelativeTime={formatRelativeTime}
              />
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
