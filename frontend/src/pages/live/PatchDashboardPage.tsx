import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, Search, ShieldAlert, ShieldCheck, FolderOpen, Funnel, Download, TerminalSquare, Wifi, WifiOff, FileText } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import EmbeddedConsoleModal, { buildEmbeddedSaltConsoleState, type EmbeddedConsoleState } from '../../components/EmbeddedConsoleModal';
import PatchRunReportModal from '../../components/PatchRunReportModal';
import { resolveSaltTarget, type BootstrapDeviceLike } from '../../lib/bootstrap';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, downloadPatchRunReportCsv, downloadPatchRunReportPdf, filterPatchRunReports, listPatchReportDepartments, normalizePatchRunReport, sortPatchRunReports, type PatchRunExecutionResponse, type PatchRunReport, type PatchRunReportDateRange, type PatchRunReportSort, type PatchRunReportSummary } from '../../lib/patchReports';
import { buildSaltActionConsolePrefill } from '../../lib/salt';
import { getStoredSession } from '../../lib/session';
import { createEmptyTemplateDraft, loadAuthoredSaltTemplates, SALT_TEMPLATE_STORAGE_KEY, type AuthoredSaltTemplate, type AuthoredTemplateDraft, type AuthoredTemplateKind } from '../../lib/saltTemplates';
import { buildPatchMetrics, formatPatchStatusLabel, getPatchStatusBadgeClassName, isDeviceOnline, formatReportTimestamp, renderPackageChangeSummary, shouldShowReportRowMessage, getFeaturedReportTone, parseReportDateRange, parseReportSort, parsePatchWorkspaceView, getPatchProgressValue, type PatchDevice, type PatchWorkspaceView } from './PatchDashboardPage.helpers';
import { shouldResetOpeningReportId } from './patchDashboardState';

type PatchSystemsStatusFilter = 'all' | 'updated' | 'pending' | 'offline';
type PatchSystemsAppFilter = 'all' | 'needs-app-updates' | 'salt-ready';

function parseSelectedDepartments(value: string | null) {
  const normalized = (value || '').trim();
  if (!normalized || normalized.toLowerCase() === 'all') {
    return [] as string[];
  }

  return Array.from(new Set(normalized.split(',').map((item) => item.trim()).filter(Boolean)));
}

function areDepartmentSelectionsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
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

interface PatchSaltWorkspaceHistoryResponse {
  jobHistory: PatchSaltJobHistoryRecord[];
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

function getInstalledAppChips(device: PatchDevice) {
  return [
    { key: 'wps', label: 'WPS', installed: device.installedApps?.wps === true },
    { key: 'libreOffice', label: 'LibreOffice', installed: device.installedApps?.libreOffice === true },
    { key: 'chrome', label: 'Chrome', installed: device.installedApps?.chrome === true },
    { key: 'salt', label: 'Salt', installed: device.installedApps?.salt === true },
  ];
}

function getSystemDisplayId(device: PatchDevice) {
  return device.assetId || device.assetTag || device.id;
}

function getInstalledAppBuckets(device: PatchDevice) {
  const apps = getInstalledAppChips(device);
  return {
    updated: apps.filter((app) => app.installed),
    pending: apps.filter((app) => !app.installed),
  };
}

export default function PatchDashboardPage() {
  const reportInteractionBlockUntilRef = useRef(0);
  const reportInteractionShieldTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/patch')[0];
  const session = getStoredSession();
  const canOperate = ['super_admin', 'it_team'].includes((session?.user.role || '').toLowerCase());
  const canAuthorScripts = (session?.user.role || '').toLowerCase() === 'super_admin';
  const canViewReports = canOperate;
  const [activeSubView, setActiveSubView] = useState<PatchWorkspaceView>(() => {
    const requestedView = parsePatchWorkspaceView(new URLSearchParams(location.search).get('view'), canViewReports);
    return requestedView as PatchWorkspaceView;
  });
  const [devices, setDevices] = useState<PatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() => parseSelectedDepartments(new URLSearchParams(location.search).get('department')));
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [runningBatch, setRunningBatch] = useState(false);
  const [openingConsoleDeviceId, setOpeningConsoleDeviceId] = useState('');
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [embeddedConsoleNavigation, setEmbeddedConsoleNavigation] = useState<EmbeddedConsoleNavigationState | null>(null);
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [recentReports, setRecentReports] = useState<PatchRunReportSummary[]>([]);
  const [openingReportId, setOpeningReportId] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState('');
  const [downloadingReportPdfId, setDownloadingReportPdfId] = useState('');
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState(() => new URLSearchParams(location.search).get('reportDepartment')?.trim() || 'all');
  const [reportDateRange, setReportDateRange] = useState<PatchRunReportDateRange>(() => parseReportDateRange(new URLSearchParams(location.search).get('reportRange')));
  const [reportSearchQuery, setReportSearchQuery] = useState(() => new URLSearchParams(location.search).get('reportQuery')?.trim() || '');
  const [reportSort, setReportSort] = useState<PatchRunReportSort>(() => parseReportSort(new URLSearchParams(location.search).get('reportSort')));
  const [showAllReports, setShowAllReports] = useState(() => new URLSearchParams(location.search).get('reportsExpanded') === '1');
  const [featuredReport, setFeaturedReport] = useState<PatchRunReport | null>(null);
  const [featuredReportLoading, setFeaturedReportLoading] = useState(false);
  const [reportInteractionShieldVisible, setReportInteractionShieldVisible] = useState(false);
  const [saltJobHistory, setSaltJobHistory] = useState<PatchSaltJobHistoryRecord[]>([]);
  const [systemsSearchQuery, setSystemsSearchQuery] = useState('');
  const [systemsStatusFilter, setSystemsStatusFilter] = useState<PatchSystemsStatusFilter>('all');
  const [systemsAppFilter, setSystemsAppFilter] = useState<PatchSystemsAppFilter>('all');
  const [authoredTemplates, setAuthoredTemplates] = useState<AuthoredSaltTemplate[]>(() => loadAuthoredSaltTemplates());
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [scriptDraft, setScriptDraft] = useState<AuthoredTemplateDraft>(() => createEmptyTemplateDraft());
  const [isCreatingScriptDraft, setIsCreatingScriptDraft] = useState(false);
  const embeddedConsoleCloseButtonRef = useRef<HTMLButtonElement | null>(null);

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
          reportData = await apiRequest<PatchRunReportSummary[]>('/api/patch/reports');
          const saltWorkspace = await apiRequest<PatchSaltWorkspaceHistoryResponse>('/api/salt/workspace');
          jobHistoryData = saltWorkspace.jobHistory || [];
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
  }, [canViewReports]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncTemplates = () => setAuthoredTemplates(loadAuthoredSaltTemplates());
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  const selectableDepartments = useMemo(() => departments.filter((department) => department !== 'all'), [departments]);
  const sortedAuthoredTemplates = useMemo(() => [...authoredTemplates].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [authoredTemplates]);
  const selectedScript = useMemo(() => sortedAuthoredTemplates.find((template) => template.id === selectedScriptId) || null, [selectedScriptId, sortedAuthoredTemplates]);

  useEffect(() => {
    if (isCreatingScriptDraft) {
      return;
    }

    if (!selectedScriptId && sortedAuthoredTemplates[0]) {
      setSelectedScriptId(sortedAuthoredTemplates[0].id);
      return;
    }

    if (selectedScriptId && !sortedAuthoredTemplates.some((template) => template.id === selectedScriptId)) {
      setSelectedScriptId(sortedAuthoredTemplates[0]?.id || '');
    }
  }, [isCreatingScriptDraft, selectedScriptId, sortedAuthoredTemplates]);

  useEffect(() => {
    if (isCreatingScriptDraft) {
      return;
    }

    if (selectedScript) {
      setScriptDraft({
        kind: selectedScript.kind,
        name: selectedScript.name,
        description: selectedScript.description,
        stateName: selectedScript.stateName,
        content: selectedScript.content,
      });
      return;
    }

    setScriptDraft((current) => selectedScriptId ? current : createEmptyTemplateDraft());
  }, [isCreatingScriptDraft, selectedScript, selectedScriptId]);

  const visibleDevices = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return devices;
    }

    return devices.filter((device) => selectedDepartments.includes(device.department?.name?.trim() || 'Unassigned'));
  }, [devices, selectedDepartments]);
  const filteredSystemDevices = useMemo(() => {
    const normalizedQuery = systemsSearchQuery.trim().toLowerCase();
    return visibleDevices.filter((device) => {
      const fields = [
        getSystemDisplayId(device),
        device.hostname,
        device.user?.fullName || '',
        device.department?.name || 'Unassigned',
        device.assetId || '',
        device.assetTag || '',
      ];

      const matchesQuery = !normalizedQuery || fields.some((value) => value.toLowerCase().includes(normalizedQuery));
      const progress = getPatchProgressValue(device.complianceScore);
      const matchesStatus = systemsStatusFilter === 'all'
        || (systemsStatusFilter === 'updated' && progress === 100)
        || (systemsStatusFilter === 'pending' && progress < 100)
        || (systemsStatusFilter === 'offline' && !isDeviceOnline(device));
      const appBuckets = getInstalledAppBuckets(device);
      const matchesApp = systemsAppFilter === 'all'
        || (systemsAppFilter === 'needs-app-updates' && appBuckets.pending.length > 0)
        || (systemsAppFilter === 'salt-ready' && device.installedApps?.salt === true);

      return matchesQuery && matchesStatus && matchesApp;
    });
  }, [systemsAppFilter, systemsSearchQuery, systemsStatusFilter, visibleDevices]);
  const systemsPreview = useMemo(() => filteredSystemDevices.slice(0, 12), [filteredSystemDevices]);
  const scopedMetrics = useMemo(() => buildPatchMetrics(visibleDevices), [visibleDevices]);
  const selectedDepartmentLabel = useMemo(() => formatSelectedDepartmentScope(selectedDepartments), [selectedDepartments]);
  const reportDepartmentOptions = useMemo(() => listPatchReportDepartments(recentReports), [recentReports]);
  const filteredRecentReports = useMemo(() => filterPatchRunReports(recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery), [recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery]);
  const sortedRecentReports = useMemo(() => sortPatchRunReports(filteredRecentReports, reportSort), [filteredRecentReports, reportSort]);
  const visibleRecentReports = useMemo(() => showAllReports ? sortedRecentReports : sortedRecentReports.slice(0, 5), [sortedRecentReports, showAllReports]);
  const totalReportsCount = useMemo(() => recentReports.length, [recentReports]);
  const filteredFailedReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount > 0).length, [filteredRecentReports]);
  const filteredSuccessfulReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount === 0).length, [filteredRecentReports]);
  const filteredReportDepartmentsCount = useMemo(() => new Set(filteredRecentReports.flatMap((report) => report.departments || [])).size, [filteredRecentReports]);
  const onlineSystemsCount = useMemo(() => visibleDevices.filter((device) => isDeviceOnline(device)).length, [visibleDevices]);
  const offlineSystemsCount = useMemo(() => visibleDevices.length - onlineSystemsCount, [visibleDevices.length, onlineSystemsCount]);
  const terminalHistoryCount = useMemo(() => saltJobHistory.length, [saltJobHistory.length]);
  const terminalWorkspaceCount = useMemo(() => totalReportsCount + terminalHistoryCount + sortedAuthoredTemplates.length, [sortedAuthoredTemplates.length, terminalHistoryCount, totalReportsCount]);
  const featuredReportSummary = useMemo(() => {
    const scopedReports = sortPatchRunReports(recentReports.filter((report) => reportMatchesDepartmentScope(report, selectedDepartments)), 'newest');
    return scopedReports[0] || sortPatchRunReports(recentReports, 'newest')[0] || null;
  }, [recentReports, selectedDepartments]);
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

  useEffect(() => {
    const requestedView = new URLSearchParams(location.search).get('view');
    const requestedReportId = new URLSearchParams(location.search).get('reportId')?.trim();
    const requestedWorkspace = requestedReportId && canViewReports ? 'terminal' : parsePatchWorkspaceView(requestedView, canViewReports);
    if (activeSubView !== requestedWorkspace) {
      setActiveSubView(requestedWorkspace as PatchWorkspaceView);
    }

    const requestedDepartments = parseSelectedDepartments(new URLSearchParams(location.search).get('department'));
    if (!areDepartmentSelectionsEqual(selectedDepartments, requestedDepartments)) {
      setSelectedDepartments(requestedDepartments);
    }

    const requestedReportDepartment = new URLSearchParams(location.search).get('reportDepartment')?.trim() || 'all';
    if (reportDepartmentFilter !== requestedReportDepartment) {
      setReportDepartmentFilter(requestedReportDepartment);
    }

    const requestedReportRange = parseReportDateRange(new URLSearchParams(location.search).get('reportRange'));
    if (reportDateRange !== requestedReportRange) {
      setReportDateRange(requestedReportRange);
    }

    const requestedReportQuery = new URLSearchParams(location.search).get('reportQuery')?.trim() || '';
    if (reportSearchQuery !== requestedReportQuery) {
      setReportSearchQuery(requestedReportQuery);
    }

    const requestedReportSort = parseReportSort(new URLSearchParams(location.search).get('reportSort'));
    if (reportSort !== requestedReportSort) {
      setReportSort(requestedReportSort);
    }

    const requestedExpandedState = new URLSearchParams(location.search).get('reportsExpanded') === '1';
    if (showAllReports !== requestedExpandedState) {
      setShowAllReports(requestedExpandedState);
    }

  }, [activeSubView, canViewReports, location.search, reportDateRange, reportDepartmentFilter, reportSearchQuery, reportSort, selectedDepartments, showAllReports]);

  useEffect(() => {
    const requestedReportId = new URLSearchParams(location.search).get('reportId')?.trim();
    if (shouldResetOpeningReportId(openingReportId, patchReport, requestedReportId)) {
      setOpeningReportId('');
    }
  }, [location.search, openingReportId, patchReport]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedReportId = params.get('reportId')?.trim();

    if (activeSubView === 'terminal' && canViewReports) {
      params.set('view', activeSubView);
    } else {
      params.delete('view');
    }

    if (selectedDepartments.length > 0) {
      params.set('department', selectedDepartments.join(','));
    } else {
      params.delete('department');
    }

    if (reportDepartmentFilter !== 'all') {
      params.set('reportDepartment', reportDepartmentFilter);
    } else {
      params.delete('reportDepartment');
    }

    if (reportDateRange !== '30d') {
      params.set('reportRange', reportDateRange);
    } else {
      params.delete('reportRange');
    }

    if (reportSearchQuery.trim()) {
      params.set('reportQuery', reportSearchQuery.trim());
    } else {
      params.delete('reportQuery');
    }

    if (reportSort !== 'newest') {
      params.set('reportSort', reportSort);
    } else {
      params.delete('reportSort');
    }

    if (showAllReports) {
      params.set('reportsExpanded', '1');
    } else {
      params.delete('reportsExpanded');
    }

    if (patchReport?.id || requestedReportId) {
      params.set('reportId', patchReport?.id || requestedReportId || '');
    } else {
      params.delete('reportId');
    }

    const nextSearch = params.toString();
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
      setOpeningConsoleDeviceId(device.id);
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
    } finally {
      setOpeningConsoleDeviceId('');
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

  const handleBatchRun = async (batchDevices: PatchDevice[]) => {
    if (batchDevices.length === 0) {
      return;
    }

    try {
      setRunningBatch(true);
      setError('');
      setSuccessMessage('');
      const requestedAt = new Date().toISOString();
      const scopeLabel = selectedDepartments.length === 0 ? 'All departments' : selectedDepartments.join(', ');
      setPatchReport(createPatchRunProgressReport(scopeLabel, requestedAt, batchDevices.length));
      const rows = await Promise.all(batchDevices.map(async (device) => {
        let row;
        try {
          const response = await apiRequest<PatchRunExecutionResponse>(`/api/assets/${device.id}/patch`, {
            method: 'POST',
            body: JSON.stringify({ action: 'system-update' }),
          });
          row = createPatchRunReportEntry(device, response);
        } catch (requestError) {
          row = createPatchRunReportEntry(device, undefined, requestError);
        }
        setPatchReport((current) => {
          if (!current) {
            return current;
          }
          const nextRows = [...current.rows, row];
          return {
            ...current,
            rows: nextRows,
            successCount: nextRows.filter((entry) => entry.status === 'success').length,
            failedCount: nextRows.filter((entry) => entry.status === 'failed').length,
          };
        });
        return row;
      }));
      const report = createPatchRunReport(scopeLabel, requestedAt, rows);
      let savedReport = report;
      try {
        savedReport = await apiRequest<PatchRunReport>('/api/patch/reports', {
          method: 'POST',
          body: JSON.stringify(report),
        });
        const reportData = await apiRequest<PatchRunReportSummary[]>('/api/patch/reports');
        setRecentReports(reportData || []);
      } catch (saveError) {
        setError(saveError instanceof Error ? `${saveError.message} Report was not saved for later reopening.` : 'Patch report was not saved for later reopening.');
      }
      setPatchReport(savedReport);
      setSuccessMessage(report.failedCount > 0
        ? `Requested ${report.successCount} Salt patch runs. ${report.failedCount} device(s) failed.`
        : `Requested ${report.successCount} Salt patch runs for ${scopeLabel.toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to run batch patch update');
    } finally {
      setRunningBatch(false);
    }
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

  const startScriptDraft = (kind: AuthoredTemplateKind) => {
    setIsCreatingScriptDraft(true);
    setSelectedScriptId('');
    setScriptDraft(createEmptyTemplateDraft(kind));
    setError('');
    setSuccessMessage('');
    setActiveSubView('terminal');
  };

  const saveScriptDraft = () => {
    if (!canAuthorScripts) {
      setError('Script creation is limited to super admin accounts.');
      return;
    }

    const name = scriptDraft.name.trim();
    if (!name) {
      setError('Script name is required.');
      return;
    }
    if (scriptDraft.kind === 'sls' && !scriptDraft.stateName.trim()) {
      setError('SLS templates require a state name.');
      return;
    }
    if (scriptDraft.kind === 'shell' && !scriptDraft.content.trim()) {
      setError('Shell scripts require script content.');
      return;
    }

    const nextTemplate: AuthoredSaltTemplate = {
      id: selectedScriptId || `patch-script-${Date.now()}`,
      kind: scriptDraft.kind,
      name,
      description: scriptDraft.description.trim(),
      stateName: scriptDraft.stateName.trim(),
      content: scriptDraft.content,
      updatedAt: new Date().toISOString(),
    };

    const nextTemplates = [nextTemplate, ...authoredTemplates.filter((template) => template.id !== nextTemplate.id)];
    setAuthoredTemplates(nextTemplates);
    setIsCreatingScriptDraft(false);
    setSelectedScriptId(nextTemplate.id);
    setSuccessMessage(nextTemplate.kind === 'sls' ? 'Saved Salt state template.' : 'Saved shell script.');
    setError('');

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SALT_TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    }
  };

  const deleteSelectedScript = () => {
    if (!canAuthorScripts) {
      setError('Script deletion is limited to super admin accounts.');
      return;
    }
    if (!selectedScriptId) {
      return;
    }

    const nextTemplates = authoredTemplates.filter((template) => template.id !== selectedScriptId);
    setAuthoredTemplates(nextTemplates);
    setIsCreatingScriptDraft(false);
    setSelectedScriptId('');
    setScriptDraft(createEmptyTemplateDraft());
    setSuccessMessage('Removed saved script.');
    setError('');

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SALT_TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_22%),linear-gradient(180deg,_#f4f7f8_0%,_#eef3f5_44%,_#f8fafb_100%)] p-4 sm:p-6">
      {(patchReport || reportInteractionShieldVisible) ? <div aria-hidden="true" className="fixed inset-0 z-[89]" /> : null}

      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f9ff_100%)] shadow-sm">
        <div className="space-y-3 p-5 lg:p-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">
              <Activity className="mr-2 h-3.5 w-3.5" />
              Patch Workspace
            </div>
            <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Patch workspace for systems and terminal operations.</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">Review fleet posture in systems, then move into terminal operations for scripts, job history, and saved reports.</p>
            <div className="mt-2 inline-flex items-center rounded-full border border-sky-100 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
              {selectedDepartmentLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setActiveSubView('systems')}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-black !text-slate-950 transition ${activeSubView === 'systems' ? 'border-sky-300 bg-sky-100 shadow-lg shadow-sky-500/20' : 'border-white/60 bg-white hover:bg-slate-100'}`}
              >
                <Activity className="h-4 w-4" />
                Systems
                <span className={`rounded-full px-2 py-0.5 text-[11px] !text-slate-950 ${activeSubView === 'systems' ? 'bg-white' : 'bg-slate-100'}`}>{visibleDevices.length}</span>
              </button>
              {canViewReports ? (
                <button
                  type="button"
                  onClick={() => setActiveSubView('terminal')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-black !text-slate-950 transition ${activeSubView === 'terminal' ? 'border-sky-300 bg-sky-100 shadow-lg shadow-sky-500/20' : 'border-white/60 bg-white hover:bg-slate-100'}`}
                >
                  <TerminalSquare className="h-4 w-4" />
                  Terminal
                  <span className={`rounded-full px-2 py-0.5 text-[11px] !text-slate-950 ${activeSubView === 'terminal' ? 'bg-white' : 'bg-slate-100'}`}>{terminalWorkspaceCount}</span>
                </button>
              ) : null}
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

      {activeSubView === 'systems' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f5f8fa_100%)] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Dashboard</div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Patch status counts across the current fleet scope</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">See up-to-date systems, systems that still need updates, offline devices, and failed patch posture before acting.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  {selectedDepartmentLabel} in view
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Managed devices', value: scopedMetrics.total, icon: Activity, tone: 'border-slate-200 bg-white text-slate-950' },
                { label: 'Healthy systems', value: scopedMetrics.upToDate, icon: ShieldCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
                { label: 'Need updates', value: scopedMetrics.pending, icon: RefreshCw, tone: 'border-sky-200 bg-sky-50 text-sky-950' },
                { label: 'Offline systems', value: offlineSystemsCount, icon: WifiOff, tone: 'border-amber-200 bg-amber-50 text-amber-950' },
                { label: 'Failed', value: scopedMetrics.failed, icon: ShieldAlert, tone: 'border-rose-200 bg-rose-50 text-rose-950' },
                { label: 'Reboot pending', value: scopedMetrics.rebootPending, icon: Wifi, tone: 'border-slate-200 bg-slate-50 text-slate-950' },
              ].map((card) => (
                <div key={card.label} className={`rounded-[24px] border px-4 py-4 shadow-sm ${card.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{card.label}</span>
                    <card.icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="mt-4 text-3xl font-black leading-none">{loading ? '-' : card.value}</div>
                </div>
              ))}
            </div>
          </section>

        </>
      ) : null}

      {activeSubView === 'systems' ? (
        <>
          <section>
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#fff7ed_100%)] px-5 py-5">
                <div className="space-y-4">
                  <label className="block">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={systemsSearchQuery}
                        onChange={(event) => setSystemsSearchQuery(event.target.value)}
                        placeholder="Search systems, usernames, departments, or asset IDs"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 text-sm font-semibold text-slate-950 outline-none shadow-sm transition focus:border-sky-300"
                      />
                    </div>
                  </label>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
                    <select value={systemsStatusFilter} onChange={(event) => setSystemsStatusFilter(event.target.value as PatchSystemsStatusFilter)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                      <option value="all">All patch states</option>
                      <option value="updated">Fully updated</option>
                      <option value="pending">Needs updates</option>
                      <option value="offline">Offline systems</option>
                    </select>
                    <select value={selectedDepartments.length === 1 ? selectedDepartments[0] : 'all'} onChange={(event) => setSelectedDepartments(event.target.value === 'all' ? [] : [event.target.value])} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                      <option value="all">All departments</option>
                      {selectableDepartments.map((department) => <option key={`systems-filter-${department}`} value={department}>{department}</option>)}
                    </select>
                    <select value={systemsAppFilter} onChange={(event) => setSystemsAppFilter(event.target.value as PatchSystemsAppFilter)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                      <option value="all">All app coverage</option>
                      <option value="needs-app-updates">Needs app updates</option>
                      <option value="salt-ready">Salt ready</option>
                    </select>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleBatchRun(filteredSystemDevices)}
                        disabled={!canOperate || runningBatch || filteredSystemDevices.length === 0}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {runningBatch ? 'Running...' : `Patch ${systemsSearchQuery.trim() ? 'search results' : selectedDepartments.length === 0 ? 'all visible systems' : selectedDepartmentLabel}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`${basePath}/salt?tab=execution`)}
                        disabled={!canOperate || openingConsoleDeviceId !== '' || visibleDevices.length === 0}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Open Salt terminal
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`${basePath}/patch/devices`)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50"
                      >
                        Full device list
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-5">
                {loading ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">Loading systems for this department...</div>
                ) : systemsPreview.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">{systemsSearchQuery.trim() ? 'No systems matched the current search.' : 'No managed systems found for the current department filter.'}</div>
                ) : (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {systemsPreview.map((device) => {
                      const progress = getPatchProgressValue(device.complianceScore);
                      const appBuckets = getInstalledAppBuckets(device);
                      const systemDisplayId = getSystemDisplayId(device);
                      const isFullyUpdated = progress === 100;
                      return (
                        <div key={`systems-${device.id}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => navigate(`${basePath}/devices/${device.id}`)} className="truncate text-left text-base font-black text-slate-950 transition hover:text-brand-700">
                                  {systemDisplayId}
                                </button>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getPatchStatusBadgeClassName(device.patchStatus)}`}>
                                  {formatPatchStatusLabel(device.patchStatus)}
                                </span>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${isFullyUpdated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {isFullyUpdated ? '100% updated' : 'Not 100% updated'}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <span className="font-black uppercase tracking-[0.14em] text-slate-400">System ID</span>
                                  <div className="mt-1 text-sm font-semibold text-slate-700">{systemDisplayId}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <span className="font-black uppercase tracking-[0.14em] text-slate-400">Username</span>
                                  <div className="mt-1 text-sm font-semibold text-slate-700">{device.user?.fullName || 'No assigned user'}</div>
                                </div>
                              </div>
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                  <span>Updated status</span>
                                  <span>{progress}%</span>
                                </div>
                                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-[linear-gradient(90deg,_#0ea5e9_0%,_#10b981_100%)]" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="mt-2 text-xs font-semibold text-slate-500">{isFullyUpdated ? 'This system is fully updated.' : 'This system still has pending updates.'}</div>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Updated apps</div>
                                  <div className="mt-2 text-sm font-semibold text-emerald-900">{appBuckets.updated.length > 0 ? appBuckets.updated.map((app) => app.label).join(', ') : 'No updated apps reported'}</div>
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
                                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">Not updated apps</div>
                                  <div className="mt-2 text-sm font-semibold text-amber-900">{appBuckets.pending.length > 0 ? appBuckets.pending.map((app) => app.label).join(', ') : 'All tracked apps updated'}</div>
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px] lg:max-w-[320px] lg:flex-none">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextIndex = filteredSystemDevices.findIndex((entry) => entry.id === device.id);
                                  if (nextIndex >= 0) {
                                    void openSaltConsoleWithNavigation(filteredSystemDevices, nextIndex, buildSaltActionConsolePrefill('system-update', '', device.osName));
                                    return;
                                  }
                                  void openSaltConsole(device, buildSaltActionConsolePrefill('system-update', '', device.osName));
                                }}
                                disabled={!canOperate || openingConsoleDeviceId === device.id}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                {openingConsoleDeviceId === device.id ? 'Opening...' : 'Run patch'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`${basePath}/salt?tab=execution&assetId=${encodeURIComponent(device.id)}`);
                                }}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                              >
                                <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                                Open Salt terminal
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredSystemDevices.length > systemsPreview.length ? (
                  <div className="mt-3 text-xs text-slate-500">Showing the first {systemsPreview.length} systems here. Use the search box to narrow results further.</div>
                ) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeSubView === 'terminal' ? (
        <>
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f5f8fa_100%)] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Terminal workspace</div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Saved scripts, job history, and report archive</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Use this workspace for Salt execution support, saved templates, historical runs, and the latest verified patch reports.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                    {terminalHistoryCount} job history records
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/salt?tab=execution`)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50"
                  >
                    <TerminalSquare className="h-4 w-4" />
                    Open Salt terminal
                  </button>
                </div>
              </div>
            </div>
          </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.84fr)_minmax(0,1.16fr)]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_100%)] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scripts</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Saved Salt states and shell scripts</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Salt execution reads from this shared library. Use Salt Terminal only to run items against the selected department scope.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{sortedAuthoredTemplates.length} saved</div>
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => startScriptDraft('sls')} disabled={!canAuthorScripts} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60">Create .sls</button>
                <button type="button" onClick={() => startScriptDraft('shell')} disabled={!canAuthorScripts} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60">Create .sh</button>
              </div>

              {sortedAuthoredTemplates.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No saved scripts yet. Create one here, then select it from Salt Terminal when you run `state.apply` or `cmd.script`.</div>
              ) : (
                <div className="space-y-3">
                  {sortedAuthoredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setIsCreatingScriptDraft(false);
                        setSelectedScriptId(template.id);
                      }}
                      className={`block w-full rounded-[24px] border px-4 py-4 text-left transition ${selectedScriptId === template.id ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-950">{template.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{template.kind === 'sls' ? template.stateName || 'No state name' : 'Shell script'}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${template.kind === 'sls' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{template.kind === 'sls' ? '.sls' : '.sh'}</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs text-slate-500">{template.description || 'No description added.'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffaf0_0%,_#f8fafc_100%)] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Editor</div>
                  <h2 className="mt-2 text-xl font-black text-slate-950">{selectedScriptId ? 'Update selected script' : 'Create a new script'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Current department scope: {selectedDepartmentLabel}. Salt Terminal will show these saved items when operators pick `state.apply` or `cmd.script`.</p>
                </div>
                {!canAuthorScripts ? <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase text-amber-700">Super admin only</div> : null}
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Script name</div>
                  <input value={scriptDraft.name} onChange={(event) => setScriptDraft((current) => ({ ...current, name: event.target.value }))} placeholder="monthly-security-rollup" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300" />
                </label>
                <label>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Script type</div>
                  <select value={scriptDraft.kind} onChange={(event) => setScriptDraft((current) => ({
                    ...current,
                    kind: event.target.value as AuthoredTemplateKind,
                    stateName: event.target.value === 'sls' ? (current.stateName || 'patch.run') : '',
                  }))} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-300">
                    <option value="sls">.sls state</option>
                    <option value="shell">.sh script</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Description</div>
                <input value={scriptDraft.description} onChange={(event) => setScriptDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Describe when operators should run this item" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
              </label>

              {scriptDraft.kind === 'sls' ? (
                <label className="block">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">State name</div>
                  <input value={scriptDraft.stateName} onChange={(event) => setScriptDraft((current) => ({ ...current, stateName: event.target.value }))} placeholder="patch.run" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300" />
                </label>
              ) : null}

              <label className="block">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{scriptDraft.kind === 'sls' ? 'State notes or body' : 'Shell script body'}</div>
                <textarea value={scriptDraft.content} onChange={(event) => setScriptDraft((current) => ({ ...current, content: event.target.value }))} rows={12} placeholder={scriptDraft.kind === 'sls' ? 'Optional state notes for operators' : '#!/bin/sh\necho hello'} className="mt-1.5 w-full rounded-[24px] border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-sm text-emerald-300 outline-none transition focus:border-sky-300" />
              </label>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">{scriptDraft.kind === 'sls' ? 'Salt Terminal will expose this under `state.apply` and send the saved state name to the backend.' : 'Salt Terminal will expose this under `cmd.script` and send the saved script body through the guarded backend command path.'}</div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveScriptDraft} disabled={!canAuthorScripts} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60">{selectedScriptId ? 'Update script' : 'Save script'}</button>
                <button type="button" onClick={deleteSelectedScript} disabled={!canAuthorScripts || !selectedScriptId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:opacity-60">Delete script</button>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_100%)] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Terminal Job History</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Recent Salt terminal runs and rollout records.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Patch owns the audit trail for terminal-triggered runs. Review the last automation requests here without switching back into Salt Terminal.</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{terminalHistoryCount} records</div>
            </div>
          </div>
          <div className="space-y-4 px-5 py-5">
            {saltJobHistory.length ? saltJobHistory.map((entry) => (
              <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{entry.scopeLabel}</div>
                    <div className="mt-2 text-lg font-black text-slate-950">{entry.successCount} succeeded, {entry.failedCount} failed across {entry.rowCount} endpoints</div>
                    <div className="mt-1 text-sm text-slate-500">Requested {formatReportTimestamp(entry.requestedAt)} • Completed {formatReportTimestamp(entry.completedAt)}</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{entry.requestedBy || 'IT automation'}</div>
                </div>
              </div>
            )) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">No Salt terminal job history is available yet for the current scope.</div>}
          </div>
        </section>

      {canViewReports ? (
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
                    {filteredRecentReports.length > 5 ? (
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
      ) : null}
        </>
      ) : null}
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