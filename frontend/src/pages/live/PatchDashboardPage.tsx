import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, Search, ShieldAlert, ShieldCheck, FolderOpen, Funnel, Download, TerminalSquare, Wifi, WifiOff, Building2, FileText } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import DepartmentSaltConsolePickerModal, { type DepartmentConsoleDevice } from '../../components/DepartmentSaltConsolePickerModal';
import EmbeddedConsoleModal, { buildEmbeddedSaltConsoleState, type EmbeddedConsoleState } from '../../components/EmbeddedConsoleModal';
import PatchRunReportModal from '../../components/PatchRunReportModal';
import { resolveSaltTarget, type BootstrapDeviceLike } from '../../lib/bootstrap';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, downloadPatchRunReportCsv, filterPatchRunReports, listPatchReportDepartments, normalizePatchRunReport, sortPatchRunReports, type PatchRunExecutionResponse, type PatchRunReport, type PatchRunReportDateRange, type PatchRunReportSort, type PatchRunReportSummary } from '../../lib/patchReports';
import { buildSaltActionConsolePrefill } from '../../lib/salt';
import { getStoredSession } from '../../lib/session';
import { assetPresenceState } from '../../components/users/userDisplayUtils';
import { shouldResetOpeningReportId } from './patchDashboardState';

interface PatchMetrics {
  total: number;
  upToDate: number;
  pending: number;
  failed: number;
  rebootPending: number;
}

interface PatchDevice {
  id: string;
  hostname: string;
  patchStatus?: string;
  complianceScore: number;
  osName?: string | null;
  lastSeenAt?: string | null;
  department?: { name: string } | null;
  user?: { fullName: string } | null;
}

interface DepartmentPresenceSummary {
  name: string;
  total: number;
  online: number;
  offline: number;
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserMetaOptionsResponse {
  departments: LookupOption[];
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
  kind: 'device' | 'department';
  index: number;
  items: PatchDevice[] | DepartmentConsoleDevice[];
  prefilledCommand?: string;
};

const REPORT_DATE_RANGES: PatchRunReportDateRange[] = ['all', '7d', '30d', '90d'];
const REPORT_SORT_OPTIONS: PatchRunReportSort[] = ['newest', 'oldest', 'most-failures', 'most-successes'];

export function buildPatchMetrics(devices: PatchDevice[]): PatchMetrics {
  return devices.reduce<PatchMetrics>((summary, device) => {
    summary.total += 1;
    if (device.patchStatus === 'up_to_date') {
      summary.upToDate += 1;
    } else if (device.patchStatus === 'pending') {
      summary.pending += 1;
    } else if (device.patchStatus === 'failed') {
      summary.failed += 1;
    } else if (device.patchStatus === 'reboot_pending') {
      summary.rebootPending += 1;
    }
    return summary;
  }, { total: 0, upToDate: 0, pending: 0, failed: 0, rebootPending: 0 });
}

export function formatPatchStatusLabel(status?: string | null) {
  const normalizedStatus = (status || '').trim();
  return normalizedStatus ? normalizedStatus.replaceAll('_', ' ') : 'Unknown';
}

export function getPatchStatusBadgeClassName(status?: string | null) {
  if (status === 'failed') {
    return 'bg-red-100 text-red-700';
  }
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'up_to_date') {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-zinc-100 text-zinc-700';
}

export function isDeviceOnline(device: PatchDevice) {
  return assetPresenceState(device.lastSeenAt).label === 'Recently Seen';
}

export function buildDepartmentPresenceSummary(devices: PatchDevice[]) {
  const summaryByDepartment = new Map<string, DepartmentPresenceSummary>();

  devices.forEach((device) => {
    const departmentName = device.department?.name?.trim() || 'Unassigned';
    const current = summaryByDepartment.get(departmentName) || {
      name: departmentName,
      total: 0,
      online: 0,
      offline: 0,
    };

    current.total += 1;
    if (isDeviceOnline(device)) {
      current.online += 1;
    } else {
      current.offline += 1;
    }

    summaryByDepartment.set(departmentName, current);
  });

  return Array.from(summaryByDepartment.values()).sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }
    return left.name.localeCompare(right.name);
  });
}

export function formatReportTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

export function renderPackageChangeSummary(row: PatchRunReport['rows'][number]) {
  if (row.packageChanges.length > 0) {
    return (
      <div className="mt-2 space-y-2">
        {row.packageChanges.slice(0, 6).map((change) => (
          <div key={`${row.deviceId}-${change.name}-${change.fromVersion || ''}-${change.toVersion || ''}`} className="rounded-xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-3 py-3 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">{change.name}</div>
            <div className="mt-1 text-xs text-zinc-600">
              {change.fromVersion && change.toVersion ? `${change.fromVersion} -> ${change.toVersion}` : change.toVersion ? `+ ${change.toVersion}` : change.fromVersion ? `${change.fromVersion} -> removed` : 'Version details unavailable'}
            </div>
          </div>
        ))}
        {row.packageChanges.length > 6 ? <div className="text-xs text-zinc-500">+ {row.packageChanges.length - 6} more package change(s)</div> : null}
      </div>
    );
  }

  return <div className="mt-2 text-sm leading-6 text-zinc-700">{row.updatedItems.length > 0 ? row.updatedItems.join(', ') : row.message}</div>;
}

export function shouldShowReportRowMessage(row: PatchRunReport['rows'][number]) {
  const normalizedMessage = row.message.trim();
  if (!normalizedMessage) {
    return false;
  }

  if (row.packageChanges.length > 0) {
    return true;
  }

  const normalizedUpdatedItems = row.updatedItems.join(', ').trim();
  return !normalizedUpdatedItems || normalizedUpdatedItems !== normalizedMessage;
}

export function getFeaturedReportTone(failedCount: number) {
  return failedCount > 0
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function parseReportDateRange(value: string | null): PatchRunReportDateRange {
  if (value && REPORT_DATE_RANGES.includes(value as PatchRunReportDateRange)) {
    return value as PatchRunReportDateRange;
  }
  return '30d';
}

export function parseReportSort(value: string | null): PatchRunReportSort {
  if (value && REPORT_SORT_OPTIONS.includes(value as PatchRunReportSort)) {
    return value as PatchRunReportSort;
  }
  return 'newest';
}

export function parsePatchWorkspaceView(value: string | null, canViewReports: boolean): 'systems' | 'terminal' {
  const normalizedValue = (value || '').trim().toLowerCase();
  if (canViewReports && (normalizedValue === 'terminal' || normalizedValue === 'reports')) {
    return 'terminal';
  }
  return 'systems';
}

export default function PatchDashboardPage() {
  const reportInteractionBlockUntilRef = useRef(0);
  const reportInteractionShieldTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/patch')[0];
  const session = getStoredSession();
  const canOperate = ['super_admin', 'it_team'].includes((session?.user.role || '').toLowerCase());
  const canViewReports = canOperate;
  const [activeSubView, setActiveSubView] = useState<'department' | 'reports'>(() => {
    const requestedView = parsePatchWorkspaceView(new URLSearchParams(location.search).get('view'), canViewReports);
    return requestedView === 'terminal' ? 'reports' : 'department';
  });
  const [metrics, setMetrics] = useState<PatchMetrics | null>(null);
  const [devices, setDevices] = useState<PatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState(() => new URLSearchParams(location.search).get('department')?.trim() || 'all');
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [runningBatch, setRunningBatch] = useState(false);
  const [openingConsoleDeviceId, setOpeningConsoleDeviceId] = useState('');
  const [departmentConsoleDevices, setDepartmentConsoleDevices] = useState<DepartmentConsoleDevice[]>([]);
  const [departmentConsolePickerOpen, setDepartmentConsolePickerOpen] = useState(false);
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [embeddedConsoleNavigation, setEmbeddedConsoleNavigation] = useState<EmbeddedConsoleNavigationState | null>(null);
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [recentReports, setRecentReports] = useState<PatchRunReportSummary[]>([]);
  const [openingReportId, setOpeningReportId] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState('');
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState(() => new URLSearchParams(location.search).get('reportDepartment')?.trim() || 'all');
  const [reportDateRange, setReportDateRange] = useState<PatchRunReportDateRange>(() => parseReportDateRange(new URLSearchParams(location.search).get('reportRange')));
  const [reportSearchQuery, setReportSearchQuery] = useState(() => new URLSearchParams(location.search).get('reportQuery')?.trim() || '');
  const [reportSort, setReportSort] = useState<PatchRunReportSort>(() => parseReportSort(new URLSearchParams(location.search).get('reportSort')));
  const [showAllReports, setShowAllReports] = useState(() => new URLSearchParams(location.search).get('reportsExpanded') === '1');
  const [featuredReport, setFeaturedReport] = useState<PatchRunReport | null>(null);
  const [featuredReportLoading, setFeaturedReportLoading] = useState(false);
  const [reportInteractionShieldVisible, setReportInteractionShieldVisible] = useState(false);
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

        const params = new URLSearchParams();
        if (selectedDepartment !== 'all') {
          params.set('department', selectedDepartment);
        }
        const devicesData = await apiRequest<PatchDevice[]>(`/api/patch/devices${params.toString() ? `?${params.toString()}` : ''}`);

        if (!cancelled) {
          setDevices(devicesData || []);
          setMetrics(buildPatchMetrics(devicesData || []));
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
  }, [selectedDepartment]);

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      try {
        const meta = await apiRequest<UserMetaOptionsResponse>('/api/users/meta/options');
        let reportData: PatchRunReportSummary[] = [];
        if (canViewReports) {
          reportData = await apiRequest<PatchRunReportSummary[]>('/api/patch/reports');
        }
        if (!cancelled) {
          setDepartments(['all', ...Array.from(new Set((meta.departments || []).map((department) => department.name).filter(Boolean))).sort()]);
          setRecentReports(reportData || []);
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

  const topDevices = useMemo(() => devices.slice(0, 8), [devices]);
  const departmentSystemsLabel = selectedDepartment === 'all' ? 'All Systems' : `${selectedDepartment} Systems`;
  const reportDepartmentOptions = useMemo(() => listPatchReportDepartments(recentReports), [recentReports]);
  const filteredRecentReports = useMemo(() => filterPatchRunReports(recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery), [recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery]);
  const sortedRecentReports = useMemo(() => sortPatchRunReports(filteredRecentReports, reportSort), [filteredRecentReports, reportSort]);
  const visibleRecentReports = useMemo(() => showAllReports ? sortedRecentReports : sortedRecentReports.slice(0, 5), [sortedRecentReports, showAllReports]);
  const totalReportsCount = useMemo(() => recentReports.length, [recentReports]);
  const filteredFailedReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount > 0).length, [filteredRecentReports]);
  const filteredSuccessfulReportsCount = useMemo(() => filteredRecentReports.filter((report) => report.failedCount === 0).length, [filteredRecentReports]);
  const filteredReportDepartmentsCount = useMemo(() => new Set(filteredRecentReports.flatMap((report) => report.departments || [])).size, [filteredRecentReports]);
  const onlineSystemsCount = useMemo(() => devices.filter((device) => isDeviceOnline(device)).length, [devices]);
  const offlineSystemsCount = useMemo(() => devices.length - onlineSystemsCount, [devices.length, onlineSystemsCount]);
  const departmentPresenceSummary = useMemo(() => buildDepartmentPresenceSummary(devices), [devices]);
  const selectedDepartmentPresence = useMemo(() => {
    if (selectedDepartment === 'all') {
      return {
        name: 'All departments',
        total: devices.length,
        online: onlineSystemsCount,
        offline: offlineSystemsCount,
      };
    }

    return departmentPresenceSummary.find((entry) => entry.name === selectedDepartment) || {
      name: selectedDepartment,
      total: devices.length,
      online: onlineSystemsCount,
      offline: offlineSystemsCount,
    };
  }, [departmentPresenceSummary, devices.length, offlineSystemsCount, onlineSystemsCount, selectedDepartment]);
  const featuredReportSummary = useMemo(() => {
    const scopedReports = sortPatchRunReports(filterPatchRunReports(recentReports, selectedDepartment, 'all', ''), 'newest');
    return scopedReports[0] || sortPatchRunReports(recentReports, 'newest')[0] || null;
  }, [recentReports, selectedDepartment]);
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
    if (requestedView === 'reports' && canViewReports) {
      if (activeSubView !== 'reports') {
        setActiveSubView('reports');
      }
    } else if (requestedReportId && canViewReports) {
      if (activeSubView !== 'reports') {
        setActiveSubView('reports');
      }
    } else if (activeSubView !== 'department') {
      setActiveSubView('department');
    }

    const requestedDepartment = new URLSearchParams(location.search).get('department')?.trim() || 'all';
    if (selectedDepartment !== requestedDepartment) {
      setSelectedDepartment(requestedDepartment);
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

  }, [activeSubView, canViewReports, location.search, reportDateRange, reportDepartmentFilter, reportSearchQuery, reportSort, selectedDepartment, showAllReports]);

  useEffect(() => {
    const requestedReportId = new URLSearchParams(location.search).get('reportId')?.trim();
    if (shouldResetOpeningReportId(openingReportId, patchReport, requestedReportId)) {
      setOpeningReportId('');
    }
  }, [location.search, openingReportId, patchReport]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedReportId = params.get('reportId')?.trim();

    if (activeSubView === 'reports' && canViewReports) {
      params.set('view', 'reports');
    } else {
      params.delete('view');
    }

    if (selectedDepartment !== 'all') {
      params.set('department', selectedDepartment);
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
  }, [activeSubView, canViewReports, location.pathname, location.search, navigate, patchReport?.id, reportDateRange, reportDepartmentFilter, reportSearchQuery, reportSort, selectedDepartment, showAllReports]);

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

  const openDepartmentSaltConsole = async () => {
    if (!canOperate) {
      return;
    }

    if (devices.length === 0) {
      setError('No managed systems are available for the current department filter.');
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      const candidates = (await Promise.all(devices.map(async (device) => {
        try {
          const detail = await apiRequest<PatchDeviceConsoleDetails>(`/api/devices/${device.id}`);
          const minionId = resolveSaltTarget(detail as BootstrapDeviceLike);
          if (!minionId) {
            return null;
          }

          return {
            id: device.id,
            hostname: detail.hostname || device.hostname,
            osName: detail.osName || device.osName,
            minionId,
            department: device.department,
            user: device.user,
          } satisfies DepartmentConsoleDevice;
        } catch {
          return null;
        }
      }))).flatMap((device) => device ? [device] : []);

      if (candidates.length === 0) {
        setError('No Salt-enabled systems are available in the current department view.');
        return;
      }

      setDepartmentConsoleDevices(candidates);
      setDepartmentConsolePickerOpen(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load Salt console targets');
    }
  };

  const openSelectedDepartmentConsole = async (device: DepartmentConsoleDevice) => {
    if (!device.minionId) {
      setError('Salt console is unavailable until this asset reports a Salt minion ID.');
      return;
    }

    setOpeningConsoleDeviceId(device.id);
    setError('');
    setDepartmentConsolePickerOpen(false);
    setEmbeddedConsole(buildEmbeddedSaltConsoleState({
      title: 'Department Salt Console',
      systemLabel: device.hostname,
      assetId: device.id,
      minionId: device.minionId,
      departmentName: device.department?.name,
      prefillCommand: '',
    }));
    setSuccessMessage(`Salt console opened for ${device.hostname} from the current department view.`);
    setOpeningConsoleDeviceId('');
  };

  const openSelectedDepartmentConsoleWithNavigation = async (items: DepartmentConsoleDevice[], index: number) => {
    const target = items[index];
    if (!target) {
      return;
    }

    setEmbeddedConsoleNavigation({ kind: 'department', items, index });
    await openSelectedDepartmentConsole(target);
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
      await openSaltConsoleWithNavigation(embeddedConsoleNavigation.items as PatchDevice[], nextIndex, embeddedConsoleNavigation.prefilledCommand);
      return;
    }

    await openSelectedDepartmentConsoleWithNavigation(embeddedConsoleNavigation.items as DepartmentConsoleDevice[], nextIndex);
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
      const scopeLabel = selectedDepartment === 'all' ? 'All departments' : `${selectedDepartment} department`;
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
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_22%),linear-gradient(180deg,_#f4f7f8_0%,_#eef3f5_44%,_#f8fafb_100%)] p-4 sm:p-6">
      {(patchReport || reportInteractionShieldVisible) ? <div aria-hidden="true" className="fixed inset-0 z-[89]" /> : null}

      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(8,15,26,0.96)_0%,_rgba(17,24,39,0.98)_52%,_rgba(30,41,59,0.98)_100%)] text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.4fr)_360px] lg:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-100">
              <Activity className="mr-2 h-3.5 w-3.5" />
              Patch Command Deck
            </div>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Patch operations with a live systems view, not a flat admin list.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Watch fleet posture, drive department-scoped Salt actions, and move straight into report history from a single operations surface built for active response.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveSubView('department')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${activeSubView === 'department' ? 'bg-white text-slate-950 shadow-lg shadow-slate-950/20' : 'border border-white/15 bg-white/8 text-slate-200 hover:bg-white/14'}`}
              >
                <Building2 className="h-4 w-4" />
                Department deck
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeSubView === 'department' ? 'bg-slate-950 text-white' : 'bg-white/10 text-slate-200'}`}>{devices.length}</span>
              </button>
              {canViewReports ? (
                <button
                  type="button"
                  onClick={() => setActiveSubView('reports')}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${activeSubView === 'reports' ? 'bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/20' : 'border border-white/15 bg-white/8 text-slate-200 hover:bg-white/14'}`}
                >
                  <FileText className="h-4 w-4" />
                  Report archive
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeSubView === 'reports' ? 'bg-slate-950 text-white' : 'bg-white/10 text-slate-200'}`}>{totalReportsCount}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(`${basePath}/patch/devices`)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/14"
              >
                <FolderOpen className="h-4 w-4" />
                Open device list
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:max-w-4xl">
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Scope</div>
                <div className="mt-2 text-xl font-black text-white">{selectedDepartment === 'all' ? 'All systems' : selectedDepartment}</div>
                <div className="mt-2 text-xs text-slate-300">Current operations lane</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Control mode</div>
                <div className="mt-2 text-xl font-black text-white">{canOperate ? 'Active control' : 'Read only'}</div>
                <div className="mt-2 text-xs text-slate-300">Salt actions {canOperate ? 'enabled' : 'locked'}</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Patch pressure</div>
                <div className="mt-2 text-xl font-black text-white">{loading ? '-' : `${metrics?.pending ?? 0} pending`}</div>
                <div className="mt-2 text-xs text-slate-300">{loading ? 'Calculating live fleet posture' : `${metrics?.failed ?? 0} failed and ${metrics?.rebootPending ?? 0} reboot pending`}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08)_0%,_rgba(255,255,255,0.02)_100%)] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Mission Board</div>
                <div className="mt-2 text-lg font-black text-white">Current response posture</div>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">Healthy systems</div>
                <div className="mt-2 text-3xl font-black text-white">{loading ? '-' : metrics?.upToDate ?? 0}</div>
                <div className="mt-1 text-xs text-emerald-100/80">Devices already aligned with patch policy</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Online now</div>
                  <div className="mt-2 text-2xl font-black text-white">{loading ? '-' : onlineSystemsCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Offline watch</div>
                  <div className="mt-2 text-2xl font-black text-white">{loading ? '-' : offlineSystemsCount}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-50">
                {canOperate
                  ? 'Use the department deck for scoped patch runs, or jump into the archive when you need a verified run record.'
                  : 'Auditor access can inspect posture and scope, but interactive patch controls and report history stay disabled.'}
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

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f5f8fa_100%)] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Live Snapshot</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Fleet posture across the current patch scope</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A dense operational view for seeing pressure, coverage, and where to intervene next without opening the device table first.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {selectedDepartment === 'all' ? 'All departments in view' : `${selectedDepartment} in view`}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Managed devices', value: metrics?.total ?? 0, icon: Activity, tone: 'border-slate-200 bg-white text-slate-950' },
            { label: 'Online systems', value: onlineSystemsCount, icon: Wifi, tone: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
            { label: 'Offline systems', value: offlineSystemsCount, icon: WifiOff, tone: 'border-amber-200 bg-amber-50 text-amber-950' },
            { label: 'Pending', value: metrics?.pending ?? 0, icon: RefreshCw, tone: 'border-sky-200 bg-sky-50 text-sky-950' },
            { label: 'Failed', value: metrics?.failed ?? 0, icon: ShieldAlert, tone: 'border-rose-200 bg-rose-50 text-rose-950' },
            { label: 'Up to date', value: metrics?.upToDate ?? 0, icon: ShieldCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
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

      {activeSubView === 'department' ? (
        <>
          <section className="grid gap-4 xl:grid-cols-12">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm xl:col-span-4">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#f1f5f9_100%)] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department Control</div>
                    <h2 className="mt-2 text-xl font-black text-slate-950">Shape the run scope before you touch production systems.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Switch scope, review live presence, then decide between a Salt console session and a department-wide patch run.</p>
                  </div>
                  <Building2 className="h-5 w-5 text-brand-600" />
                </div>
              </div>
              <div className="space-y-5 px-5 py-5">
                <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Department scope
                  <select
                    value={selectedDepartment}
                    onChange={(event) => setSelectedDepartment(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                  >
                    {departments.map((department) => (
                      <option key={department} value={department}>{department === 'all' ? 'All systems' : department}</option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scope pulse</div>
                  <div className="mt-2 text-lg font-black text-slate-950">{selectedDepartment === 'all' ? 'All systems' : selectedDepartment}</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Systems</div>
                      <div className="mt-2 text-2xl font-black text-slate-950">{selectedDepartmentPresence.total}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 shadow-sm">
                      <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Online</div>
                      <div className="mt-2 text-2xl font-black text-emerald-950">{selectedDepartmentPresence.online}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 shadow-sm">
                      <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">Offline</div>
                      <div className="mt-2 text-2xl font-black text-amber-950">{selectedDepartmentPresence.offline}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => void openDepartmentSaltConsole()}
                    disabled={!canOperate || openingConsoleDeviceId !== '' || devices.length === 0}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <TerminalSquare className="mr-2 h-4 w-4" />
                    {openingConsoleDeviceId ? 'Opening console...' : 'Open Salt console'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBatchRun(devices)}
                    disabled={!canOperate || runningBatch || devices.length === 0}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {runningBatch ? 'Running department patch...' : 'Run department patch'}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm xl:col-span-8">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffaf0_0%,_#f8fafc_100%)] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department Heatline</div>
                    <h2 className="mt-2 text-xl font-black text-slate-950">See where live coverage is strong and where the fleet is cold.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Every row gives a quick department pulse so you can spot weak live rates before launching broad actions.</p>
                  </div>
                  <Activity className="h-5 w-5 text-brand-600" />
                </div>
              </div>
              <div className="space-y-3 px-5 py-5">
                {departmentPresenceSummary.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No managed systems found for the current department filter.</div>
                ) : (selectedDepartment === 'all' ? departmentPresenceSummary : [selectedDepartmentPresence]).map((entry) => (
                  <div key={entry.name} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="truncate text-base font-black text-slate-950">{entry.name}</div>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{entry.total} systems</span>
                        </div>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[linear-gradient(90deg,_#0ea5e9_0%,_#10b981_100%)]" style={{ width: `${Math.round((entry.online / Math.max(entry.total, 1)) * 100)}%` }} />
                        </div>
                        <div className="mt-2 text-xs font-semibold text-slate-500">{Math.round((entry.online / Math.max(entry.total, 1)) * 100)}% live coverage</div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Online</div>
                          <div className="mt-1 text-lg font-black text-emerald-950">{entry.online}</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-center shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">Offline</div>
                          <div className="mt-1 text-lg font-black text-amber-950">{entry.offline}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Live rate</div>
                          <div className="mt-1 text-lg font-black text-slate-950">{Math.round((entry.online / Math.max(entry.total, 1)) * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#fff7ed_100%)] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Runway</div>
                  <h2 className="mt-2 text-xl font-black text-slate-950">Launch actions and inspect the first systems in scope.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This keeps the current department visible while giving you immediate action lanes into patch execution or targeted Salt sessions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleBatchRun(devices)}
                    disabled={!canOperate || runningBatch || devices.length === 0}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {runningBatch ? 'Running...' : `Patch ${selectedDepartment === 'all' ? 'all visible systems' : selectedDepartment}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openDepartmentSaltConsole()}
                    disabled={!canOperate || openingConsoleDeviceId !== '' || devices.length === 0}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {openingConsoleDeviceId ? 'Opening...' : 'Console for this scope'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/patch/devices`)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Full device list
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{departmentSystemsLabel}</div>
                  <p className="mt-1 text-sm text-slate-500">Open the Salt console or run a patch on any visible system in the current department view.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">{devices.length} system(s)</span>
              </div>

              {loading ? (
                <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">Loading systems for this department...</div>
              ) : topDevices.length === 0 ? (
                <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No managed systems found for the current department filter.</div>
              ) : (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {topDevices.map((device) => (
                    <div key={`dashboard-system-${device.id}`} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => navigate(`${basePath}/devices/${device.id}`)} className="truncate text-left text-base font-black text-slate-950 transition hover:text-brand-700">
                              {device.hostname}
                            </button>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getPatchStatusBadgeClassName(device.patchStatus)}`}>
                              {formatPatchStatusLabel(device.patchStatus)}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">{device.osName || 'Unknown OS'}</div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">{device.user?.fullName || 'No assigned user'}</div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">{device.department?.name || 'Unassigned department'}</div>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px] lg:max-w-[320px] lg:flex-none">
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = devices.findIndex((entry) => entry.id === device.id);
                              if (nextIndex >= 0) {
                                void openSaltConsoleWithNavigation(devices, nextIndex, buildSaltActionConsolePrefill('system-update', '', device.osName));
                                return;
                              }
                              void openSaltConsole(device, buildSaltActionConsolePrefill('system-update', '', device.osName));
                            }}
                            disabled={!canOperate || openingConsoleDeviceId === device.id}
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-3 py-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            {openingConsoleDeviceId === device.id ? 'Opening...' : 'Run patch'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = devices.findIndex((entry) => entry.id === device.id);
                              if (nextIndex >= 0) {
                                void openSaltConsoleWithNavigation(devices, nextIndex);
                                return;
                              }
                              void openSaltConsole(device);
                            }}
                            disabled={!canOperate || openingConsoleDeviceId === device.id}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                            Salt console
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {devices.length > topDevices.length ? (
                <div className="mt-3 text-xs text-slate-500">Showing the first {topDevices.length} systems here. Use the device list page for the full department view.</div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {canViewReports && activeSubView === 'reports' ? (
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
      <DepartmentSaltConsolePickerModal
        open={departmentConsolePickerOpen}
        title={selectedDepartment === 'all' ? 'Choose a system from all departments' : `Choose a system from ${selectedDepartment}`}
        devices={departmentConsoleDevices}
        busyDeviceId={openingConsoleDeviceId}
        onSelect={(device) => {
          const nextIndex = departmentConsoleDevices.findIndex((entry) => entry.id === device.id);
          if (nextIndex >= 0) {
            void openSelectedDepartmentConsoleWithNavigation(departmentConsoleDevices, nextIndex);
            return;
          }
          void openSelectedDepartmentConsole(device);
        }}
        onClose={() => {
          setDepartmentConsolePickerOpen(false);
          setDepartmentConsoleDevices([]);
        }}
      />
    </div>
  );
}