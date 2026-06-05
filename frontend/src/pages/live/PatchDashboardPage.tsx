import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, Search, FolderOpen, Funnel, Download, TerminalSquare, FileText, Play, Wrench } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmbeddedConsoleModal, { type EmbeddedConsoleState } from '../../components/EmbeddedConsoleModal';
import { buildEmbeddedSaltConsoleState } from '../../components/embeddedConsoleModalUtils';
import PatchRunReportModal from '../../components/PatchRunReportModal';
import { resolveSaltTarget, type BootstrapDeviceLike } from '../../lib/bootstrap';
import { downloadPatchRunReportCsv, downloadPatchRunReportPdf, filterPatchRunReports, listPatchReportDepartments, normalizePatchRunReport, sortPatchRunReports, type PatchRunReport, type PatchRunReportDateRange, type PatchRunReportSort, type PatchRunReportSummary } from '../../lib/patchReports';
import { buildSaltActionConsolePrefill } from '../../lib/salt';
import { getStoredSession } from '../../lib/session';
import { createEmptyTemplateDraft, loadAuthoredSaltTemplates, saveAuthoredSaltTemplates, type AuthoredSaltTemplate, type AuthoredTemplateDraft } from '../../lib/saltTemplates';
import { buildPatchDashboardActivityWindows, buildPatchMetrics, isDeviceOnline, formatReportTimestamp, renderPackageChangeSummary, selectRecentCompletedPatchReports, shouldShowReportRowMessage, getFeaturedReportTone, type PatchDevice, type PatchWorkspaceView } from './PatchDashboardPage.helpers';
import { areDepartmentSelectionsEqual, buildPatchWorkspaceSearch, parsePatchWorkspaceRouteState, shouldResetOpeningReportId } from './patchDashboardState';

type PatchLogsStatusFilter = 'all' | 'success' | 'failed' | 'queued';

function normalizeLogStatus(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'success') {
    return 'success';
  }
  if (normalized === 'failed' || normalized === 'no_response') {
    return 'failed';
  }
  if (normalized === 'queued' || normalized === 'running' || normalized === 'pending') {
    return 'queued';
  }
  return 'unknown';
}

function buildFunctionPreview(functionName: string, argumentLine: string) {
  const trimmedFunction = functionName.trim();
  const trimmedArguments = argumentLine.trim();
  if (!trimmedFunction) {
    return '';
  }
  return trimmedArguments ? `${trimmedFunction} ${trimmedArguments}` : trimmedFunction;
}

function formatSelectedDepartmentScope(selectedDepartments: string[]) {
  if (selectedDepartments.length === 0) {
    return 'All departments';
  }
  if (selectedDepartments.length === 1) {
    return selectedDepartments[0];
  }
  return `${selectedDepartments.length} departments`;
}

function formatTerminalTargetModeLabel(value: 'single' | 'multiple' | 'department' | 'all') {
  switch (value) {
    case 'single':
      return 'Single system';
    case 'multiple':
      return 'Multiple systems';
    case 'department':
      return 'Department';
    case 'all':
      return 'All systems';
    default:
      return 'Single system';
  }
}

function getLogsRecentItemsTone(limit: number) {
  if (limit >= 50) {
    return {
      labelClassName: 'text-rose-50',
      selectClassName: 'border-rose-200/70 bg-rose-50 text-rose-950',
    };
  }
  if (limit >= 25) {
    return {
      labelClassName: 'text-amber-50',
      selectClassName: 'border-amber-200/70 bg-amber-50 text-amber-950',
    };
  }
  if (limit <= 5) {
    return {
      labelClassName: 'text-emerald-50',
      selectClassName: 'border-emerald-200/70 bg-emerald-50 text-emerald-950',
    };
  }
  return {
    labelClassName: 'text-sky-50',
    selectClassName: 'border-sky-200/70 bg-sky-50 text-sky-950',
  };
}

function getLogsStatusTone(value: PatchLogsStatusFilter) {
  switch (value) {
    case 'success':
      return {
        labelClassName: 'text-emerald-50',
        selectClassName: 'border-emerald-200/70 bg-emerald-50 text-emerald-950',
      };
    case 'failed':
      return {
        labelClassName: 'text-rose-50',
        selectClassName: 'border-rose-200/70 bg-rose-50 text-rose-950',
      };
    case 'queued':
      return {
        labelClassName: 'text-amber-50',
        selectClassName: 'border-amber-200/70 bg-amber-50 text-amber-950',
      };
    default:
      return {
        labelClassName: 'text-sky-50',
        selectClassName: 'border-sky-200/70 bg-sky-50 text-sky-950',
      };
  }
}

function summarizePackageChanges(rows: SaltWorkspaceExecutionRow[]) {
  const summary = new Map<string, { name: string; currentVersion: string; newVersion: string; systemsAffected: number }>();

  rows.forEach((row) => {
    row.packageChanges.forEach((change) => {
      const current = summary.get(change.name) || {
        name: change.name,
        currentVersion: change.fromVersion || '-',
        newVersion: change.toVersion || '-',
        systemsAffected: 0,
      };
      current.systemsAffected += 1;
      if (current.currentVersion === '-' && change.fromVersion) {
        current.currentVersion = change.fromVersion;
      }
      if (current.newVersion === '-' && change.toVersion) {
        current.newVersion = change.toVersion;
      }
      summary.set(change.name, current);
    });
  });

  return Array.from(summary.values()).sort((left, right) => {
    if (right.systemsAffected !== left.systemsAffected) {
      return right.systemsAffected - left.systemsAffected;
    }
    return left.name.localeCompare(right.name);
  });
}

function parseSaltTerminalArguments(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function reportMatchesDepartmentScope(report: PatchRunReportSummary, selectedDepartments: string[]) {
  if (selectedDepartments.length === 0) {
    return true;
  }

  return (report.departments || []).some((department) => selectedDepartments.includes(department));
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserMetaOptionsResponse {
  departments: LookupOption[];
}

interface PatchSaltJobHistoryRecord {
  id: string;
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount: number;
  failedCount: number;
  rowCount: number;
  requestedBy?: string | null;
}

interface PatchSaltRecentExecutionRecord {
  id: string;
  jid?: string;
  scope?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

interface PatchSaltWorkspaceHistoryResponse {
  jobHistory: PatchSaltJobHistoryRecord[];
  recentExecutions?: PatchSaltRecentExecutionRecord[];
  slsFiles?: string[];
}

interface SaltWorkspaceExecutionRow {
  deviceId: string;
  hostname: string;
  department: string;
  minionId?: string;
  osType?: string;
  status: string;
  patchStatus: string;
  target: string;
  action: string;
  message: string;
  updatedItems: string[];
  packageChanges: Array<{ name: string; fromVersion?: string | null; toVersion?: string | null }>;
  alreadyLatest?: string[];
  failedPackages?: string[];
  rebootRequired?: boolean;
  startTime?: string;
  durationSeconds?: number;
  rawResult?: unknown;
}

interface SaltWorkspaceExecutionLog {
  minionId?: string;
  hostname?: string;
  function?: string;
  stateName?: string;
  status?: string;
  packages?: Array<{ name: string; fromVersion?: string | null; toVersion?: string | null }>;
  startedAt?: string;
  durationMs?: number;
  error?: string | null;
  message?: string;
  rawResult?: unknown;
  department?: string;
}

interface SaltWorkspaceExecutionResponse {
  scopeLabel: string;
  requestedAt: string;
  completedAt: string;
  successCount?: number;
  failedCount?: number;
  rows?: SaltWorkspaceExecutionRow[];
  logs?: SaltWorkspaceExecutionLog[];
  stdout?: string;
  raw?: unknown;
}

interface SaltWorkspaceTemplatesApiResponse {
  templates?: AuthoredSaltTemplate[];
  updatedAt?: string;
}

interface PatchDeviceConsoleDetails {
  id: string;
  assetId?: string | null;
  hostname: string;
  osName?: string | null;
  saltMinionId?: string | null;
  user?: {
    id?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  toolStatus?: {
    salt?: {
      identifier?: string | null;
    };
  };
}

type EmbeddedConsoleNavigationState = {
  kind: 'device';
  index: number;
  items: PatchDevice[];
  prefilledCommand?: string;
};

const DEFAULT_RECENT_PATCH_DETAILS_LIMIT = 10;
const RECENT_PATCH_DETAILS_LIMIT_OPTIONS = [5, 10, 25, 50] as const;
const DASHBOARD_RECENT_PATCH_LIMIT = 10;

export default function PatchDashboardPage() {
  const reportInteractionBlockUntilRef = useRef(0);
  const reportInteractionShieldTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const session = getStoredSession();
  const canOperate = ['super_admin', 'it_team'].includes((session?.user.role || '').toLowerCase());
  const canViewReports = canOperate;
  const initialRouteState = parsePatchWorkspaceRouteState(location.search, canViewReports);
  const [activeSubView, setActiveSubView] = useState<PatchWorkspaceView>(() => {
    return initialRouteState.activeSubView;
  });
  const [devices, setDevices] = useState<PatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() => initialRouteState.selectedDepartments);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [embeddedConsoleNavigation, setEmbeddedConsoleNavigation] = useState<EmbeddedConsoleNavigationState | null>(null);
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [recentReports, setRecentReports] = useState<PatchRunReportSummary[]>([]);
  const [openingReportId, setOpeningReportId] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState('');
  const [downloadingReportPdfId, setDownloadingReportPdfId] = useState('');
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState(() => initialRouteState.reportDepartmentFilter);
  const [reportDateRange, setReportDateRange] = useState<PatchRunReportDateRange>(() => initialRouteState.reportDateRange);
  const [reportSearchQuery, setReportSearchQuery] = useState(() => initialRouteState.reportSearchQuery);
  const [reportSort, setReportSort] = useState<PatchRunReportSort>(() => initialRouteState.reportSort);
  const [showAllReports, setShowAllReports] = useState(() => initialRouteState.showAllReports);
  const [recentDetailsLimit, setRecentDetailsLimit] = useState(DEFAULT_RECENT_PATCH_DETAILS_LIMIT);
  const [departmentSelectionMode, setDepartmentSelectionMode] = useState<'single' | 'multiple'>(() => (initialRouteState.selectedDepartments.length > 1 ? 'multiple' : 'single'));
  const [featuredReport, setFeaturedReport] = useState<PatchRunReport | null>(null);
  const [featuredReportLoading, setFeaturedReportLoading] = useState(false);
  const [reportInteractionShieldVisible, setReportInteractionShieldVisible] = useState(false);
  const [saltJobHistory, setSaltJobHistory] = useState<PatchSaltJobHistoryRecord[]>([]);
  const [recentExecutionHistory, setRecentExecutionHistory] = useState<PatchSaltRecentExecutionRecord[]>([]);
  const [availableSlsFiles, setAvailableSlsFiles] = useState<string[]>([]);
  const [authoredTemplates, setAuthoredTemplates] = useState<AuthoredSaltTemplate[]>(() => loadAuthoredSaltTemplates());
  const [automationDraft, setAutomationDraft] = useState<AuthoredTemplateDraft>(() => createEmptyTemplateDraft('sls'));
  const [automationEditingTemplateId, setAutomationEditingTemplateId] = useState('');
  const [automationPendingDeleteTemplateId, setAutomationPendingDeleteTemplateId] = useState('');
  const [automationDeletingTemplateId, setAutomationDeletingTemplateId] = useState('');
  const [automationMessage, setAutomationMessage] = useState('');
  const [automationError, setAutomationError] = useState('');
  const terminalClient: 'local' | 'runner' | 'wheel' = 'local';
  const [terminalTargetMode, setTerminalTargetMode] = useState<'single' | 'multiple' | 'department' | 'all'>('single');
  const [terminalTargetsValue, setTerminalTargetsValue] = useState('');
  const [terminalDepartmentValue, setTerminalDepartmentValue] = useState('');
  const [terminalFunctionValue, setTerminalFunctionValue] = useState('state.apply');
  const [terminalSelectedSls, setTerminalSelectedSls] = useState('');
  const [terminalSelectedShellTemplateId, setTerminalSelectedShellTemplateId] = useState('');
  const [terminalManualCommandValue, setTerminalManualCommandValue] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalExecutionLogs, setTerminalExecutionLogs] = useState<SaltWorkspaceExecutionLog[]>([]);
  const [latestExecutionRows, setLatestExecutionRows] = useState<SaltWorkspaceExecutionRow[]>([]);
  const [terminalPreviewTab, setTerminalPreviewTab] = useState<'output' | 'summary' | 'changes' | 'unchanged' | 'errors'>('output');
  const [executingTerminal, setExecutingTerminal] = useState(false);
  const terminalTestMode = false;
  const [logsStatusFilter, setLogsStatusFilter] = useState<PatchLogsStatusFilter>('all');
  const embeddedConsoleCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const reportFetchLimit = showAllReports ? Math.max(50, recentDetailsLimit) : recentDetailsLimit;

  useEffect(() => {
    if (!embeddedConsole) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmbeddedConsole(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    embeddedConsoleCloseButtonRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [embeddedConsole]);

  useEffect(() => () => {
    if (reportInteractionShieldTimeoutRef.current !== null) {
      window.clearTimeout(reportInteractionShieldTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        setSuccessMessage('');

        const devicesData = await apiRequest<PatchDevice[]>('/api/patch/devices');

        if (!cancelled) {
          setDevices(devicesData || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load patch dashboard');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      try {
        const meta = await apiRequest<UserMetaOptionsResponse>('/api/users/meta/options');
        let reportData: PatchRunReportSummary[] = [];
        let jobHistoryData: PatchSaltJobHistoryRecord[] = [];
        if (canViewReports) {
          reportData = await apiRequest<PatchRunReportSummary[]>(`/api/patch/reports?limit=${reportFetchLimit}`);
          const saltWorkspace = await apiRequest<PatchSaltWorkspaceHistoryResponse>(`/api/salt/workspace?limit=${recentDetailsLimit}`);
          jobHistoryData = saltWorkspace.jobHistory || [];
          if (!cancelled) {
            setRecentExecutionHistory(saltWorkspace.recentExecutions || []);
            setAvailableSlsFiles(saltWorkspace.slsFiles || []);
          }
          try {
            const templatesResponse = await apiRequest<SaltWorkspaceTemplatesApiResponse>('/api/salt/workspace/templates');
            let syncedTemplates = templatesResponse.templates || [];
            const cachedTemplates = loadAuthoredSaltTemplates();
            if (syncedTemplates.length === 0 && cachedTemplates.length > 0) {
              const migrationResponse = await apiRequest<SaltWorkspaceTemplatesApiResponse>('/api/salt/workspace/templates', {
                method: 'PUT',
                body: JSON.stringify({ templates: cachedTemplates }),
              });
              syncedTemplates = migrationResponse.templates || cachedTemplates;
            }
            if (!cancelled) {
              setAuthoredTemplates(syncedTemplates);
              saveAuthoredSaltTemplates(syncedTemplates);
            }
          } catch {
            if (!cancelled) {
              setAuthoredTemplates(loadAuthoredSaltTemplates());
            }
          }
        }
        if (!cancelled) {
          setDepartments(['all', ...Array.from(new Set((meta.departments || []).map((department) => department.name).filter(Boolean))).sort()]);
          setRecentReports(reportData || []);
          setSaltJobHistory(jobHistoryData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load patch dashboard metadata');
        }
      }
    };

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [canViewReports, recentDetailsLimit, reportFetchLimit]);

  const selectableDepartments = useMemo(() => departments.filter((department) => department !== 'all'), [departments]);

  const visibleDevices = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return devices;
    }

    return devices.filter((device) => selectedDepartments.includes(device.department?.name?.trim() || 'Unassigned'));
  }, [devices, selectedDepartments]);
  useEffect(() => {
    if (departmentSelectionMode === 'single') {
      const nextDepartment = selectedDepartments[0] || '';
      if (terminalTargetMode !== 'department') {
        setTerminalTargetMode('department');
      }
      if (terminalDepartmentValue !== nextDepartment) {
        setTerminalDepartmentValue(nextDepartment);
      }
      if (terminalTargetsValue !== '') {
        setTerminalTargetsValue('');
      }
      return;
    }

    const nextTargets = selectedDepartments.length > 0
      ? visibleDevices.map((device) => device.hostname.trim()).filter(Boolean).join(', ')
      : '';
    if (terminalTargetMode !== 'multiple') {
      setTerminalTargetMode('multiple');
    }
    if (terminalDepartmentValue !== '') {
      setTerminalDepartmentValue('');
    }
    if (terminalTargetsValue !== nextTargets) {
      setTerminalTargetsValue(nextTargets);
    }
  }, [departmentSelectionMode, selectedDepartments, terminalDepartmentValue, terminalTargetMode, terminalTargetsValue, visibleDevices]);
  const scopedMetrics = useMemo(() => buildPatchMetrics(visibleDevices), [visibleDevices]);
  const selectedDepartmentLabel = useMemo(() => formatSelectedDepartmentScope(selectedDepartments), [selectedDepartments]);
  const reportDepartmentOptions = useMemo(() => listPatchReportDepartments(recentReports), [recentReports]);
  const filteredRecentReports = useMemo(() => filterPatchRunReports(recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery), [recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery]);
  const sortedRecentReports = useMemo(() => sortPatchRunReports(filteredRecentReports, reportSort), [filteredRecentReports, reportSort]);
  const visibleRecentReports = useMemo(() => showAllReports ? sortedRecentReports : sortedRecentReports.slice(0, recentDetailsLimit), [recentDetailsLimit, sortedRecentReports, showAllReports]);
  const visibleSaltJobHistory = useMemo(() => saltJobHistory.slice(0, recentDetailsLimit), [recentDetailsLimit, saltJobHistory]);
  const visibleTerminalExecutionLogs = useMemo(() => terminalExecutionLogs.slice(0, recentDetailsLimit), [recentDetailsLimit, terminalExecutionLogs]);
  const visibleRecentExecutionHistory = useMemo(() => recentExecutionHistory.slice(0, recentDetailsLimit), [recentDetailsLimit, recentExecutionHistory]);
  const filteredTerminalExecutionLogs = useMemo(() => {
    if (logsStatusFilter === 'all') {
      return visibleTerminalExecutionLogs;
    }
    return visibleTerminalExecutionLogs.filter((entry) => normalizeLogStatus(entry.status) === logsStatusFilter);
  }, [logsStatusFilter, visibleTerminalExecutionLogs]);
  const filteredRecentExecutionHistory = useMemo(() => {
    if (logsStatusFilter === 'all') {
      return visibleRecentExecutionHistory;
    }
    return visibleRecentExecutionHistory.filter((entry) => normalizeLogStatus(entry.status) === logsStatusFilter);
  }, [logsStatusFilter, visibleRecentExecutionHistory]);
  const filteredLogsMatchCount = filteredTerminalExecutionLogs.length + filteredRecentExecutionHistory.length;
  const logsRecentItemsTone = useMemo(() => getLogsRecentItemsTone(recentDetailsLimit), [recentDetailsLimit]);
  const logsStatusTone = useMemo(() => getLogsStatusTone(logsStatusFilter), [logsStatusFilter]);
  const totalReportsCount = useMemo(() => recentReports.length, [recentReports]);
  const filteredFailedReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount > 0).length, [filteredRecentReports]);
  const filteredSuccessfulReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount === 0).length, [filteredRecentReports]);
  const filteredReportDepartmentsCount = useMemo(() => new Set(filteredRecentReports.flatMap((report) => report.departments || [])).size, [filteredRecentReports]);
  const onlineSystemsCount = useMemo(() => visibleDevices.filter((device) => isDeviceOnline(device)).length, [visibleDevices]);
  const offlineSystemsCount = useMemo(() => visibleDevices.length - onlineSystemsCount, [visibleDevices.length, onlineSystemsCount]);
  const terminalHistoryCount = useMemo(() => saltJobHistory.length, [saltJobHistory.length]);
  const terminalWorkspaceCount = useMemo(() => totalReportsCount + terminalHistoryCount, [terminalHistoryCount, totalReportsCount]);
  const automationTemplates = useMemo(
    () => [...authoredTemplates].sort((left, right) => Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')),
    [authoredTemplates],
  );
  const automationPendingDeleteTemplate = useMemo(
    () => automationTemplates.find((template) => template.id === automationPendingDeleteTemplateId) || null,
    [automationPendingDeleteTemplateId, automationTemplates],
  );
  const savedShellTemplates = useMemo(() => authoredTemplates.filter((template) => template.kind === 'shell'), [authoredTemplates]);
  const selectedShellTemplate = useMemo(
    () => savedShellTemplates.find((template) => template.id === terminalSelectedShellTemplateId) || savedShellTemplates[0] || null,
    [savedShellTemplates, terminalSelectedShellTemplateId],
  );
  const terminalOptionArgumentLabel = useMemo(() => {
    if (terminalFunctionValue === 'state.apply') {
      return terminalSelectedSls.trim();
    }
    if (terminalFunctionValue === 'cmd.script') {
      return selectedShellTemplate?.name?.trim() || '';
    }
    if (terminalFunctionValue === 'cmd.run') {
      return terminalManualCommandValue.trim();
    }
    return '';
  }, [selectedShellTemplate?.name, terminalFunctionValue, terminalManualCommandValue, terminalSelectedSls]);
  const terminalExecutionArgumentsList = useMemo(() => {
    if (terminalFunctionValue === 'state.apply') {
      return terminalSelectedSls.trim() ? [terminalSelectedSls.trim()] : [];
    }
    if (terminalFunctionValue === 'cmd.script') {
      return selectedShellTemplate?.content.trim() ? [selectedShellTemplate.content.trim()] : [];
    }
    if (terminalFunctionValue === 'cmd.run') {
      return terminalManualCommandValue.trim() ? [terminalManualCommandValue.trim()] : [];
    }
    return [] as string[];
  }, [selectedShellTemplate?.content, terminalFunctionValue, terminalManualCommandValue, terminalSelectedSls]);
  const terminalSelectedTargets = useMemo(() => {
    if (terminalClient !== 'local') {
      return 1;
    }
    switch (terminalTargetMode) {
      case 'multiple':
        return parseSaltTerminalArguments(terminalTargetsValue).length;
      case 'department':
        return visibleDevices.filter((device) => (device.department?.name?.trim() || 'Unassigned') === terminalDepartmentValue.trim()).length;
      case 'all':
        return visibleDevices.length;
      default:
        return 0;
    }
  }, [terminalClient, terminalDepartmentValue, terminalTargetMode, terminalTargetsValue, visibleDevices]);
  const terminalPackagePreviewRows = useMemo(() => summarizePackageChanges(latestExecutionRows).slice(0, 5), [latestExecutionRows]);
  const terminalPackagesToUpdateCount = useMemo(() => terminalPackagePreviewRows.reduce((sum, row) => sum + row.systemsAffected, 0), [terminalPackagePreviewRows]);
  const terminalSuccessfulRowsCount = useMemo(() => latestExecutionRows.filter((row) => row.status === 'success').length, [latestExecutionRows]);
  const terminalFailedRowsCount = useMemo(() => latestExecutionRows.filter((row) => row.status !== 'success').length, [latestExecutionRows]);
  const terminalAlreadyLatestCount = useMemo(() => latestExecutionRows.reduce((sum, row) => sum + (row.alreadyLatest?.length || 0), 0), [latestExecutionRows]);
  const terminalFailedPackageCount = useMemo(() => latestExecutionRows.reduce((sum, row) => sum + (row.failedPackages?.length || 0), 0), [latestExecutionRows]);
  const terminalPreviewGeneratedAt = useMemo(() => latestExecutionRows[0]?.startTime || new Date().toISOString(), [latestExecutionRows]);
  const terminalPreviewRequestedBy = useMemo(() => session?.user.fullName || session?.shortName || 'IT automation', [session?.shortName, session?.user.fullName]);
  const terminalSummaryText = useMemo(() => {
    if (latestExecutionRows.length === 0) {
      return [
        `Scope: ${selectedDepartmentLabel}`,
        `Function: ${terminalFunctionValue}`,
        `Option: ${terminalOptionArgumentLabel || 'None'}`,
        `Targets: ${terminalSelectedTargets || 0}`,
      ].join('\n');
    }

    return [
      `Scope label: ${terminalTargetMode === 'all' ? 'All systems' : terminalTargetMode === 'department' ? (terminalDepartmentValue.trim() || 'Department') : terminalTargetMode === 'multiple' ? `${parseSaltTerminalArguments(terminalTargetsValue).length || 0} selected systems` : 'Department scope'}`,
      `Successful systems: ${terminalSuccessfulRowsCount}`,
      `Systems needing review: ${terminalFailedRowsCount}`,
      `Packages changed: ${terminalPackagesToUpdateCount}`,
      `Packages already current: ${terminalAlreadyLatestCount}`,
      `Packages failed: ${terminalFailedPackageCount}`,
    ].join('\n');
  }, [latestExecutionRows.length, selectedDepartmentLabel, terminalAlreadyLatestCount, terminalDepartmentValue, terminalFailedPackageCount, terminalFailedRowsCount, terminalFunctionValue, terminalOptionArgumentLabel, terminalPackagesToUpdateCount, terminalSelectedTargets, terminalSuccessfulRowsCount, terminalTargetMode, terminalTargetsValue]);
  const terminalChangesText = useMemo(() => {
    if (terminalPackagePreviewRows.length === 0) {
      return 'No package changes captured yet. Run a dry-run state.apply or patch action to populate this preview.';
    }
    return terminalPackagePreviewRows.map((item) => `${item.name}: ${item.currentVersion} -> ${item.newVersion} across ${item.systemsAffected} system(s)`).join('\n');
  }, [terminalPackagePreviewRows]);
  const terminalUnchangedText = useMemo(() => {
    const names = latestExecutionRows.flatMap((row) => row.alreadyLatest || []);
    if (names.length === 0) {
      return 'No unchanged packages were reported in the latest preview.';
    }
    return names.join('\n');
  }, [latestExecutionRows]);
  const terminalErrorsText = useMemo(() => {
    const errors = latestExecutionRows.flatMap((row) => row.failedPackages || []).concat(terminalExecutionLogs.map((entry) => entry.error || '').filter(Boolean));
    if (errors.length === 0) {
      return 'No errors reported.';
    }
    return errors.join('\n');
  }, [latestExecutionRows, terminalExecutionLogs]);
  const terminalPreviewOutput = useMemo(() => {
    if (terminalPreviewTab === 'summary') {
      return terminalSummaryText;
    }
    if (terminalPreviewTab === 'changes') {
      return terminalChangesText;
    }
    if (terminalPreviewTab === 'unchanged') {
      return terminalUnchangedText;
    }
    if (terminalPreviewTab === 'errors') {
      return terminalErrorsText;
    }
    return terminalOutput || 'Dry-run output appears here after you preview a Salt execution.';
  }, [terminalChangesText, terminalErrorsText, terminalOutput, terminalPreviewTab, terminalSummaryText, terminalUnchangedText]);
  const featuredReportSummary = useMemo(() => {
    const scopedReports = sortPatchRunReports(recentReports.filter((report) => reportMatchesDepartmentScope(report, selectedDepartments)), 'newest');
    return scopedReports[0] || sortPatchRunReports(recentReports, 'newest')[0] || null;
  }, [recentReports, selectedDepartments]);
  const scopedDashboardReports = useMemo(() => sortPatchRunReports(recentReports.filter((report) => reportMatchesDepartmentScope(report, selectedDepartments)), 'newest'), [recentReports, selectedDepartments]);
  const dashboardActivityWindows = useMemo(() => buildPatchDashboardActivityWindows(scopedDashboardReports), [scopedDashboardReports]);
  const dashboardRecentReports = useMemo(() => selectRecentCompletedPatchReports(scopedDashboardReports, DASHBOARD_RECENT_PATCH_LIMIT), [scopedDashboardReports]);
  const dashboardMaxUpdatedSystems = useMemo(() => Math.max(1, ...dashboardActivityWindows.map((item) => item.systemsUpdated)), [dashboardActivityWindows]);
  const featuredReportRows = useMemo(() => {
    const normalized = normalizePatchRunReport(featuredReport);
    if (!normalized) {
      return [] as PatchRunReport['rows'];
    }
    const updatedRows = normalized.rows.filter((row) => row.updatedItems.length > 0);
    if (updatedRows.length > 0) {
      return updatedRows.slice(0, 3);
    }
    return normalized.rows.slice(0, 3);
  }, [featuredReport]);

  const syncRouteStateFromSearch = useEffectEvent((search: string) => {
    const requestedRouteState = parsePatchWorkspaceRouteState(search, canViewReports);

    if (activeSubView !== requestedRouteState.activeSubView) {
      setActiveSubView(requestedRouteState.activeSubView as PatchWorkspaceView);
    }

    if (!areDepartmentSelectionsEqual(selectedDepartments, requestedRouteState.selectedDepartments)) {
      setSelectedDepartments(requestedRouteState.selectedDepartments);
    }

    if (reportDepartmentFilter !== requestedRouteState.reportDepartmentFilter) {
      setReportDepartmentFilter(requestedRouteState.reportDepartmentFilter);
    }

    if (reportDateRange !== requestedRouteState.reportDateRange) {
      setReportDateRange(requestedRouteState.reportDateRange);
    }

    if (reportSearchQuery !== requestedRouteState.reportSearchQuery) {
      setReportSearchQuery(requestedRouteState.reportSearchQuery);
    }

    if (reportSort !== requestedRouteState.reportSort) {
      setReportSort(requestedRouteState.reportSort);
    }

    if (showAllReports !== requestedRouteState.showAllReports) {
      setShowAllReports(requestedRouteState.showAllReports);
    }
  });

  useEffect(() => {
    syncRouteStateFromSearch(location.search);
  }, [canViewReports, location.search]);

  useEffect(() => {
    const requestedReportId = new URLSearchParams(location.search).get('reportId')?.trim();
    if (shouldResetOpeningReportId(openingReportId, patchReport, requestedReportId)) {
      setOpeningReportId('');
    }
  }, [location.search, openingReportId, patchReport]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedReportId = params.get('reportId')?.trim();

    const nextSearch = buildPatchWorkspaceSearch({
		activeSubView,
		canViewReports,
		selectedDepartments,
		reportDepartmentFilter,
		reportDateRange,
		reportSearchQuery,
		reportSort,
		showAllReports,
		reportId: patchReport?.id || requestedReportId || '',
	});
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      void navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
    }
  }, [activeSubView, canViewReports, location.pathname, location.search, navigate, patchReport?.id, reportDateRange, reportDepartmentFilter, reportSearchQuery, reportSort, selectedDepartments, showAllReports]);

  useEffect(() => {
    let cancelled = false;
    const requestedReportId = new URLSearchParams(location.search).get('reportId')?.trim();
    if (!requestedReportId || !canViewReports || patchReport?.id === requestedReportId) {
      return;
    }

    const loadRequestedReport = async () => {
      try {
        setOpeningReportId(requestedReportId);
        setError('');
        const report = await apiRequest<PatchRunReport>(`/api/patch/reports/${requestedReportId}`);
        if (!cancelled) {
          setPatchReport(report);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to open patch report');
        }
      } finally {
        if (!cancelled) {
          setOpeningReportId('');
        }
      }
    };

    void loadRequestedReport();

    return () => {
      cancelled = true;
    };
  }, [canViewReports, location.search, patchReport?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadFeaturedReport = async () => {
      if (!canViewReports || !featuredReportSummary?.id) {
        setFeaturedReport(null);
        setFeaturedReportLoading(false);
        return;
      }

      try {
        setFeaturedReportLoading(true);
        const report = await apiRequest<PatchRunReport>(`/api/patch/reports/${featuredReportSummary.id}`);
        if (!cancelled) {
          setFeaturedReport(normalizePatchRunReport(report));
        }
      } catch {
        if (!cancelled) {
          setFeaturedReport(null);
        }
      } finally {
        if (!cancelled) {
          setFeaturedReportLoading(false);
        }
      }
    };

    void loadFeaturedReport();

    return () => {
      cancelled = true;
    };
  }, [canViewReports, featuredReportSummary?.id]);

  const openSaltConsole = async (device: PatchDevice, prefilledCommand?: string) => {
    if (!canOperate) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      const detail = await apiRequest<PatchDeviceConsoleDetails>(`/api/devices/${device.id}`);
      const minionId = resolveSaltTarget(detail as BootstrapDeviceLike);
      if (!minionId) {
        setError('Salt console is unavailable until this asset reports a Salt minion ID.');
        return;
      }

      setEmbeddedConsole(buildEmbeddedSaltConsoleState({
        title: 'Salt Console',
        systemLabel: detail.hostname || device.hostname,
        assetId: device.id,
        minionId,
        departmentName: device.department?.name,
        prefillCommand: prefilledCommand || buildSaltActionConsolePrefill('system-update', '', detail.osName || device.osName),
      }));
      setSuccessMessage(`Salt console opened for ${detail.hostname || device.hostname}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to open Salt console');
    }
  };

  const openSaltConsoleWithNavigation = async (items: PatchDevice[], index: number, prefilledCommand?: string) => {
    const target = items[index];
    if (!target) {
      return;
    }

    setEmbeddedConsoleNavigation({ kind: 'device', items, index, prefilledCommand });
    await openSaltConsole(target, prefilledCommand);
  };
  const navigateEmbeddedConsole = async (offset: number) => {
    if (!embeddedConsoleNavigation) {
      return;
    }

    const nextIndex = embeddedConsoleNavigation.index + offset;
    if (nextIndex < 0 || nextIndex >= embeddedConsoleNavigation.items.length) {
      return;
    }

    if (embeddedConsoleNavigation.kind === 'device') {
      await openSaltConsoleWithNavigation(embeddedConsoleNavigation.items, nextIndex, embeddedConsoleNavigation.prefilledCommand);
      return;
    }
  };

  const parseTerminalArguments = parseSaltTerminalArguments;

  const persistAutomationTemplates = async (
    nextTemplates: AuthoredSaltTemplate[],
    successMessage: string,
    options?: {
      resetEditor?: boolean;
      nextDraftKind?: 'sls' | 'shell';
    },
  ) => {
    const response = await apiRequest<SaltWorkspaceTemplatesApiResponse>('/api/salt/workspace/templates', {
      method: 'PUT',
      body: JSON.stringify({ templates: nextTemplates }),
    });
    const syncedTemplates = response.templates || nextTemplates;
    saveAuthoredSaltTemplates(syncedTemplates);
    setAuthoredTemplates(syncedTemplates);
    if (options?.resetEditor ?? true) {
      setAutomationDraft(createEmptyTemplateDraft(options?.nextDraftKind || automationDraft.kind));
      setAutomationEditingTemplateId('');
    }
    setAutomationMessage(successMessage);
  };

  const saveAutomationTemplate = async () => {
    const templateName = automationDraft.name.trim();
    const templateDescription = automationDraft.description.trim();
    const templateStateName = automationDraft.stateName.trim();
    const templateContent = automationDraft.content.trim();

    setAutomationMessage('');
    setAutomationError('');

    if (!templateName) {
      setAutomationError('Enter a template name before saving.');
      return;
    }
    if (automationDraft.kind === 'sls' && !templateStateName) {
      setAutomationError('Enter a state name for the .sls template.');
      return;
    }
    if (!templateContent) {
      setAutomationError('Add template content before saving.');
      return;
    }

    const nextTemplate: AuthoredSaltTemplate = {
      id: automationEditingTemplateId || `${automationDraft.kind}-${Date.now()}`,
      kind: automationDraft.kind,
      name: templateName,
      description: templateDescription,
      stateName: automationDraft.kind === 'sls' ? templateStateName : '',
      content: templateContent,
      updatedAt: new Date().toISOString(),
    };

    const nextTemplates = automationEditingTemplateId
      ? authoredTemplates.map((template) => template.id === automationEditingTemplateId ? nextTemplate : template)
      : [nextTemplate, ...authoredTemplates];

    try {
      await persistAutomationTemplates(nextTemplates, automationEditingTemplateId ? 'Template updated.' : (automationDraft.kind === 'sls' ? '.sls template saved.' : '.sh script saved.'), {
        resetEditor: true,
        nextDraftKind: automationDraft.kind,
      });
    } catch (requestError) {
      setAutomationError(requestError instanceof Error ? requestError.message : 'Failed to save automation template.');
    }
  };

  const startAutomationTemplateEdit = (template: AuthoredSaltTemplate) => {
    setAutomationMessage('');
    setAutomationError('');
    setAutomationPendingDeleteTemplateId('');
    setAutomationEditingTemplateId(template.id);
    setAutomationDraft({
      kind: template.kind,
      name: template.name,
      description: template.description,
      stateName: template.stateName,
      content: template.content,
    });
  };

  const cancelAutomationTemplateEdit = () => {
    setAutomationMessage('');
    setAutomationError('');
    setAutomationEditingTemplateId('');
    setAutomationDraft(createEmptyTemplateDraft(automationDraft.kind));
  };

  const confirmAutomationTemplateDelete = async () => {
    const template = authoredTemplates.find((entry) => entry.id === automationPendingDeleteTemplateId);
    if (!template) {
      setAutomationPendingDeleteTemplateId('');
      return;
    }
    setAutomationMessage('');
    setAutomationError('');
    setAutomationDeletingTemplateId(template.id);
    const shouldResetEditor = automationEditingTemplateId === template.id;
    try {
      await persistAutomationTemplates(authoredTemplates.filter((entry) => entry.id !== template.id), 'Template deleted.', {
        resetEditor: shouldResetEditor,
        nextDraftKind: template.kind,
      });
      setAutomationPendingDeleteTemplateId('');
    } catch (requestError) {
      setAutomationError(requestError instanceof Error ? requestError.message : 'Failed to delete automation template.');
    } finally {
      setAutomationDeletingTemplateId('');
    }
  };

  useEffect(() => {
    if (terminalFunctionValue === 'state.apply') {
      setTerminalSelectedSls((current) => (availableSlsFiles.includes(current) ? current : (availableSlsFiles[0] || '')));
      return;
    }
    if (terminalFunctionValue === 'cmd.script') {
      setTerminalSelectedShellTemplateId((current) => (savedShellTemplates.some((template) => template.id === current) ? current : (savedShellTemplates[0]?.id || '')));
    }
  }, [availableSlsFiles, savedShellTemplates, terminalFunctionValue]);

  const buildWorkspaceScopeLabel = () => {
    if (departmentSelectionMode === 'multiple') {
      return selectedDepartments.length > 0 ? `${selectedDepartments.length} selected departments` : 'Department group';
    }
    return selectedDepartments[0] || 'Department';
  };

  const terminalPreviewCommand = buildFunctionPreview(terminalFunctionValue, terminalOptionArgumentLabel);
  const terminalReadinessMessage = (() => {
    if (!canOperate) {
      return 'Auditor access is read-only. Running commands is disabled.';
    }
    if (departmentSelectionMode === 'single' && !selectedDepartments[0]?.trim()) {
      return 'Choose a department before running the action.';
    }
    if (departmentSelectionMode === 'multiple' && selectedDepartments.length === 0) {
      return 'Choose at least one department before running the action.';
    }
    if (terminalFunctionValue === 'state.apply' && !terminalSelectedSls.trim()) {
      return 'Choose one saved .sls template before running the action.';
    }
    if (terminalFunctionValue === 'cmd.script' && !selectedShellTemplate?.content.trim()) {
      return 'Choose one saved .sh script before running the action.';
    }
    if (terminalFunctionValue === 'cmd.run' && !terminalManualCommandValue.trim()) {
      return 'Enter one manual command before running the action.';
    }
    if (executingTerminal) {
      return 'Run in progress. Watch the terminal and tracker for updates.';
    }
    return 'Ready to run. Review the live console and tracker after the command completes.';
  })();

  const executeSaltWorkspace = async () => {
  if (!canOperate) {
    setError('Salt command runs are limited to IT operators.');
    return;
  }
  if (departmentSelectionMode === 'single' && !selectedDepartments[0]?.trim()) {
    setError('Choose a department for department-targeted runs.');
    return;
  }
  if (departmentSelectionMode === 'multiple' && selectedDepartments.length === 0) {
    setError('Choose at least one department for a multi-department run.');
    return;
  }
  if (terminalFunctionValue === 'state.apply' && !terminalSelectedSls.trim()) {
    setError('Choose one saved .sls template before running the action.');
    return;
  }
  if (terminalFunctionValue === 'cmd.script' && !selectedShellTemplate?.content.trim()) {
    setError('Choose one saved .sh script before running the action.');
    return;
  }
  if (terminalFunctionValue === 'cmd.run' && !terminalManualCommandValue.trim()) {
    setError('Enter one manual command before running the action.');
    return;
  }

  const argumentsList = terminalExecutionArgumentsList;
  const executionDepartmentName = departmentSelectionMode === 'single' ? (selectedDepartments[0] || '').trim() : '';
  const executionTargets = departmentSelectionMode === 'multiple' ? parseTerminalArguments(terminalTargetsValue) : [];
  try {
    setExecutingTerminal(true);
    setError('');
    setSuccessMessage('');
    const response = await apiRequest<SaltWorkspaceExecutionResponse>('/api/salt/workspace/execute', {
    method: 'POST',
    body: JSON.stringify({
      client: terminalClient,
      function: terminalFunctionValue,
      arguments: argumentsList,
      targetMode: departmentSelectionMode === 'multiple' ? 'multiple' : 'department',
      target: '',
      targets: executionTargets,
      departmentName: executionDepartmentName,
      label: buildWorkspaceScopeLabel(),
      test: terminalTestMode,
    }),
    });

    setLatestExecutionRows(response.rows || []);
    setTerminalExecutionLogs(response.logs || []);
    setTerminalOutput(response.stdout || JSON.stringify(response.raw || response.rows || response.logs || response, null, 2));

    if ((response.rows || []).length > 0) {
    const report: PatchRunReport = {
      scopeLabel: response.scopeLabel,
      requestedAt: response.requestedAt,
      completedAt: response.completedAt,
      successCount: response.successCount || 0,
      failedCount: response.failedCount || 0,
      totalCount: response.rows?.length || 0,
      rows: (response.rows || []).map((row) => ({
      deviceId: row.deviceId,
      hostname: row.hostname,
      department: row.department,
      status: row.status === 'failed' ? 'failed' : row.status === 'running' ? 'running' : 'success',
      patchStatus: row.patchStatus,
      target: row.target,
      action: row.action,
      message: row.message,
      updatedItems: row.updatedItems || [],
      packageChanges: (row.packageChanges || []).map((change) => ({
        name: change.name,
        fromVersion: change.fromVersion ?? null,
        toVersion: change.toVersion ?? null,
      })),
      })),
    };
    const savedReport = await apiRequest<PatchRunReport>('/api/patch/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
    setPatchReport(savedReport);
    setRecentReports(await apiRequest<PatchRunReportSummary[]>('/api/patch/reports'));
    }

    setActiveSubView('logs');
    setSuccessMessage(`Salt workspace run finished for ${response.scopeLabel}.`);
  } catch (requestError) {
    setError(requestError instanceof Error ? requestError.message : 'Salt workspace run failed');
  } finally {
    setExecutingTerminal(false);
  }
  };

  const downloadPatchRunReportJson = (report: PatchRunReport) => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `patch-run-report-${report.completedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  };

  const openReportArchiveEntry = (reportId: string) => {
    if (!canViewReports) {
      return;
    }

    const nextSearch = buildPatchWorkspaceSearch({
      activeSubView: 'reports',
      canViewReports,
      selectedDepartments,
      reportDepartmentFilter,
      reportDateRange,
      reportSearchQuery,
      reportSort,
      showAllReports,
      reportId,
    });

    setError('');
    setPatchReport(null);
    setActiveSubView('reports');
    void navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
  };

  const reopenPatchReport = async (reportId: string) => {
    if (Date.now() < reportInteractionBlockUntilRef.current) {
      return;
    }

    try {
      setOpeningReportId(reportId);
      setError('');
      const report = await apiRequest<PatchRunReport>(`/api/patch/reports/${reportId}`);
      setPatchReport(report);
      setActiveSubView('reports');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to open patch report');
    } finally {
      setOpeningReportId('');
    }
  };

  const downloadSavedPatchReport = async (reportId: string) => {
    try {
      setDownloadingReportId(reportId);
      setError('');
      const report = await apiRequest<PatchRunReport>(`/api/patch/reports/${reportId}`);
      downloadPatchRunReportCsv(report, 'updated');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to download patch report');
    } finally {
      setDownloadingReportId('');
    }
  };

  const downloadSavedPatchReportPdf = async (reportId: string) => {
    try {
      setDownloadingReportPdfId(reportId);
      setError('');
      const report = await apiRequest<PatchRunReport>(`/api/patch/reports/${reportId}`);
      await downloadPatchRunReportPdf(report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to download patch report PDF');
    } finally {
      setDownloadingReportPdfId('');
    }
  };

  const closePatchReport = () => {
    const params = new URLSearchParams(location.search);
    params.delete('reportId');
    reportInteractionBlockUntilRef.current = Date.now() + 250;
    setReportInteractionShieldVisible(true);
    if (reportInteractionShieldTimeoutRef.current !== null) {
      window.clearTimeout(reportInteractionShieldTimeoutRef.current);
    }
    reportInteractionShieldTimeoutRef.current = window.setTimeout(() => {
      setReportInteractionShieldVisible(false);
      reportInteractionShieldTimeoutRef.current = null;
    }, 250);
    setOpeningReportId('');
    setPatchReport(null);
    void navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  };

  return (
    <div className="min-h-screen space-y-2.5 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_22%),linear-gradient(180deg,_#f4f7f8_0%,_#eef3f5_44%,_#f8fafb_100%)] p-3 sm:p-4">
      {(patchReport || reportInteractionShieldVisible) ? <div aria-hidden="true" className="fixed inset-0 z-[89]" /> : null}

      <section className="overflow-hidden rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f9ff_100%)] shadow-sm">
        <div className="p-3 lg:p-3.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">Patch dashboard</h1>
                <div className="inline-flex items-center rounded-full border border-sky-100 bg-white px-2.5 py-0.5 text-[13px] font-semibold text-slate-700">
                  {selectedDepartmentLabel}
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto pb-0.5 lg:w-auto">
              <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-1 rounded-2xl border border-sky-100 bg-white/80 p-0.5 shadow-sm backdrop-blur lg:justify-end">
                <button
                  type="button"
                  onClick={() => setActiveSubView('dashboard')}
                  className={`inline-flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black !text-slate-950 transition ${activeSubView === 'dashboard' ? 'bg-sky-100 shadow-md shadow-sky-500/15' : 'bg-transparent hover:bg-slate-100'}`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Dashboard
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] !text-slate-950 ${activeSubView === 'dashboard' ? 'bg-white' : 'bg-slate-100'}`}>{visibleDevices.length}</span>
                </button>
                {canViewReports ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('terminal')}
                      className={`inline-flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black !text-slate-950 transition ${activeSubView === 'terminal' ? 'bg-sky-100 shadow-md shadow-sky-500/15' : 'bg-transparent hover:bg-slate-100'}`}
                    >
                      <TerminalSquare className="h-3.5 w-3.5" />
                      Salt Terminal
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] !text-slate-950 ${activeSubView === 'terminal' ? 'bg-white' : 'bg-slate-100'}`}>{terminalWorkspaceCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('automation')}
                      className={`inline-flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black !text-slate-950 transition ${activeSubView === 'automation' ? 'bg-sky-100 shadow-md shadow-sky-500/15' : 'bg-transparent hover:bg-slate-100'}`}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Automation
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] !text-slate-950 ${activeSubView === 'automation' ? 'bg-white' : 'bg-slate-100'}`}>{automationTemplates.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('logs')}
                      className={`inline-flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black !text-slate-950 transition ${activeSubView === 'logs' ? 'bg-sky-100 shadow-md shadow-sky-500/15' : 'bg-transparent hover:bg-slate-100'}`}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Logs
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] !text-slate-950 ${activeSubView === 'logs' ? 'bg-white' : 'bg-slate-100'}`}>{terminalHistoryCount + latestExecutionRows.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('reports')}
                      className={`inline-flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black !text-slate-950 transition ${activeSubView === 'reports' ? 'bg-sky-100 shadow-md shadow-sky-500/15' : 'bg-transparent hover:bg-slate-100'}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Reports
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] !text-slate-950 ${activeSubView === 'reports' ? 'bg-white' : 'bg-slate-100'}`}>{recentReports.length}</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {!canOperate ? (
        <div className="rounded-[24px] border border-amber-200 bg-[linear-gradient(135deg,_#fff8e1_0%,_#fff4cf_100%)] px-5 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Auditor access is view-only on patch operations. You can inspect scope, posture, and visible systems, but patch runs, Salt console actions, and report history remain disabled.
        </div>
      ) : null}

      {error ? <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(180deg,_#fff3f4_0%,_#ffe8eb_100%)] p-4 text-sm font-semibold text-rose-700 shadow-sm">{error}</div> : null}
      {successMessage ? <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,_#eefcf4_0%,_#e2f8eb_100%)] p-4 text-sm font-semibold text-emerald-700 shadow-sm">{successMessage}</div> : null}

      {activeSubView === 'dashboard' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fcff_0%,_#eef8ff_34%,_#fff8ef_100%)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-950">Systems summary</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Current device coverage and update activity for the selected scope.</p>
                </div>
                <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[13px] font-semibold text-slate-700 shadow-sm backdrop-blur">
                  {selectedDepartmentLabel}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { label: 'Total system count', value: scopedMetrics.total, tone: 'border-slate-200 bg-slate-50 text-slate-950' },
                  { label: 'Online system count', value: onlineSystemsCount, tone: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
                  { label: 'Offline system count', value: offlineSystemsCount, tone: 'border-amber-200 bg-amber-50 text-amber-950' },
                ].map((card) => (
                  <div key={card.label} className={`rounded-[22px] border px-4 py-4 shadow-sm ${card.tone}`}>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                    <div className="mt-3 text-4xl font-black leading-none">{loading ? '-' : card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Charts</div>
                  <h3 className="mt-1 text-base font-black text-slate-950">Update activity for last 1 day, 7 days, and 1 month</h3>
                </div>
                <div className="text-right text-xs font-semibold text-slate-500">Successful systems updated</div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {dashboardActivityWindows.map((window) => {
                  const barHeight = loading ? 0 : Math.max(12, Math.round((window.systemsUpdated / dashboardMaxUpdatedSystems) * 100));
                  return (
                    <div key={window.key} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-4 shadow-sm">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{window.label}</div>
                      <div className="mt-2 text-3xl font-black leading-none text-slate-950">{loading ? '-' : window.systemsUpdated}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{loading ? 'Loading activity' : `${window.runs} completed run${window.runs === 1 ? '' : 's'}`}</div>
                      <div className="mt-5 flex h-36 items-end rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex h-full w-full items-end justify-between gap-4">
                          <div className="flex h-full flex-1 items-end">
                            <div className="flex h-full w-16 items-end rounded-[18px] bg-slate-200/80 p-2 shadow-inner">
                              <div
                                className="w-full rounded-[12px] bg-[linear-gradient(180deg,_#38bdf8_0%,_#2563eb_100%)] transition-all"
                                style={{ height: loading ? '0%' : `${barHeight}%`, minHeight: loading ? '0px' : '12px' }}
                              />
                            </div>
                          </div>
                          <div className="w-20 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {loading ? '-' : `${window.systemsUpdated} done`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] shadow-sm">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Recent updates done</div>
                  <h3 className="mt-1 text-base font-black text-slate-950">Recent 10 updates done</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{dashboardRecentReports.length}</div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">Loading recent updates…</div> : null}
                {!loading && dashboardRecentReports.length === 0 ? <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">No completed update runs available for this scope yet.</div> : null}
                {!loading ? dashboardRecentReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openReportArchiveEntry(report.id)}
                    className="block w-full rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-4 py-3 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-950">{report.scopeLabel || 'Patch run'}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{formatReportTimestamp(report.completedAt || report.requestedAt)}</div>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{report.successCount} updated</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{report.rowCount} system{report.rowCount === 1 ? '' : 's'}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{report.failedCount} need review</span>
                      {(report.departments || []).slice(0, 2).map((department) => (
                        <span key={`${report.id}-${department}`} className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{department}</span>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">Open in reports</div>
                  </button>
                )) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
      {activeSubView === 'terminal' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f4f9ff_50%,_#eef6ff_100%)] shadow-sm">
            <div className="space-y-4 p-5 lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Salt Terminal</div>
                  <h2 className="mt-2 text-[2rem] font-black leading-tight text-slate-950">Operations control deck</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Build the department scope, compose one guarded Salt action, and monitor the terminal output without jumping between patch workspace views.</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <span className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sky-700 shadow-sm">Scope-first targeting</span>
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-700 shadow-sm">Patch-aware routing</span>
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-700 shadow-sm">Template-aware options</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_46%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-5 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Command composer</div>
                <h3 className="mt-1 text-lg font-black text-slate-950">Assemble one guarded Salt action</h3>
                <p className="mt-1 text-sm text-slate-500">Choose one or more departments, pick the function option, and run it against the selected patch scope.</p>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setDepartmentSelectionMode('single');
                        setSelectedDepartments((current) => current.length > 1 ? [current[0]] : current);
                      }}
                      className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'single' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                      Single department
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepartmentSelectionMode('multiple')}
                      className={`rounded-full px-3 py-1.5 transition ${departmentSelectionMode === 'multiple' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                      Multiple departments
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Department selection</div>
                    {departmentSelectionMode === 'single' ? (
                      <select
                        value={selectedDepartments[0] || ''}
                        onChange={(event) => setSelectedDepartments(event.target.value ? [event.target.value] : [])}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300"
                      >
                        <option value="">Choose a department</option>
                        {selectableDepartments.map((department) => <option key={`patch-terminal-department-${department}`} value={department}>{department}</option>)}
                      </select>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectableDepartments.map((department) => {
                          const active = selectedDepartments.includes(department);
                          return (
                            <button
                              key={`patch-terminal-department-chip-${department}`}
                              type="button"
                              onClick={() => setSelectedDepartments((current) => (active ? current.filter((entry) => entry !== department) : [...current, department]))}
                              className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${active ? 'border-sky-300 bg-sky-100 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            >
                              {department}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Client</div>
                    <div className="mt-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm font-semibold text-slate-950">local</div>
                  </div>
                  <label>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Function</div>
                    <select value={terminalFunctionValue} onChange={(event) => setTerminalFunctionValue(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                      <option value="state.apply">state.apply</option>
                      <option value="cmd.script">cmd.script</option>
                      <option value="cmd.run">cmd.run</option>
                      <option value="pkg.uptodate">pkg.uptodate</option>
                      <option value="pkg.upgrades">pkg.upgrades</option>
                    </select>
                  </label>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Option</div>
                    {terminalFunctionValue === 'state.apply' ? (
                      <select value={terminalSelectedSls} onChange={(event) => setTerminalSelectedSls(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                        <option value="">Select an .sls template</option>
                        {availableSlsFiles.map((entry) => <option key={`patch-terminal-sls-${entry}`} value={entry}>{entry}</option>)}
                      </select>
                    ) : null}
                    {terminalFunctionValue === 'cmd.script' ? (
                      <select value={terminalSelectedShellTemplateId} onChange={(event) => setTerminalSelectedShellTemplateId(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                        <option value="">Select a .sh script</option>
                        {savedShellTemplates.map((template) => <option key={`patch-terminal-shell-${template.id}`} value={template.id}>{template.name}</option>)}
                      </select>
                    ) : null}
                    {terminalFunctionValue === 'cmd.run' ? (
                      <input value={terminalManualCommandValue} onChange={(event) => setTerminalManualCommandValue(event.target.value)} placeholder="Enter one guarded shell command" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
                    ) : null}
                    {terminalFunctionValue === 'pkg.uptodate' || terminalFunctionValue === 'pkg.upgrades' ? (
                      <div className="mt-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">Package mode uses the selected function directly. No extra option is required.</div>
                    ) : null}
                  </div>
                </div>

              </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#101218] shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2">Terminal</span>
                </div>
              </div>
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['output', 'Output'],
                      ['summary', 'Summary'],
                      ['changes', 'Changes'],
                      ['unchanged', 'Unchanged'],
                      ['errors', 'Errors'],
                    ].map(([value, label]) => (
                      <button key={`terminal-tab-${value}`} type="button" onClick={() => setTerminalPreviewTab(value as 'output' | 'summary' | 'changes' | 'unchanged' | 'errors')} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${terminalPreviewTab === value ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-h-[480px] bg-[#101218] px-4 py-5">
                <div className="mb-4 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <span>{executingTerminal ? 'Running' : 'Latest workspace output'}</span>
                  <span>{buildWorkspaceScopeLabel()}</span>
                </div>
                <pre className="min-h-[380px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-emerald-300">{terminalPreviewOutput || (executingTerminal ? 'Waiting for backend output...' : 'Run a command to see backend terminal output and workspace logs here.')}</pre>
                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-4">
                  <button type="button" onClick={() => void executeSaltWorkspace()} disabled={executingTerminal || !canOperate} className="inline-flex min-w-[190px] items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
                    <Play className="mr-2 h-4 w-4" /> {executingTerminal ? 'Running...' : 'Execute'}
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fbfdff_0%,_#f4f8ff_48%,_#fefaf0_100%)] px-5 py-4">
                <h3 className="text-lg font-black text-slate-950">Tracker</h3>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Command line</div>
                  <div className="mt-2 break-words font-mono text-sm font-semibold text-slate-950">{terminalPreviewCommand || 'No command defined yet.'}</div>
                </div>

                <div className={`rounded-[24px] border px-4 py-4 text-sm leading-6 ${canOperate && !terminalReadinessMessage.includes('Choose') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {terminalReadinessMessage}
                </div>

                <div className="grid gap-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-slate-500">Target Mode</span><span className="font-bold text-slate-950">{formatTerminalTargetModeLabel(terminalTargetMode)}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-slate-500">Systems Targeted</span><span className="font-bold text-slate-950">{terminalSelectedTargets}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-slate-500">Generated On</span><span className="font-bold text-slate-950">{formatReportTimestamp(terminalPreviewGeneratedAt)}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-slate-500">Generated By</span><span className="font-bold text-slate-950">{terminalPreviewRequestedBy}</span></div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Activity logs</div>
                      <div className="mt-1 text-sm text-slate-500">Backend-reported status for the latest patch execution.</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{terminalExecutionLogs.length || latestExecutionRows.length}</div>
                  </div>
                  <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                    {terminalExecutionLogs.length > 0 ? terminalExecutionLogs.map((entry, index) => {
                      const state = normalizeLogStatus(entry.status);
                      return (
                        <div key={`patch-terminal-log-${entry.minionId || entry.hostname || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-slate-950">{entry.hostname || entry.minionId || 'Salt minion'}</div>
                              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{entry.function || terminalFunctionValue}{entry.stateName ? ` · ${entry.stateName}` : ''}</div>
                            </div>
                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === 'success' ? 'bg-emerald-100 text-emerald-700' : state === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status || 'unknown'}</div>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">{entry.message || entry.error || 'No message returned.'}</div>
                        </div>
                      );
                    }) : latestExecutionRows.length > 0 ? latestExecutionRows.map((row, index) => {
                      const state = normalizeLogStatus(row.status);
                      return (
                        <div key={`patch-terminal-row-${row.minionId || row.hostname || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-slate-950">{row.hostname}</div>
                              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{row.action} · {row.department}</div>
                            </div>
                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${state === 'success' ? 'bg-emerald-100 text-emerald-700' : state === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{row.status}</div>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">{row.message || 'No message returned.'}</div>
                        </div>
                      );
                    }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">Run a Salt execution to populate the backend activity log.</div>}
                  </div>
                </div>
              </div>
            </section>
          </section>

        </>
      ) : null}
      {activeSubView === 'automation' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fcff_50%,_#f6fbf6_100%)] shadow-sm">
            <div className="space-y-4 p-5 lg:p-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Automation</div>
                <h2 className="mt-2 text-[2rem] font-black leading-tight text-slate-950">Automation studio</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Create saved `.sls` states and `.sh` scripts here. The Salt Terminal option picker reads from the same saved templates.</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_48%),linear-gradient(180deg,_#ffffff_0%,_#f8fffb_100%)] px-5 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Template builder</div>
                <h3 className="mt-1 text-lg font-black text-slate-950">{automationEditingTemplateId ? 'Edit saved automation template' : 'Create one saved automation template'}</h3>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
                  <label>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Type</div>
                    <select
                      value={automationDraft.kind}
                      onChange={(event) => setAutomationDraft((current) => ({
                        ...current,
                        kind: event.target.value as 'sls' | 'shell',
                        stateName: event.target.value === 'sls' ? (current.stateName || 'patch.run') : '',
                      }))}
                      className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-300"
                    >
                      <option value="sls">.sls state</option>
                      <option value="shell">.sh script</option>
                    </select>
                  </label>
                  <label>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Name</div>
                    <input value={automationDraft.name} onChange={(event) => setAutomationDraft((current) => ({ ...current, name: event.target.value }))} placeholder={automationDraft.kind === 'sls' ? 'patch-baseline' : 'restart-salt-minion'} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-300" />
                  </label>
                  <label>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Description</div>
                    <input value={automationDraft.description} onChange={(event) => setAutomationDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Short note for the operator" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-300" />
                  </label>
                </div>

                {automationDraft.kind === 'sls' ? (
                  <label className="block">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">State name</div>
                    <input value={automationDraft.stateName} onChange={(event) => setAutomationDraft((current) => ({ ...current, stateName: event.target.value }))} placeholder="patch.run" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-300" />
                  </label>
                ) : null}

                <label className="block">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Content</div>
                  <textarea value={automationDraft.content} onChange={(event) => setAutomationDraft((current) => ({ ...current, content: event.target.value }))} rows={12} placeholder={automationDraft.kind === 'sls' ? 'pkg_uptodate:\n  pkg.uptodate: []' : '#!/bin/sh\nsystemctl restart salt-minion'} className="mt-1.5 w-full rounded-[22px] border border-slate-200 bg-white px-3 py-3 font-mono text-sm text-slate-950 outline-none transition focus:border-emerald-300" />
                </label>

                {automationError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{automationError}</div> : null}
                {automationMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{automationMessage}</div> : null}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                  {automationEditingTemplateId ? (
                    <button type="button" onClick={cancelAutomationTemplateEdit} className="inline-flex min-w-[160px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                      Cancel edit
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void saveAutomationTemplate()} className="inline-flex min-w-[190px] items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600">
                    <Play className="mr-2 h-4 w-4" /> {automationEditingTemplateId ? 'Update template' : 'Save template'}
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fbfdff_0%,_#f4fff8_48%,_#fffef7_100%)] px-5 py-4">
                <h3 className="text-lg font-black text-slate-950">Saved templates</h3>
              </div>
              <div className="space-y-3 px-5 py-5">
                {automationTemplates.length > 0 ? automationTemplates.map((template) => (
                  <div key={`automation-template-${template.id}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-950">{template.name}</div>
                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{template.kind === 'sls' ? '.sls state' : '.sh script'}{template.stateName ? ` · ${template.stateName}` : ''}</div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">{new Date(template.updatedAt).toLocaleDateString()}</div>
                        <button type="button" onClick={() => startAutomationTemplateEdit(template)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700 transition hover:bg-slate-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => setAutomationPendingDeleteTemplateId(template.id)} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-black text-rose-700 transition hover:bg-rose-50">
                          Delete
                        </button>
                      </div>
                    </div>
                    {template.description ? <div className="mt-3 text-sm text-slate-600">{template.description}</div> : null}
                    <pre className="mt-3 max-h-[220px] overflow-auto rounded-2xl border border-slate-200 bg-white px-3 py-3 font-mono text-xs leading-5 text-slate-700">{template.content}</pre>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No saved `.sls` or `.sh` templates yet. Create one here, then return to Salt Terminal and pick it from Option.</div>
                )}
              </div>
            </section>
          </section>

        </>
      ) : null}
      {activeSubView === 'logs' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_56%,_#0ea5e9_100%)] px-5 py-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-100">Logs</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Execution logs by minion, function, status, and package changes</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50/90">Review the latest in-session Salt execution first, then fall back to job history for older workspace runs.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className={`text-xs font-medium ${logsRecentItemsTone.labelClassName}`}>
                    Recent items
                    <select value={recentDetailsLimit} onChange={(event) => setRecentDetailsLimit(Number(event.target.value))} className={`mt-1 block rounded-2xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition ${logsRecentItemsTone.selectClassName}`}>
                      {RECENT_PATCH_DETAILS_LIMIT_OPTIONS.map((option) => <option key={`recent-limit-logs-${option}`} value={option}>{option} items</option>)}
                    </select>
                  </label>
                  <label className={`text-xs font-medium ${logsStatusTone.labelClassName}`}>
                    Status
                    <select value={logsStatusFilter} onChange={(event) => setLogsStatusFilter(event.target.value as PatchLogsStatusFilter)} className={`mt-1 block rounded-2xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition ${logsStatusTone.selectClassName}`}>
                      <option value="all">All statuses</option>
                      <option value="success">Success</option>
                      <option value="failed">Failed</option>
                      <option value="queued">Queued</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-50">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                  {filteredLogsMatchCount} log item(s) match the current status filter
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                  {filteredTerminalExecutionLogs.length} live log(s)
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                  {filteredRecentExecutionHistory.length} recent execution item(s)
                </span>
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              {terminalExecutionLogs.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No new execution logs yet. Run something from Salt Terminal to populate this view.</div> : filteredTerminalExecutionLogs.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No execution logs match the selected status filter.</div> : filteredTerminalExecutionLogs.map((entry, index) => (
                <div key={`latest-log-${entry.minionId || entry.hostname || index}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">{entry.hostname || entry.minionId || 'Unknown target'}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.department || 'Unassigned'} • {entry.function || 'function'} {entry.stateName ? `• ${entry.stateName}` : ''}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' : entry.status === 'failed' || entry.status === 'no_response' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status || 'unknown'}</span>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Start time</div><div className="mt-1">{entry.startedAt ? formatReportTimestamp(entry.startedAt) : 'Unknown'}</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Duration</div><div className="mt-1">{typeof entry.durationMs === 'number' ? `${entry.durationMs} ms` : 'Unknown'}</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Errors</div><div className="mt-1">{entry.error || 'None'}</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Upgraded packages</div><div className="mt-1">{entry.packages?.length || 0}</div></div>
                  </div>
                  {entry.packages && entry.packages.length > 0 ? <div className="mt-3 grid gap-2 lg:grid-cols-2">{entry.packages.map((pkg) => <div key={`${entry.minionId || entry.hostname}-${pkg.name}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div className="font-black text-slate-950">{pkg.name}</div><div className="mt-1 text-xs text-slate-500">{pkg.fromVersion || '-'} -&gt; {pkg.toVersion || '-'}</div></div>)}</div> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffaf0_0%,_#f8fafc_100%)] px-5 py-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Job History</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Recent workspace runs</h2>
            </div>
            <div className="space-y-3 px-5 py-5">
              {saltJobHistory.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No Salt job history is available yet.</div> : visibleSaltJobHistory.map((entry) => (
                <div key={`job-history-${entry.id}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{entry.scopeLabel}</div>
                      <div className="mt-2 text-lg font-black text-slate-950">{entry.successCount} succeeded, {entry.failedCount} failed across {entry.rowCount} endpoints</div>
                      <div className="mt-1 text-sm text-slate-500">Requested {formatReportTimestamp(entry.requestedAt)} • Completed {formatReportTimestamp(entry.completedAt)}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{entry.requestedBy || 'IT automation'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_100%)] px-5 py-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Recent Executions</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Recent patch execution history</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">This history comes from the Salt workspace payload even when there are no in-session execution logs open yet.</p>
            </div>
            <div className="space-y-3 px-5 py-5">
              {visibleRecentExecutionHistory.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No recent execution history is available yet.</div> : filteredRecentExecutionHistory.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No recent execution history matches the selected status filter.</div> : filteredRecentExecutionHistory.map((entry) => (
                <div key={`recent-execution-${entry.id}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{entry.scope || entry.jid || entry.id}</div>
                      <div className="mt-2 text-lg font-black text-slate-950">Status: {(entry.status || 'unknown').replaceAll('_', ' ')}</div>
                      <div className="mt-1 text-sm text-slate-500">Created {formatReportTimestamp(entry.createdAt)}{entry.updatedAt ? ` • Updated ${formatReportTimestamp(entry.updatedAt)}` : ''}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${entry.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : entry.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {entry.status || 'unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {canViewReports && activeSubView === 'reports' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#111827_0%,_#374151_52%,_#0f766e_100%)] px-5 py-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">Reports</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Export patch results as CSV, JSON, or PDF</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/90">Saved reports retain the system, department, status, packages, and message details needed for operations and audits.</p>
                </div>
                {patchReport ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadPatchRunReportCsv(patchReport, 'all')} className="rounded-2xl border border-white/20 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-emerald-50">Export CSV</button><button type="button" onClick={() => void downloadPatchRunReportPdf(patchReport)} className="rounded-2xl border border-white/20 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-emerald-50">Export PDF</button><button type="button" onClick={() => downloadPatchRunReportJson(patchReport)} className="rounded-2xl border border-white/20 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-emerald-50">Export JSON</button></div> : null}
              </div>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Saved reports</div><div className="mt-2 text-2xl font-black text-slate-950">{filteredRecentReports.length}</div></div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Successful runs</div><div className="mt-2 text-2xl font-black text-emerald-950">{filteredSuccessfulReportsCount}</div></div>
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3"><div className="text-[11px] font-black uppercase tracking-wider text-rose-700">Needs review</div><div className="mt-2 text-2xl font-black text-rose-950">{filteredFailedReportsCount}</div></div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Departments</div><div className="mt-2 text-2xl font-black text-slate-950">{filteredReportDepartmentsCount}</div></div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm xl:col-span-5">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_100%)] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Featured Report</div>
                    <h2 className="mt-2 text-xl font-black text-slate-950">Latest verified run in the current scope</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">This lead card keeps the latest saved result visible before you dive into the full archive.</p>
                  </div>
                  <FileText className="h-5 w-5 text-brand-600" />
                </div>
              </div>
              <div className="px-5 py-5">
                {featuredReportLoading ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">Loading latest report...</div>
                ) : !featuredReportSummary || !featuredReport ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No saved patch report is available for this department yet.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-950">{featuredReport.scopeLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">Completed {formatReportTimestamp(featuredReport.completedAt)}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getFeaturedReportTone(featuredReport.failedCount)}`}>
                          {featuredReport.failedCount > 0 ? 'Needs review' : 'Successful'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 p-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Systems</div>
                          <div className="mt-1 text-xl font-black text-slate-950">{featuredReport.rows.length}</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Success</div>
                          <div className="mt-1 text-xl font-black text-emerald-950">{featuredReport.successCount}</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">Failed</div>
                          <div className="mt-1 text-xl font-black text-amber-950">{featuredReport.failedCount}</div>
                        </div>
                      </div>
                    </div>

                    {featuredReportRows.map((row) => (
                      <div key={`${row.deviceId}-${row.hostname}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-950">{row.hostname}</div>
                            <div className="mt-1 text-xs text-slate-500">{row.department}</div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${row.status === 'success' ? 'bg-emerald-100 text-emerald-700' : row.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Packages updated</div>
                        {renderPackageChangeSummary(row)}
                        {shouldShowReportRowMessage(row) ? <div className="mt-3 line-clamp-2 text-xs text-slate-500">{row.message}</div> : null}
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void reopenPatchReport(featuredReportSummary.id)}
                        disabled={openingReportId === featuredReportSummary.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {openingReportId === featuredReportSummary.id ? 'Opening...' : 'Open full report'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadSavedPatchReport(featuredReportSummary.id)}
                        disabled={downloadingReportId === featuredReportSummary.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {downloadingReportId === featuredReportSummary.id ? 'Downloading...' : 'Download CSV'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadSavedPatchReportPdf(featuredReportSummary.id)}
                        disabled={downloadingReportPdfId === featuredReportSummary.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {downloadingReportPdfId === featuredReportSummary.id ? 'Downloading PDF...' : 'Download PDF'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm xl:col-span-7">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffaf0_0%,_#f8fafc_100%)] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Report Archive</div>
                    <h2 className="mt-2 text-xl font-black text-slate-950">Filter the history by department, time, and severity.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">The archive panel keeps the control surface compact while making saved reports much easier to scan.</p>
                  </div>
                  <Funnel className="h-5 w-5 text-brand-600" />
                </div>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-500">
                      Department
                      <select value={reportDepartmentFilter} onChange={(event) => setReportDepartmentFilter(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                        {reportDepartmentOptions.map((department) => (
                          <option key={department} value={department}>{department === 'all' ? 'All departments' : department}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-500">
                      Date range
                      <select value={reportDateRange} onChange={(event) => setReportDateRange(event.target.value as PatchRunReportDateRange)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                        <option value="all">All time</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-500">
                      Sort
                      <select value={reportSort} onChange={(event) => setReportSort(event.target.value as PatchRunReportSort)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="most-failures">Most failures</option>
                        <option value="most-successes">Most successes</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-500 sm:col-span-2 xl:col-span-1">
                      Search
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Search className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={reportSearchQuery}
                          onChange={(event) => setReportSearchQuery(event.target.value)}
                          placeholder="Search scope, department, requester"
                          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Funnel className="h-3.5 w-3.5" />
                      {filteredRecentReports.length} report(s) match the current filters.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReportDepartmentFilter('all');
                          setReportDateRange('30d');
                          setReportSearchQuery('');
                          setReportSort('newest');
                          setShowAllReports(false);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Reset filters
                      </button>
                      <label className="text-xs font-medium text-slate-500">
                        Recent items
                        <select value={recentDetailsLimit} onChange={(event) => setRecentDetailsLimit(Number(event.target.value))} className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                          {RECENT_PATCH_DETAILS_LIMIT_OPTIONS.map((option) => <option key={`recent-limit-reports-${option}`} value={option}>{option} items</option>)}
                        </select>
                      </label>
                      {filteredRecentReports.length > recentDetailsLimit ? (
                        <button
                          type="button"
                          onClick={() => setShowAllReports((value) => !value)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          {showAllReports ? 'Show less' : `Show all (${filteredRecentReports.length})`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Filtered reports</div>
                    <div className="mt-2 text-2xl font-black text-slate-950">{filteredRecentReports.length}</div>
                  </div>
                  <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-rose-700">Needs review</div>
                    <div className="mt-2 text-2xl font-black text-rose-950">{filteredFailedReportsCount}</div>
                  </div>
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Clean runs</div>
                    <div className="mt-2 text-2xl font-black text-emerald-950">{filteredSuccessfulReportsCount}</div>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Departments</div>
                    <div className="mt-2 text-2xl font-black text-slate-950">{filteredReportDepartmentsCount}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredRecentReports.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No saved patch reports yet.</div>
                  ) : visibleRecentReports.map((reportItem) => (
                    <div key={reportItem.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-black text-slate-950">{reportItem.scopeLabel}</div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${reportItem.failedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {reportItem.failedCount > 0 ? `${reportItem.failedCount} failed` : 'all successful'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(reportItem.completedAt).toLocaleString()} • {reportItem.successCount}/{reportItem.rowCount} succeeded</div>
                      <div className="mt-2 text-xs text-slate-500">{reportItem.departments.join(', ') || 'Unassigned'}{reportItem.requestedBy ? ` • ${reportItem.requestedBy}` : ''}</div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void reopenPatchReport(reportItem.id)}
                          disabled={openingReportId === reportItem.id}
                          className="inline-flex items-center text-sm font-black text-brand-700 transition hover:text-brand-900 disabled:opacity-60"
                        >
                          <FolderOpen className="mr-1.5 h-4 w-4" />
                          {openingReportId === reportItem.id ? 'Opening...' : 'Open report'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadSavedPatchReport(reportItem.id)}
                          disabled={downloadingReportId === reportItem.id}
                          className="inline-flex items-center text-sm font-black text-slate-700 transition hover:text-slate-900 disabled:opacity-60"
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          {downloadingReportId === reportItem.id ? 'Downloading...' : 'Download CSV'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadSavedPatchReportPdf(reportItem.id)}
                          disabled={downloadingReportPdfId === reportItem.id}
                          className="inline-flex items-center text-sm font-black text-slate-700 transition hover:text-slate-900 disabled:opacity-60"
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          {downloadingReportPdfId === reportItem.id ? 'Downloading PDF...' : 'Download PDF'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(automationPendingDeleteTemplate)}
        title="Delete automation template"
        message={automationPendingDeleteTemplate ? `Remove ${automationPendingDeleteTemplate.name} from saved Automation templates? This cannot be undone.` : ''}
        confirmLabel="Delete template"
        tone="danger"
        busy={Boolean(automationPendingDeleteTemplate && automationDeletingTemplateId === automationPendingDeleteTemplate.id)}
        onClose={() => {
          if (!automationDeletingTemplateId) {
            setAutomationPendingDeleteTemplateId('');
          }
        }}
        onConfirm={() => {
          void confirmAutomationTemplateDelete();
        }}
      />

      <PatchRunReportModal report={patchReport} onClose={closePatchReport} />
      <EmbeddedConsoleModal
        consoleState={embeddedConsole}
        titleId="patch-dashboard-salt-console-title"
        closeButtonRef={embeddedConsoleCloseButtonRef}
        navigation={embeddedConsoleNavigation ? {
          index: embeddedConsoleNavigation.index,
          total: embeddedConsoleNavigation.items.length,
          onPrevious: () => { void navigateEmbeddedConsole(-1); },
          onNext: () => { void navigateEmbeddedConsole(1); },
        } : null}
        onClose={() => {
          setEmbeddedConsole(null);
          setEmbeddedConsoleNavigation(null);
        }}
      />
    </div>
  );
}