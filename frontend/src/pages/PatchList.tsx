import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { apiRequest } from '../lib/api';
import PatchDepartmentFilterPanel from '../components/patch/PatchDepartmentFilterPanel';
import PatchDeviceRow from '../components/patch/PatchDeviceRow';
import PatchDeviceTablePanel from '../components/patch/PatchDeviceTablePanel';
import PatchDepartmentRunPanel from '../components/patch/PatchDepartmentRunPanel';
import PatchListFeedback from '../components/patch/PatchListFeedback';
import PatchListHeader from '../components/patch/PatchListHeader';
import PatchRecentReportsPanel from '../components/patch/PatchRecentReportsPanel';
import DepartmentSaltConsolePickerModal, { type DepartmentConsoleDevice } from '../components/DepartmentSaltConsolePickerModal';
import EmbeddedConsoleModal, { type EmbeddedConsoleState } from '../components/EmbeddedConsoleModal';
import PatchRunReportModal from '../components/PatchRunReportModal';
import Pagination from '../components/Pagination';
import { resolveSaltTarget, type BootstrapDeviceLike } from '../lib/bootstrap';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, downloadPatchRunReportCsv, filterPatchRunReports, listPatchReportDepartments, sortPatchRunReports, type PatchRunExecutionResponse, type PatchRunReport, type PatchRunReportDateRange, type PatchRunReportSort, type PatchRunReportSummary } from '../lib/patchReports';
import { buildSaltActionConsolePrefill } from '../lib/salt';
import { getStoredSession } from '../lib/session';
import { PATCH_DEVICE_READ_ONLY_REASON, patchDeviceActionsReadOnly } from '../components/patch/patchDeviceActions';

const PATCH_PAGE_SIZE = 20;

interface PatchDevice {
  id: string;
  hostname: string;
  osName?: string | null;
  status?: string | null;
  patchStatus: string;
  department?: { name?: string } | null;
  user?: { fullName?: string } | null;
  patchGroup?: { name?: string } | null;
}

interface PaginatedPatchDevicesResponse {
  items: PatchDevice[];
  total: number;
  page: number;
  pageSize: number;
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

export function buildPatchDevicesUrl(currentPage: number, searchQuery: string, selectedDepartment: string) {
  const params = new URLSearchParams({ paginate: '1', page: String(currentPage), page_size: String(PATCH_PAGE_SIZE) });
  if (searchQuery.trim()) {
    params.set('search', searchQuery.trim());
  }
  if (selectedDepartment !== 'all') {
    params.set('department', selectedDepartment);
  }
  return `/api/patch/devices?${params.toString()}`;
}

export function formatPatchDevicesTotalLabel(
  loading: boolean,
  searchQuery: string,
  selectedDepartment: string,
  totalDevices: number,
) {
  if (loading) {
    return 'Loading devices';
  }
  if (searchQuery.trim()) {
    return `${totalDevices} devices match this search`;
  }
  if (selectedDepartment !== 'all') {
    return `${totalDevices} managed devices in ${selectedDepartment}`;
  }
  return `${totalDevices} managed devices`;
}

export function formatPatchDepartmentSystemsLabel(selectedDepartment: string) {
  return selectedDepartment === 'all' ? 'Current Systems' : `${selectedDepartment} Systems`;
}

export function selectActionablePatchDevices(devices: PatchDevice[]) {
  return devices.filter((device) => !patchDeviceActionsReadOnly(device.status));
}

export function countActionablePatchDevices(devices: PatchDevice[]) {
  return selectActionablePatchDevices(devices).length;
}

export function formatPatchScopeLabel(selectedDepartment: string) {
  return selectedDepartment === 'all' ? 'All departments' : `${selectedDepartment} department`;
}

export function buildPatchBatchDevicesUrl(selectedDepartment: string) {
  const params = new URLSearchParams();
  if (selectedDepartment !== 'all') {
    params.set('department', selectedDepartment);
  }
  return `/api/patch/devices${params.toString() ? `?${params.toString()}` : ''}`;
}

export function normalizePatchDepartmentOptions(departments?: LookupOption[]) {
  return ['all', ...Array.from(new Set((departments || []).map((department) => department.name).filter(Boolean))).sort()];
}

export function derivePatchPermissions(role: string | null | undefined) {
  const canOperate = ['super_admin', 'it_team'].includes((role || '').toLowerCase());
  return {
    canOperate,
    canViewReports: canOperate,
  };
}

export function formatPatchDepartmentConsoleTitle(selectedDepartment: string) {
  return selectedDepartment === 'all' ? 'Choose a system from all departments' : `Choose a system from ${selectedDepartment}`;
}

export function summarizePatchRunRows(rows: PatchRunReport['rows']) {
  return {
    successCount: rows.filter((entry) => entry.status === 'success').length,
    failedCount: rows.filter((entry) => entry.status === 'failed').length,
  };
}

export function formatPatchRunSuccessMessage(report: Pick<PatchRunReport, 'successCount' | 'failedCount'>, scopeLabel: string) {
  return report.failedCount > 0
    ? `Requested ${report.successCount} Salt patch run(s). ${report.failedCount} device(s) failed.`
    : `Requested ${report.successCount} Salt patch run(s) for ${scopeLabel.toLowerCase()}.`;
}

export function selectVisiblePatchReports<T>(sortedRecentReports: T[], showAllReports: boolean) {
  return showAllReports ? sortedRecentReports : sortedRecentReports.slice(0, 5);
}

export function selectDepartmentSystems(devices: PatchDevice[]) {
  return devices.slice(0, 8);
}

export default function PatchList() {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/patch')[0];
  const session = getStoredSession();
  const { canOperate, canViewReports } = derivePatchPermissions(session?.user.role);
  const [devices, setDevices] = useState<PatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['all']);
  const [runningPatch, setRunningPatch] = useState(false);
  const [openingConsoleDeviceId, setOpeningConsoleDeviceId] = useState('');
  const [departmentConsoleDevices, setDepartmentConsoleDevices] = useState<DepartmentConsoleDevice[]>([]);
  const [departmentConsolePickerOpen, setDepartmentConsolePickerOpen] = useState(false);
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [embeddedConsoleNavigation, setEmbeddedConsoleNavigation] = useState<EmbeddedConsoleNavigationState | null>(null);
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [recentReports, setRecentReports] = useState<PatchRunReportSummary[]>([]);
  const [openingReportId, setOpeningReportId] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState('');
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState('all');
  const [reportDateRange, setReportDateRange] = useState<PatchRunReportDateRange>('30d');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSort, setReportSort] = useState<PatchRunReportSort>('newest');
  const [showAllReports, setShowAllReports] = useState(false);
  const previousSearchQueryRef = useRef(searchQuery);
  const embeddedConsoleCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const loadRecentReports = useCallback(async () => {
    if (!canViewReports) {
      setRecentReports([]);
      return;
    }
    try {
      const reports = await apiRequest<PatchRunReportSummary[]>('/api/patch/reports');
      setRecentReports(reports || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load patch reports');
    }
  }, [canViewReports]);

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

  useEffect(() => {
    let cancelled = false;

    const loadDevices = async () => {
      try {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        const data = await apiRequest<PaginatedPatchDevicesResponse>(
          buildPatchDevicesUrl(currentPage, searchQuery, selectedDepartment),
        );
        if (!cancelled) {
          setDevices(data.items || []);
          setTotalDevices(data.total || 0);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load patch devices');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const searchChanged = previousSearchQueryRef.current !== searchQuery;

    if (searchChanged && currentPage !== 1) {
      return;
    }

    previousSearchQueryRef.current = searchQuery;
    void loadDevices();

    return () => {
      cancelled = true;
    };
  }, [currentPage, searchQuery, selectedDepartment]);

  useEffect(() => {
    let cancelled = false;

    const loadDepartmentOptions = async () => {
      try {
        const data = await apiRequest<UserMetaOptionsResponse>('/api/users/meta/options');
        if (!cancelled) {
          setDepartmentOptions(normalizePatchDepartmentOptions(data.departments));
        }
      } catch {
        if (!cancelled) {
          setDepartmentOptions(normalizePatchDepartmentOptions());
        }
      }
    };

    void loadDepartmentOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage((page) => (page === 1 ? page : 1));
  }, [searchQuery, selectedDepartment]);

  useEffect(() => {
    if (!canViewReports) {
      setRecentReports([]);
      return;
    }
    void loadRecentReports();
  }, [canViewReports, loadRecentReports]);

  const totalLabel = useMemo(() => {
    return formatPatchDevicesTotalLabel(loading, searchQuery, selectedDepartment, totalDevices);
  }, [loading, searchQuery, selectedDepartment, totalDevices]);

  const reportDepartmentOptions = useMemo(() => listPatchReportDepartments(recentReports), [recentReports]);
  const filteredRecentReports = useMemo(() => filterPatchRunReports(recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery), [recentReports, reportDepartmentFilter, reportDateRange, reportSearchQuery]);
  const sortedRecentReports = useMemo(() => sortPatchRunReports(filteredRecentReports, reportSort), [filteredRecentReports, reportSort]);
  const visibleRecentReports = useMemo(() => selectVisiblePatchReports(sortedRecentReports, showAllReports), [sortedRecentReports, showAllReports]);
  const departmentSystemsLabel = formatPatchDepartmentSystemsLabel(selectedDepartment);
  const departmentSystems = useMemo(() => selectDepartmentSystems(devices), [devices]);
  const actionableDeviceCount = useMemo(() => countActionablePatchDevices(devices), [devices]);

  const runDepartmentPatch = async () => {
    if (!canOperate) {
      return;
    }

    if (totalDevices === 0) {
      return;
    }

    try {
      setRunningPatch(true);
      setError('');
      setSuccessMessage('');
      const requestedAt = new Date().toISOString();
      const scopeLabel = formatPatchScopeLabel(selectedDepartment);
      const batchDevices = await apiRequest<PatchDevice[]>(buildPatchBatchDevicesUrl(selectedDepartment));
      const actionableDevices = selectActionablePatchDevices(batchDevices);
      if (actionableDevices.length === 0) {
        setPatchReport(null);
        setError(PATCH_DEVICE_READ_ONLY_REASON);
        return;
      }
      setPatchReport(createPatchRunProgressReport(scopeLabel, requestedAt, actionableDevices.length));
      const rows = await Promise.all(actionableDevices.map(async (device) => {
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
          const { successCount, failedCount } = summarizePatchRunRows(nextRows);
          return {
            ...current,
            rows: nextRows,
            successCount,
            failedCount,
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
        await loadRecentReports();
      } catch (saveError) {
        setError(saveError instanceof Error ? `${saveError.message} Report was not saved for later reopening.` : 'Patch report was not saved for later reopening.');
      }
      setPatchReport(savedReport);
      setSuccessMessage(formatPatchRunSuccessMessage(report, scopeLabel));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to run patch');
    } finally {
      setRunningPatch(false);
    }
  };

  const reopenPatchReport = async (reportId: string) => {
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

  const openSaltConsole = async (device: PatchDevice, prefilledCommand?: string) => {
    if (!canOperate) {
      return;
    }

    if (patchDeviceActionsReadOnly(device.status)) {
      setError(PATCH_DEVICE_READ_ONLY_REASON);
      setSuccessMessage('');
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

      setEmbeddedConsole({
        kind: 'salt',
        title: 'Salt Console',
        subtitle: `${detail.hostname || device.hostname} • ${minionId}`,
        minionId,
        prefillCommand: prefilledCommand || buildSaltActionConsolePrefill('system-update', '', detail.osName || device.osName),
      });
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

    const actionableDevices = selectActionablePatchDevices(devices);

    if (devices.length === 0) {
      setError('No managed systems are available for the current department filter.');
      return;
    }

    if (actionableDevices.length === 0) {
      setError(PATCH_DEVICE_READ_ONLY_REASON);
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      const candidates = (await Promise.all(actionableDevices.map(async (device) => {
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
    setEmbeddedConsole({
      kind: 'salt',
      title: 'Department Salt Console',
      subtitle: `${device.hostname} • ${device.minionId}`,
      minionId: device.minionId,
      prefillCommand: '',
    });
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

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.08),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#f2f7fb_100%)] p-4 sm:p-6">
      <PatchListHeader
        basePath={basePath}
        navigate={navigate}
        canOperate={canOperate}
        runningPatch={runningPatch}
        selectedDepartment={selectedDepartment}
        totalDevices={totalDevices}
        PlayIcon={Play}
        onRunDepartmentPatch={() => { void runDepartmentPatch(); }}
      />

      {!canOperate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Auditor access is view-only on patch operations. You can review device status, but patch runs, Salt console actions, and report history are disabled.
        </div>
      ) : null}

      <div className={`grid gap-4 ${canViewReports ? 'lg:grid-cols-[minmax(0,1fr)_240px_320px]' : 'lg:grid-cols-[minmax(0,1fr)_240px]'}`}>
        <PatchDepartmentRunPanel
          runningPatch={runningPatch}
          canOperate={canOperate}
          openingConsoleDeviceId={openingConsoleDeviceId}
          totalDevices={totalDevices}
          actionableDeviceCount={actionableDeviceCount}
          departmentSystemsLabel={departmentSystemsLabel}
          loading={loading}
          departmentSystems={departmentSystems}
          onRunDepartmentPatch={() => { void runDepartmentPatch(); }}
          onOpenDepartmentSaltConsole={() => { void openDepartmentSaltConsole(); }}
          onOpenDevice={(deviceId) => navigate(`${basePath}/devices/${deviceId}`)}
          onRunPatchForDevice={(device) => {
            const nextIndex = devices.findIndex((entry) => entry.id === device.id);
            if (nextIndex >= 0) {
              void openSaltConsoleWithNavigation(devices, nextIndex, buildSaltActionConsolePrefill('system-update', '', device.osName));
              return;
            }
            void openSaltConsole(device, buildSaltActionConsolePrefill('system-update', '', device.osName));
          }}
          onOpenConsoleForDevice={(device) => {
            const nextIndex = devices.findIndex((entry) => entry.id === device.id);
            if (nextIndex >= 0) {
              void openSaltConsoleWithNavigation(devices, nextIndex);
              return;
            }
            void openSaltConsole(device);
          }}
        />
        <PatchDepartmentFilterPanel
          selectedDepartment={selectedDepartment}
          departmentOptions={departmentOptions}
          totalDevices={totalDevices}
          onSelectedDepartmentChange={setSelectedDepartment}
        />
        {canViewReports ? (
          <PatchRecentReportsPanel
            reportDepartmentFilter={reportDepartmentFilter}
            reportDepartmentOptions={reportDepartmentOptions}
            reportDateRange={reportDateRange}
            reportSearchQuery={reportSearchQuery}
            reportSort={reportSort}
            filteredReportCount={filteredRecentReports.length}
            showAllReports={showAllReports}
            visibleRecentReports={visibleRecentReports}
            openingReportId={openingReportId}
            downloadingReportId={downloadingReportId}
            onReportDepartmentFilterChange={setReportDepartmentFilter}
            onReportDateRangeChange={setReportDateRange}
            onReportSearchQueryChange={setReportSearchQuery}
            onReportSortChange={setReportSort}
            onResetFilters={() => {
              setReportDepartmentFilter('all');
              setReportDateRange('30d');
              setReportSearchQuery('');
              setReportSort('newest');
              setShowAllReports(false);
            }}
            onToggleShowAllReports={() => setShowAllReports((value) => !value)}
            onOpenReport={(reportId) => { void reopenPatchReport(reportId); }}
            onDownloadReport={(reportId) => { void downloadSavedPatchReport(reportId); }}
          />
        ) : null}
      </div>

      <PatchListFeedback error={error} successMessage={successMessage} />

      <PatchDeviceTablePanel
        searchQuery={searchQuery}
        totalLabel={totalLabel}
        loading={loading}
        isEmpty={devices.length === 0}
        onSearchQueryChange={setSearchQuery}
        rows={devices.map((device) => (
          <PatchDeviceRow
            key={device.id}
            hostname={device.hostname}
            osName={device.osName || 'Unknown OS'}
            userFullName={device.user?.fullName || 'Unassigned'}
            departmentName={device.department?.name || 'Unknown'}
            patchGroupName={device.patchGroup?.name || 'Default Ring'}
            deviceStatus={device.status}
            patchStatus={device.patchStatus}
            canOperate={canOperate}
            isOpeningConsole={openingConsoleDeviceId === device.id}
            onOpenDevice={() => navigate(`${basePath}/devices/${device.id}`)}
            onRunPatch={() => {
              const nextIndex = devices.findIndex((entry) => entry.id === device.id);
              if (nextIndex >= 0) {
                void openSaltConsoleWithNavigation(devices, nextIndex, buildSaltActionConsolePrefill('system-update', '', device.osName));
                return;
              }
              void openSaltConsole(device, buildSaltActionConsolePrefill('system-update', '', device.osName));
            }}
            onOpenConsole={() => {
              const nextIndex = devices.findIndex((entry) => entry.id === device.id);
              if (nextIndex >= 0) {
                void openSaltConsoleWithNavigation(devices, nextIndex);
                return;
              }
              void openSaltConsole(device);
            }}
          />
        ))}
        pagination={(
          <Pagination
            currentPage={currentPage}
            totalItems={totalDevices}
            pageSize={PATCH_PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="devices"
          />
        )}
      />

      <EmbeddedConsoleModal
        consoleState={embeddedConsole}
        titleId="patch-list-embedded-console-title"
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
        title={formatPatchDepartmentConsoleTitle(selectedDepartment)}
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
      <PatchRunReportModal report={patchReport} onClose={() => setPatchReport(null)} />
    </div>
  );
}
