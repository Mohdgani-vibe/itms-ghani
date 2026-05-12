import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  ClipboardCheck,
  Shield,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import EmbeddedConsoleModal, { type EmbeddedConsoleState } from '../components/EmbeddedConsoleModal';
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
import { useAlertsDetailWorkflow } from '../components/alerts/useAlertsDetailWorkflow';
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
import type { AlertsDashboardResponse, AlertsListRecord, EmbeddedConsoleNavigationState, InstallAgentConfig, PaginatedAlertsResponse } from '../components/alerts/types';
import { useAlertsDerivedState } from '../hooks/useAlertsDerivedState';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import type { BootstrapDeviceLike } from '../lib/bootstrap';
import type { SaltActionValue } from '../lib/salt';
import type { PatchRunReport } from '../lib/patchReports';

type AlertsView = 'dashboard' | 'wazuh' | 'openscap' | 'clamav' | 'all-alerts';
type SourceKey = 'wazuh' | 'openscap' | 'clamav';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  message: string;
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
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionTone?: 'default' | 'primary';
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
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
  const [alertsPage, setAlertsPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
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
  const [embeddedConsoleNavigation, setEmbeddedConsoleNavigation] = useState<EmbeddedConsoleNavigationState | null>(null);
  const [selectedAlertNavigationItems, setSelectedAlertNavigationItems] = useState<AlertsListRecord[]>([]);
  const [installConfig, setInstallConfig] = useState<InstallAgentConfig | null>(null);
  const [installConfigLoading, setInstallConfigLoading] = useState(false);
  const [selectedSaltAction, setSelectedSaltAction] = useState<SaltActionValue>('system-update');
  const [customSaltInput, setCustomSaltInput] = useState('');
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [sourceWorkspaceViews, setSourceWorkspaceViews] = useState<Record<SourceKey, AlertsSourceWorkspaceView>>(emptyDashboardMap<AlertsSourceWorkspaceView>('dashboard'));
  const [sourceWorkspaceDepartments, setSourceWorkspaceDepartments] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));
  const [sourceWorkspaceSystemKeys, setSourceWorkspaceSystemKeys] = useState<Record<SourceKey, string>>(emptyDashboardMap(''));

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
    setAlertsPage(1);
  }, [searchQuery, severityFilter, sourceFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setDataLoading(true);
      setAlertsError('');

      const settled = await Promise.allSettled([
        apiRequest<PaginatedAlertsResponse>('/api/alerts?paginate=1&page=1&page_size=200'),
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
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

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
    paginatedFilteredAlerts,
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

  const openAlertDetails = (alert: AlertsListRecord, navigationItems?: AlertsListRecord[]) => {
    setSelectedAlert(alert);
    setSelectedAlertNavigationItems(navigationItems && navigationItems.length ? navigationItems : [alert]);
    setDetailMessage(null);
  };

  const {
    handleOpenAsset,
    navigateEmbeddedConsole,
    handleStartTerminal,
    handleRunPatch,
    handleOpenAlertSaltConsole,
    selectedAlertSource,
    selectedAssetCanStartTerminal,
    selectedAssetCanOpenPatchConsole,
    selectedAssetCanRunPatch,
    selectedPatchActionLabel,
    terminalBlockedReason,
    patchBlockedReason,
  } = useAlertsDetailWorkflow({
    canResolve: canOperate,
    basePath,
    selectedAlert,
    selectedDevice,
    selectedDeviceLoading,
    selectedSaltAction,
    customSaltInput,
    navigableAlerts: selectedAlertNavigationItems,
    installConfig,
    installConfigLoading,
    embeddedConsoleNavigation,
    setSelectedAlert,
    setSelectedDevice,
    setEmbeddedConsole,
    setEmbeddedConsoleNavigation,
    setDetailMessage,
    setDetailActionLoading,
    setPatchReport,
    navigate,
    renderSystemName: systemName,
  });

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

  const mainTabs: Array<{ id: AlertsView; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'wazuh', label: 'Wazuh' },
    { id: 'openscap', label: 'OpenSCAP' },
    { id: 'clamav', label: 'ClamAV' },
    { id: 'all-alerts', label: 'All Alerts' },
  ];

  return (
    <div className="min-h-screen px-4 py-6 text-zinc-900 xl:px-6" style={{ backgroundColor: PAGE_BG }}>
      <style>{`
        @keyframes alerts-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <AlertsHeroSection
          feedLabel="Security Operations"
          totalAlerts={totalAlerts}
          openCount={openAlertsCount}
          acknowledgedCount={acknowledgedAlertsCount}
          resolvedCount={resolvedAlertsCount}
          sourceCountMap={sourceCountMap}
          moduleCards={moduleCards}
          sourceFilter=""
          readOnlyReview={!canOperate}
          onSelectSourceFilter={(value) => setView(value as AlertsView)}
          renderSourceIcon={alertsRenderSourceIcon}
        />

        <AlertsStatusStrip
          loading={dataLoading}
          alertsError={alertsError}
          hasAlertsData={Boolean(alertsData)}
          totalAlertsLabel={`${formatNumber(totalAlerts)} alerts visible across configured sources`}
          onRefresh={refreshData}
        />

        <AlertsMainTabs tabs={mainTabs} activeTab={view} onSelectTab={(value) => setView(value as AlertsView)} />

        <main className="space-y-6 overflow-y-auto">
          {view === 'dashboard' ? (
            <div className={`space-y-6 ${fadeClass}`}>
              <AlertsDashboardSourceGrid cards={dashboardSourceCards} formatNumber={formatNumber} onOpenSource={(source) => setView(source as AlertsView)} />

              <SectionCard title="Recent Alerts" actionLabel="All Alerts" onAction={() => setView('all-alerts')}>
                {recentAlerts.length === 0 ? (
                  <EmptyState title="No recent alerts" detail="Recent alerts appear here as new events are received." />
                ) : (
                  <AlertsRecentTable
                    alerts={recentAlerts}
                    onSelectAlert={openAlertDetails}
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

          {view === 'all-alerts' ? (
            <div className={`space-y-6 ${fadeClass}`}>
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
                  totalAlerts={filteredAlerts.length}
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
                  alerts={paginatedFilteredAlerts}
                  selectedAlertId={selectedAlert?.id}
                  readOnlyReview={!canOperate}
                  onSelectAlert={openAlertDetails}
                  totalAlerts={filteredAlerts.length}
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
        <div className="fixed inset-0 z-[60] bg-zinc-950/35" onClick={() => setSelectedAlert(null)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
              className="absolute right-5 top-5 z-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-5 py-5">
              <AlertsDetailPane
                selectedAlert={selectedAlert}
                selectedAlertSource={selectedAlertSource}
                readOnlyReview={!canOperate}
                canAcknowledge={canOperate}
                canResolve={canOperate}
                detailActionLoading={detailActionLoading}
                detailMessage={detailMessage}
                selectedAssetCanStartTerminal={selectedAssetCanStartTerminal}
                selectedAssetCanOpenPatchConsole={selectedAssetCanOpenPatchConsole}
                selectedAssetCanRunPatch={selectedAssetCanRunPatch}
                terminalBlockedReason={terminalBlockedReason}
                patchBlockedReason={patchBlockedReason}
                selectedSaltAction={selectedSaltAction}
                customSaltInput={customSaltInput}
                selectedPatchActionLabel={selectedPatchActionLabel}
                relatedAlerts={relatedAlerts}
                relatedAlertsLoading={false}
                onOpenAsset={handleOpenAsset}
                onStartTerminal={() => void handleStartTerminal()}
                onOpenSaltConsole={() => void handleOpenAlertSaltConsole()}
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
                onRunPatch={() => void handleRunPatch()}
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

      <EmbeddedConsoleModal
        consoleState={embeddedConsole}
        titleId="alerts-console-title"
        navigation={embeddedConsoleNavigation && embeddedConsoleNavigation.items.length > 1 ? {
          index: embeddedConsoleNavigation.index,
          total: embeddedConsoleNavigation.items.length,
          onPrevious: () => void navigateEmbeddedConsole(-1),
          onNext: () => void navigateEmbeddedConsole(1),
        } : null}
        onClose={() => {
          setEmbeddedConsole(null);
          setEmbeddedConsoleNavigation(null);
        }}
      />
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
