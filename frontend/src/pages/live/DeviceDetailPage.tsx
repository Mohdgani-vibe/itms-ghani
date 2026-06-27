import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Cpu, HardDrive, Pencil } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import PatchRunReportModal from '../../components/PatchRunReportModal';
import { type SaltActionValue } from '../../lib/salt';
import { type PatchRunReport } from '../../lib/patchReports';
import { getStoredSession } from '../../lib/session';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmbeddedConsoleModal, { type EmbeddedConsoleState } from '../../components/EmbeddedConsoleModal';
import DeviceAlertDetailModal from '../../components/devices/DeviceAlertDetailModal';
import DeviceAssignmentPanel from '../../components/devices/DeviceAssignmentPanel';
import DetailSectionCard from '../../components/devices/DetailSectionCard';
import DeviceDetailOverview from '../../components/devices/DeviceDetailOverview';
import DeviceLifecycleEditor from '../../components/devices/DeviceLifecycleEditor';
import MaintenancePanel from '../../components/devices/MaintenancePanel';
import type { DeviceAlertRecord, DeviceNetworkInterfaceRecord, DevicePatchJobRecord, DeviceTerminalSessionRecord, DeviceVolumeRecord } from '../../components/devices/types';
import { alertStatusBadgeClassName, alertStatusLabel, formatDate, formatDetailValue, severityBadgeClassName } from '../../components/devices/deviceDetailUtils';
import { deviceAssignmentActionsReadOnly } from '../../components/devices/deviceAssignmentPanelUtils';
import { deviceLifecycleActionsReadOnly } from '../../components/devices/deviceLifecycleEditorUtils';
import { useDeviceDetailAccessWorkflow } from '../../components/devices/useDeviceDetailAccessWorkflow';
import NetworkDetailsPanel from '../../components/devices/NetworkDetailsPanel';
import OtherAlertsPanel from '../../components/devices/OtherAlertsPanel';
import RemoteAccessPanel from '../../components/devices/RemoteAccessPanel';
import SaltUpdatesPanel from '../../components/devices/SaltUpdatesPanel';
import SecurityFindingsPanel from '../../components/devices/SecurityFindingsPanel';
import SoftwareInventoryPanel from '../../components/devices/SoftwareInventoryPanel';
import TerminalAccessPanel from '../../components/devices/TerminalAccessPanel';
import VolumesPanel from '../../components/devices/VolumesPanel';
import { buildDeviceDetailViewData } from './deviceDetailViewData';
import {
  alertSourceLabel,
  buildLifecycleFormState,
  dedupeAssignableUsers,
  formatLifecycleCurrency,
  formatStatusLabel,
  isComputeAsset,
  isPatchJobForDevice,
  normalizeAssignableUsers,
  parseEnrollmentDetails,
  softwareSourceLabel,
  toolStatusTone,
  type ApiUserRecord,
  type AssignableUserRecord,
  type DeviceLifecycleFormState,
  type EditableAssetRecord,
} from './deviceDetailPageUtils';

interface DeviceDetailNavigationState {
  enrollmentApprovalMessage?: string;
  approvedRequestId?: string;
}

interface EnrollmentRequestComment {
  id: string;
  author: string;
  note: string;
  createdAt: string;
}

interface EnrollmentRequestRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  notes: string;
  updatedAt: string;
  assignee: { fullName?: string };
  comments: EnrollmentRequestComment[];
}

interface PaginatedUsersResponse {
  items: ApiUserRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface DeviceRecord {
  id: string;
  assetId: string;
  cost?: string | null;
  glpiId?: number | null;
  saltMinionId?: string | null;
  wazuhAgentId?: string | null;
  anydeskId?: string | null;
  rustdeskId?: string | null;
  hostname: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  deviceType?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  processor?: string | null;
  memory?: string | null;
  storage?: string | null;
  gpu?: string | null;
  display?: string | null;
  macAddress?: string | null;
  architecture?: string | null;
  biosVersion?: string | null;
  kernelVersion?: string | null;
  osBuild?: string | null;
  lastBootAt?: string | null;
  lastSeenAt?: string | null;
  loggedInUsers?: string[];
  status: string;
  patchStatus?: string;
  alertStatus?: string;
  complianceScore: number;
  warrantyExpiresAt?: string | null;
  maintenanceUntil?: string | null;
  user?: { id: string; fullName: string; email: string; employeeCode: string; status?: string | null } | null;
  department?: { name: string } | null;
  branch?: { name: string } | null;
  network?: DeviceNetwork | null;
  installedApps?: Array<{ id: string; name: string; version?: string | null; installDate?: string | null; source?: string | null }>;
  diskLayout?: string | null;
  volumes?: DeviceVolumeRecord[];
  toolStatus?: ToolStatusMap;
}

interface DeviceNetwork {
  wired_ip?: string | null;
  wireless_ip?: string | null;
  netbird_ip?: string | null;
  dns?: string | null;
  gateway?: string | null;
  interface_stats?: Record<string, DeviceNetworkInterfaceRecord>;
}

interface ToolStatusEntry {
  status: 'linked' | 'detected' | 'installed' | 'missing';
  detail: string;
  identifier?: string | null;
  connected?: boolean;
}

interface ToolStatusMap {
  salt?: ToolStatusEntry;
  wazuh?: ToolStatusEntry;
  openscap?: ToolStatusEntry;
  clamav?: ToolStatusEntry;
}

interface InstallAgentConfig {
  saltApiConfigured: boolean;
  sshConfigured?: boolean;
}

interface PendingAssetAction {
  kind: 'unassign' | 'delete';
}

const dedicatedSecuritySources = new Set(['wazuh', 'clamav', 'openscap']);
const keySoftwareTerms = ['antigravity', 'chrome', 'google-chrome', 'salt', 'clamav', 'wps', 'netbird', 'anydesk', 'rustdesk', 'wazuh', 'openscap'];
const computeDetailSections = [
  ['hardware', 'Hardware'],
  ['operating-system', 'Operating System'],
  ['assignment', 'Assignment'],
  ['lifecycle', 'Lifecycle'],
  ['maintenance', 'Maintenance Mode'],
  ['enrollment', 'Enrollment'],
  ['network', 'Network'],
  ['volumes', 'Volumes'],
  ['software', 'Software'],
  ['remote-id', 'Remote Access & IDs'],
  ['terminal', 'SSH Terminal'],
  ['updates-salt', 'Salt Updates'],
  ['security', 'Wazuh Findings'],
  ['clamav', 'ClamScan'],
  ['openscap', 'OpenSCAP'],
  ['other-alerts', 'Other Alerts'],
] as const;
const accessoryDetailSections = [
  ['hardware', 'Inventory'],
  ['operating-system', 'Location & Assignment'],
  ['assignment', 'Assignment'],
  ['lifecycle', 'Lifecycle'],
  ['enrollment', 'Enrollment'],
  ['software', 'Asset Notes'],
] as const;
const auditorComputeDetailSections = [
  ['hardware', 'Hardware'],
  ['operating-system', 'Operating System'],
  ['assignment', 'Assignment'],
  ['lifecycle', 'Lifecycle'],
  ['network', 'Network'],
  ['volumes', 'Volumes'],
  ['software', 'Software'],
  ['security', 'Wazuh Findings'],
  ['clamav', 'ClamScan'],
  ['openscap', 'OpenSCAP'],
  ['other-alerts', 'Other Alerts'],
] as const;
const auditorAccessoryDetailSections = [
  ['hardware', 'Inventory'],
  ['operating-system', 'Location & Assignment'],
  ['assignment', 'Assignment'],
  ['lifecycle', 'Lifecycle'],
  ['software', 'Asset Notes'],
] as const;
const allDetailSectionIds = new Set<string>([...computeDetailSections, ...accessoryDetailSections].map(([sectionId]) => sectionId));

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/devices')[0];
  const session = getStoredSession();
  const role = (session?.user.role || '').toLowerCase();
  const canOperate = ['super_admin', 'it_team'].includes(role);
  const isAuditor = role === 'auditor';
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [alerts, setAlerts] = useState<DeviceAlertRecord[]>([]);
  const [patchJobs, setPatchJobs] = useState<DevicePatchJobRecord[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<DeviceTerminalSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [runningPatch, setRunningPatch] = useState(false);
  const [startingTerminal, setStartingTerminal] = useState(false);
  const [selectedSaltAction, setSelectedSaltAction] = useState<SaltActionValue>('system-update');
  const [customSaltInput, setCustomSaltInput] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [enrollmentRequest, setEnrollmentRequest] = useState<EnrollmentRequestRecord | null>(null);
  const [installConfig, setInstallConfig] = useState<InstallAgentConfig | null>(null);
  const [installConfigLoading, setInstallConfigLoading] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUserRecord[]>([]);
  const [assignmentUsersLoading, setAssignmentUsersLoading] = useState(false);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  const [selectedAssignmentUserId, setSelectedAssignmentUserId] = useState('');
  const [assigningDevice, setAssigningDevice] = useState(false);
  const [assetActionLoading, setAssetActionLoading] = useState(false);
  const [pendingAssetAction, setPendingAssetAction] = useState<PendingAssetAction | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<DeviceAlertRecord | null>(null);
  const [embeddedConsole, setEmbeddedConsole] = useState<EmbeddedConsoleState | null>(null);
  const [patchReport, setPatchReport] = useState<PatchRunReport | null>(null);
  const [editableAsset, setEditableAsset] = useState<EditableAssetRecord | null>(null);
  const [lifecycleForm, setLifecycleForm] = useState<DeviceLifecycleFormState | null>(null);
  const [lifecycleEditorOpen, setLifecycleEditorOpen] = useState(false);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [activeSection, setActiveSection] = useState('hardware');
  const alertCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const alertDialogRef = useRef<HTMLDivElement | null>(null);
  const embeddedConsoleCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const navigationState = (location.state ?? null) as DeviceDetailNavigationState | null;
  const lifecycleReadOnly = deviceLifecycleActionsReadOnly(canOperate, device?.status);
  const assignmentReadOnly = deviceAssignmentActionsReadOnly(canOperate, device?.status, device?.user?.status);

  const loadDeviceDetails = async (showLoading = true) => {
    if (!id) {
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');
      const data = await apiRequest<DeviceRecord>(`/api/devices/${id}`);
      setDevice(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load device details');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (navigationState?.enrollmentApprovalMessage) {
      setSuccessMessage(navigationState.enrollmentApprovalMessage);
    }
  }, [navigationState?.enrollmentApprovalMessage]);

  useEffect(() => {
    if (!selectedAlert) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    alertCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedAlert(null);
        return;
      }

      if (event.key !== 'Tab' || !alertDialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        alertDialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [selectedAlert]);

  useEffect(() => {
    if (!embeddedConsole) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    embeddedConsoleCloseButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmbeddedConsole(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [embeddedConsole]);

  useEffect(() => {
    let cancelled = false;

    const loadDevice = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await apiRequest<DeviceRecord>(`/api/devices/${id}`);
        if (!cancelled) {
          setDevice(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load device details');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDevice();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !device) {
      return;
    }

    if (!isComputeAsset(device)) {
      setAlerts([]);
      setPatchJobs([]);
      setTerminalSessions([]);
      setSidebarLoading(false);
      return;
    }

    let cancelled = false;

    const loadSidebarData = async () => {
      try {
        setSidebarLoading(true);
        const deviceAlerts = await apiRequest<DeviceAlertRecord[]>(`/api/devices/${id}/alerts`);
        if (cancelled) {
          return;
        }

        setAlerts(deviceAlerts);

        if (isAuditor) {
          setPatchJobs([]);
          setTerminalSessions([]);
          return;
        }

        const [allPatchJobs, sessions] = await Promise.all([
          apiRequest<DevicePatchJobRecord[]>('/api/patch/jobs'),
          apiRequest<DeviceTerminalSessionRecord[]>(`/api/terminal/session?deviceId=${id}`),
        ]);
        if (cancelled) {
          return;
        }

        setPatchJobs(allPatchJobs.filter((job) => isPatchJobForDevice(job, device)).slice(0, 6));
        setTerminalSessions(sessions);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load asset activity');
        }
      } finally {
        if (!cancelled) {
          setSidebarLoading(false);
        }
      }
    };

    void loadSidebarData();

    return () => {
      cancelled = true;
    };
  }, [device, id, isAuditor]);

  useEffect(() => {
    if (!canOperate) {
      setInstallConfig(null);
      return;
    }

    let cancelled = false;

    const loadInstallConfig = async () => {
      try {
        setInstallConfigLoading(true);
        const data = await apiRequest<InstallAgentConfig>('/api/integrations/install-config');
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
    if (!id || !canOperate) {
      setEditableAsset(null);
      setLifecycleForm(null);
      setLifecycleEditorOpen(false);
      return;
    }

    let cancelled = false;

    const loadEditableAsset = async () => {
      try {
        const asset = await apiRequest<EditableAssetRecord>(`/api/assets/${id}`);
        if (cancelled) {
          return;
        }
        setEditableAsset(asset);
        setLifecycleForm(buildLifecycleFormState(asset));
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load editable asset details');
        }
      }
    };

    void loadEditableAsset();

    return () => {
      cancelled = true;
    };
  }, [canOperate, id]);

  useEffect(() => {
    if (!device || !canOperate) {
      setEnrollmentRequest(null);
      return;
    }

    let cancelled = false;

    const loadEnrollmentRequest = async () => {
      try {
        const searchValue = device.assetId.trim() || device.hostname.trim();
        const params = new URLSearchParams({ type: 'device_enrollment' });
        if (searchValue) {
          params.set('search', searchValue);
        }
        const requests = await apiRequest<EnrollmentRequestRecord[]>(`/api/requests?${params.toString()}`);
        if (cancelled) {
          return;
        }

        const assetKey = device.assetId.trim().toLowerCase();
        const hostnameKey = device.hostname.trim().toLowerCase();
        const match = requests.find((request) => {
          if (request.type !== 'device_enrollment') {
            return false;
          }
          const details = parseEnrollmentDetails(request.description || '');
          const requestKey = (details['asset tag / host'] || '').trim().toLowerCase();
          return requestKey === assetKey || requestKey === hostnameKey;
        });

        setEnrollmentRequest(match || null);
      } catch {
        if (!cancelled) {
          setEnrollmentRequest(null);
        }
      }
    };

    void loadEnrollmentRequest();

    return () => {
      cancelled = true;
    };
  }, [canOperate, device]);

  const enrollmentDetails = useMemo(
    () => (enrollmentRequest ? parseEnrollmentDetails(enrollmentRequest.description || '') : {}),
    [enrollmentRequest],
  );

  useEffect(() => {
    if (!canOperate || !device || device.user?.id?.trim()) {
      setAssignableUsers([]);
      setAssignmentSearchQuery('');
      setSelectedAssignmentUserId('');
      return;
    }

    let cancelled = false;

    const loadAssignableUsers = async () => {
      try {
        setAssignmentUsersLoading(true);
        const requesterEmail = (enrollmentDetails['requester email'] || enrollmentDetails['email'] || '').trim();
        const employeeCode = (enrollmentDetails['employee id'] || enrollmentDetails['employee code'] || '').trim();
        const requesterName = (enrollmentDetails['requester name'] || enrollmentDetails['name'] || '').trim();
        const manualQuery = assignmentSearchQuery.trim();
        const searchTerms = manualQuery
          ? [manualQuery]
          : [requesterEmail, employeeCode, requesterName].filter(Boolean);

        if (!searchTerms.length) {
          if (!cancelled) {
            setAssignableUsers([]);
          }
          return;
        }

        const uniqueTerms = Array.from(new Set(searchTerms.map((term) => term.trim()).filter(Boolean))).slice(0, 3);
        const responses = await Promise.all(uniqueTerms.map((term) => {
          const params = new URLSearchParams({
            paginate: '1',
            page: '1',
            page_size: manualQuery ? '25' : '10',
            search: term,
            exclude_role: 'super_admin',
          });
          return apiRequest<PaginatedUsersResponse>(`/api/users?${params.toString()}`);
        }));
        if (!cancelled) {
          setAssignableUsers(dedupeAssignableUsers(responses.flatMap((response) => normalizeAssignableUsers(response.items || []))));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load assignable users');
        }
      } finally {
        if (!cancelled) {
          setAssignmentUsersLoading(false);
        }
      }
    };

    void loadAssignableUsers();

    return () => {
      cancelled = true;
    };
  }, [assignmentSearchQuery, canOperate, device, enrollmentDetails]);

  useEffect(() => {
    if (!canOperate || !device || device.user?.id?.trim()) {
      return;
    }

    const requesterEmail = (enrollmentDetails['requester email'] || enrollmentDetails['email'] || '').trim();
    const employeeCode = (enrollmentDetails['employee id'] || enrollmentDetails['employee code'] || '').trim();
    const requesterName = (enrollmentDetails['requester name'] || enrollmentDetails['name'] || '').trim();
    setAssignmentSearchQuery(requesterEmail || employeeCode || requesterName);
  }, [canOperate, device, enrollmentDetails]);

  const suggestedAssignmentUser = useMemo(() => {
    if (!assignableUsers.length) {
      return null;
    }

    const requesterEmail = (enrollmentDetails['requester email'] || enrollmentDetails['email'] || '').trim().toLowerCase();
    const employeeCode = (enrollmentDetails['employee id'] || enrollmentDetails['employee code'] || '').trim().toLowerCase();
    const requesterName = (enrollmentDetails['requester name'] || enrollmentDetails['name'] || '').trim().toLowerCase();

    if (requesterEmail) {
      const emailMatch = assignableUsers.find((user) => user.email.trim().toLowerCase() === requesterEmail);
      if (emailMatch) {
        return emailMatch;
      }
    }

    if (employeeCode) {
      const employeeMatch = assignableUsers.find((user) => user.employeeCode.trim().toLowerCase() === employeeCode);
      if (employeeMatch) {
        return employeeMatch;
      }
    }

    if (requesterName) {
      const nameMatch = assignableUsers.find((user) => user.fullName.trim().toLowerCase() === requesterName);
      if (nameMatch) {
        return nameMatch;
      }
    }

    return null;
  }, [assignableUsers, enrollmentDetails]);

  useEffect(() => {
    if (device?.user?.id?.trim()) {
      setSelectedAssignmentUserId(device.user.id.trim());
      return;
    }

    if (!assignableUsers.length) {
      setSelectedAssignmentUserId('');
      return;
    }

    if (selectedAssignmentUserId && assignableUsers.some((user) => user.id === selectedAssignmentUserId)) {
      return;
    }

    setSelectedAssignmentUserId(suggestedAssignmentUser?.id || assignableUsers[0].id);
  }, [assignableUsers, device?.user?.id, selectedAssignmentUserId, suggestedAssignmentUser]);

  const installedApps = useMemo(
    () => [...(device?.installedApps ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [device?.installedApps],
  );
  const highlightedInstalledApps = useMemo(
    () => installedApps.filter((application) => keySoftwareTerms.some((term) => application.name.toLowerCase().includes(term))).slice(0, 12),
    [installedApps],
  );
  const wazuhAlerts = useMemo(() => alerts.filter((alert) => alert.source.toLowerCase() === 'wazuh'), [alerts]);
  const clamavAlerts = useMemo(() => alerts.filter((alert) => alert.source.toLowerCase() === 'clamav'), [alerts]);
  const openscapAlerts = useMemo(() => alerts.filter((alert) => alert.source.toLowerCase() === 'openscap'), [alerts]);
  const otherAlerts = useMemo(() => alerts.filter((alert) => !dedicatedSecuritySources.has(alert.source.toLowerCase())), [alerts]);
  const refreshSidebarData = async () => {
    if (!id || !device || !isComputeAsset(device)) {
      return;
    }

    const deviceAlerts = await apiRequest<DeviceAlertRecord[]>(`/api/devices/${id}/alerts`);
    setAlerts(deviceAlerts);

    if (isAuditor) {
      setPatchJobs([]);
      setTerminalSessions([]);
      return;
    }

    const [allPatchJobs, sessions] = await Promise.all([
      apiRequest<DevicePatchJobRecord[]>('/api/patch/jobs'),
      apiRequest<DeviceTerminalSessionRecord[]>(`/api/terminal/session?deviceId=${id}`),
    ]);
    setPatchJobs(allPatchJobs.filter((job) => isPatchJobForDevice(job, device)).slice(0, 6));
    setTerminalSessions(sessions);
  };

  const handleAssignDevice = async () => {
    if (assignmentReadOnly) {
      setError('This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.');
      setSuccessMessage('');
      return;
    }

    if (!id || !selectedAssignmentUserId) {
      setError('Select a user before assigning this system.');
      return;
    }

    const targetUser = assignableUsers.find((user) => user.id === selectedAssignmentUserId);
    const targetHostname = device?.hostname || 'this device';

    try {
      setAssigningDevice(true);
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/assets/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id: selectedAssignmentUserId }),
      });
      await loadDeviceDetails(false);
      setSuccessMessage(`Assigned ${targetHostname} to ${targetUser?.fullName || 'the selected user'}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to assign device');
    } finally {
      setAssigningDevice(false);
    }
  };

  const handleAssetAction = async (kind: 'unassign' | 'delete') => {
    if (assignmentReadOnly) {
      setError('This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.');
      setSuccessMessage('');
      setPendingAssetAction(null);
      return;
    }

    if (!id || !device) {
      return;
    }

    try {
      setAssetActionLoading(true);
      setError('');
      setSuccessMessage('');
      await apiRequest(kind === 'delete' ? `/api/assets/${id}` : `/api/assets/${id}/unassign`, {
        method: kind === 'delete' ? 'DELETE' : 'POST',
      });
      setPendingAssetAction(null);

      if (kind === 'delete') {
        navigate(`${basePath}/devices`);
        return;
      }

      await loadDeviceDetails(false);
      setSuccessMessage(`Removed ${device.hostname} from the assigned user.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to ${kind} asset`);
    } finally {
      setAssetActionLoading(false);
    }
  };

  const handleLifecycleFieldChange = (field: keyof DeviceLifecycleFormState, value: string) => {
    if (lifecycleReadOnly) {
      return;
    }
    setLifecycleForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleLifecycleCancel = () => {
    if (!editableAsset) {
      setLifecycleEditorOpen(false);
      return;
    }
    setLifecycleForm(buildLifecycleFormState(editableAsset));
    setLifecycleEditorOpen(false);
  };

  const handleLifecycleSave = async () => {
    if (!id || !editableAsset || !lifecycleForm) {
      return;
    }

    if (lifecycleReadOnly) {
      setError('This asset is retired. Lifecycle details are read-only until the asset returns to an active lifecycle state.');
      setSuccessMessage('');
      return;
    }

    try {
      setSavingLifecycle(true);
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          asset_tag: lifecycleForm.assetTag,
          name: editableAsset.name,
          hostname: editableAsset.hostname || '',
          category: lifecycleForm.category,
          is_compute: editableAsset.is_compute,
          serial_number: editableAsset.serial_number || '',
          model: lifecycleForm.model,
          entity_id: editableAsset.entity_id,
          assigned_to: editableAsset.assigned_to || '',
          dept_id: editableAsset.dept_id || '',
          location_id: editableAsset.location_id || '',
          purchase_date: lifecycleForm.purchaseDate,
          cost: lifecycleForm.cost,
          warranty_until: lifecycleForm.warrantyUntil,
          status: editableAsset.status,
          condition: editableAsset.condition,
          glpi_id: editableAsset.glpi_id || 0,
          salt_minion_id: editableAsset.salt_minion_id || '',
          wazuh_agent_id: editableAsset.wazuh_agent_id || '',
          notes: lifecycleForm.notes,
        }),
      });

      const refreshedAsset = await apiRequest<EditableAssetRecord>(`/api/assets/${id}`);
      setEditableAsset(refreshedAsset);
      setLifecycleForm(buildLifecycleFormState(refreshedAsset));
      await loadDeviceDetails(false);
      setLifecycleEditorOpen(false);
      setSuccessMessage(`Updated lifecycle details for ${device?.hostname || 'this asset'}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save lifecycle details');
    } finally {
      setSavingLifecycle(false);
    }
  };

  const computeAsset = device ? isComputeAsset(device) : true;
  const detailSections = useMemo(() => {
    if (isAuditor) {
      return computeAsset ? auditorComputeDetailSections : auditorAccessoryDetailSections;
    }

    const sections = computeAsset ? computeDetailSections : accessoryDetailSections;
    if (canOperate) {
      return sections;
    }
    return sections.filter(([sectionId]) => sectionId !== 'terminal' && sectionId !== 'updates-salt');
  }, [canOperate, computeAsset, isAuditor]);
  const activeSectionLabel = detailSections.find(([sectionId]) => sectionId === activeSection)?.[1] || 'Details';

  useEffect(() => {
    const hashSection = location.hash.replace('#', '');
    const validSectionIds = device ? new Set(detailSections.map(([sectionId]) => sectionId)) : allDetailSectionIds;
    const nextSection = hashSection && validSectionIds.has(hashSection) ? hashSection : detailSections[0]?.[0] || 'hardware';

    if (nextSection !== activeSection) {
      setActiveSection(nextSection);
    }
  }, [activeSection, detailSections, device, location.hash]);

  const handleSelectSection = (sectionId: string) => {
    setActiveSection(sectionId);
    navigate({ pathname: location.pathname, hash: `#${sectionId}` }, { replace: true });
  };
  const {
    sshTerminalReady,
    canStartTerminal,
    canOpenPatchConsole,
    patchActionButtonLabel,
    terminalBlockedReason,
    patchBlockedReason,
    handleRunPatch,
    handleStartTerminal,
    handleOpenMainSaltConsole,
  } = useDeviceDetailAccessWorkflow({
    device,
    computeAsset,
    canOperate,
    installConfig,
    installConfigLoading,
    selectedSaltAction,
    customSaltInput,
    setError,
    setSuccessMessage,
    setRunningPatch,
    setStartingTerminal,
    setEmbeddedConsole,
    setPatchReport,
    refreshSidebarData,
  });

  if (loading) {
    return <div className="py-20 text-center text-sm text-zinc-500">Loading asset details...</div>;
  }

  if (!device) {
    return <div className="py-20 text-center text-sm text-rose-600">{error || 'Device not found.'}</div>;
  }

  const latestEnrollmentComment = enrollmentRequest?.comments.at(-1) || null;
  const isAssigned = Boolean(device.user?.id?.trim());
  const networkInterfaces = Object.entries(device.network?.interface_stats || {});
  const {
    encryptedVolumeCount,
    hardwareDetails,
    networkSummaryItems,
    operatingSystemDetails,
    overviewCards,
    remoteIdentifierDetails,
    remoteToolStatuses,
  } = buildDeviceDetailViewData({
    device,
    computeAsset,
    installedAppCount: installedApps.length,
    sshTerminalReady,
    formatDate,
    formatDetailValue,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 xl:px-6">
      {isAuditor ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900 shadow-sm">Auditor access is read-only. Operational actions are hidden, but device context, OpenSCAP findings, ClamScan findings, and related alert details remain visible for verification.</div> : null}

      <DeviceDetailOverview
        hostname={device.hostname}
        assetId={device.assetId}
        deviceType={device.deviceType}
        osName={device.osName}
        computeAsset={computeAsset}
        canOperate={canOperate}
        startingTerminal={startingTerminal}
        canStartTerminal={canStartTerminal}
        canOpenPatchConsole={canOpenPatchConsole}
        onBack={() => navigate(-1)}
        onStartTerminal={() => { void handleStartTerminal(); }}
        onOpenSaltConsole={handleOpenMainSaltConsole}
        error={error}
        successMessage={successMessage}
        overviewCards={overviewCards}
        detailSections={detailSections}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
      />

      <div className="space-y-6">
        <div id={activeSection} className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-zinc-100 pb-4">
            <div className="inline-flex w-fit items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Device Details</div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-950">{activeSectionLabel}</h2>
            <p className="text-sm text-zinc-500">Use the options above to review this asset one section at a time.</p>
          </div>

          <div className="mt-5">
            {activeSection === 'hardware' ? <DetailSectionCard title={computeAsset ? 'Hardware' : 'Inventory'} icon={<Cpu className="mr-2 h-4 w-4" />} items={hardwareDetails} /> : null}

            {activeSection === 'operating-system' ? <DetailSectionCard title={computeAsset ? 'Operating System' : 'Location & Assignment'} icon={<HardDrive className="mr-2 h-4 w-4" />} items={computeAsset ? operatingSystemDetails : [
              { label: 'Category', value: device.deviceType || 'Accessory' },
              { label: 'Assigned To', value: device.user?.fullName || 'Unassigned' },
              { label: 'Department', value: device.department?.name || 'Unassigned' },
              { label: 'Location', value: device.branch?.name || 'Unassigned' },
            ]} /> : null}

            {activeSection === 'assignment' ? (
              isAuditor ? (
                <DetailSectionCard
                  title="Assignment"
                  layout="stack"
                  items={[
                    { label: 'Assigned To', value: device.user?.fullName || 'Unassigned' },
                    { label: 'Employee ID', value: device.user?.employeeCode || '-' },
                    { label: 'Email', value: device.user?.email || '-' },
                    { label: 'Department', value: device.department?.name || 'Unassigned' },
                    { label: 'Location', value: device.branch?.name || 'Unassigned' },
                  ]}
                  footer={enrollmentRequest ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Enrollment request linked: {enrollmentRequest.title}</div> : null}
                />
              ) : (
                <DeviceAssignmentPanel assignedUser={device.user} deviceStatus={device.status} department={device.department} canOperate={canOperate} isAssigned={isAssigned} assetActionLoading={assetActionLoading} pendingAssetActionKind={pendingAssetAction?.kind} enrollmentRequest={enrollmentRequest} enrollmentDetails={enrollmentDetails} suggestedAssignmentUser={suggestedAssignmentUser} assignmentUsersLoading={assignmentUsersLoading} assignmentSearchQuery={assignmentSearchQuery} assignableUsers={assignableUsers} selectedAssignmentUserId={selectedAssignmentUserId} assigningDevice={assigningDevice} onUnassignAsset={() => setPendingAssetAction({ kind: 'unassign' })} onDeleteAsset={() => setPendingAssetAction({ kind: 'delete' })} onAssignmentSearchQueryChange={setAssignmentSearchQuery} onSelectedAssignmentUserIdChange={setSelectedAssignmentUserId} onAssignDevice={() => { void handleAssignDevice(); }} />
              )
            ) : null}

            {activeSection === 'lifecycle' ? (
              <>
                <DetailSectionCard title="Lifecycle" layout="stack" items={[
                  { label: 'Warranty', value: formatDate(device.warrantyExpiresAt) },
                  { label: 'Cost', value: formatLifecycleCurrency(device.cost) },
                  { label: 'Item Code', value: device.assetId || '-' },
                  { label: 'Asset Category', value: computeAsset ? 'Compute Asset' : 'Inventory Asset' },
                  { label: 'Type of Asset', value: device.deviceType || 'Device' },
                  { label: 'Supplier', value: device.manufacturer || 'Not recorded' },
                ]} />
                {canOperate && lifecycleForm ? (
                  lifecycleEditorOpen ? (
                    <DeviceLifecycleEditor
                      form={lifecycleForm}
                      saving={savingLifecycle}
                      readOnly={lifecycleReadOnly}
                      onFieldChange={handleLifecycleFieldChange}
                      onSubmit={() => { void handleLifecycleSave(); }}
                      onCancel={handleLifecycleCancel}
                    />
                  ) : (
                    <div className="mt-4">
                      {lifecycleReadOnly ? (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          This asset is retired. Lifecycle details are read-only until the asset returns to an active lifecycle state.
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setLifecycleEditorOpen(true)}
                        disabled={lifecycleReadOnly}
                        className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Lifecycle Details
                      </button>
                    </div>
                  )
                ) : null}
              </>
            ) : null}

            {activeSection === 'maintenance' && device ? (
              <MaintenancePanel
                deviceId={device.id}
                maintenanceUntil={device.maintenanceUntil}
                onMaintenanceUpdated={(newMaintenanceUntil) => {
                  setDevice(prev => prev ? { ...prev, maintenanceUntil: newMaintenanceUntil } : null);
                }}
                canOperate={canOperate}
              />
            ) : null}

            {activeSection === 'enrollment' ? (
              enrollmentRequest ? <DetailSectionCard title="Enrollment Review Audit" tone="brand" layout="stack" items={[
                { label: 'Status', value: formatStatusLabel(enrollmentRequest.status) },
                { label: 'Request', value: enrollmentRequest.title },
                { label: 'Submitted Name', value: enrollmentDetails['requester name'] || enrollmentDetails['name'] || 'Unknown' },
                { label: 'Submitted Email', value: enrollmentDetails['requester email'] || enrollmentDetails['email'] || '-' },
                { label: 'Submitted Employee ID', value: enrollmentDetails['employee id'] || enrollmentDetails['employee code'] || '-' },
                { label: 'Submitted Department', value: enrollmentDetails['department'] || '-' },
                { label: 'Assigned Reviewer', value: enrollmentRequest.assignee?.fullName || 'Unassigned' },
                { label: 'Last Updated', value: formatDate(enrollmentRequest.updatedAt) },
                ...(latestEnrollmentComment ? [{ label: 'Last Review Entry', value: `${latestEnrollmentComment.author} • ${formatDate(latestEnrollmentComment.createdAt)}` }] : []),
              ]} footer={latestEnrollmentComment ? <div className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm text-zinc-700">{latestEnrollmentComment.note}</div> : null} /> : <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">No enrollment review details are linked to this asset.</div>
            ) : null}

            {activeSection === 'network' && computeAsset ? <NetworkDetailsPanel summaryItems={networkSummaryItems} networkInterfaces={networkInterfaces} formatDetailValue={formatDetailValue} /> : null}

            {activeSection === 'volumes' && computeAsset ? <VolumesPanel totalStorage={formatDetailValue(device.storage)} volumes={device.volumes || []} encryptedVolumeCount={encryptedVolumeCount} diskLayout={device.diskLayout} formatDetailValue={formatDetailValue} /> : null}

            {activeSection === 'remote-id' && computeAsset ? <RemoteAccessPanel remoteIdentifierDetails={remoteIdentifierDetails} toolStatuses={remoteToolStatuses} toolStatusTone={toolStatusTone} /> : null}

            {activeSection === 'software' ? <SoftwareInventoryPanel computeAsset={computeAsset} installedApps={installedApps} highlightedInstalledApps={highlightedInstalledApps} softwareSourceLabel={softwareSourceLabel} /> : null}

            {activeSection === 'terminal' && computeAsset ? <TerminalAccessPanel canOperate={canOperate} canStartTerminal={canStartTerminal} startingTerminal={startingTerminal} terminalBlockedReason={terminalBlockedReason} sidebarLoading={sidebarLoading} terminalSessions={terminalSessions} onStartTerminal={() => { void handleStartTerminal(); }} formatDate={formatDate} /> : null}

            {activeSection === 'updates-salt' && computeAsset ? <SaltUpdatesPanel saltTarget={device.saltMinionId || device.toolStatus?.salt?.identifier || 'Not linked'} selectedSaltAction={selectedSaltAction} customSaltInput={customSaltInput} runningPatch={runningPatch} canOperate={canOperate} canOpenPatchConsole={canOpenPatchConsole} patchActionButtonLabel={patchActionButtonLabel} patchBlockedReason={patchBlockedReason} sidebarLoading={sidebarLoading} patchJobs={patchJobs} onSelectedSaltActionChange={setSelectedSaltAction} onCustomSaltInputChange={setCustomSaltInput} onRunPatch={() => { void handleRunPatch(); }} formatDate={formatDate} /> : null}

            {activeSection === 'security' && computeAsset ? <SecurityFindingsPanel title="Wazuh Findings" description="Latest file-integrity and compliance findings linked through the Wazuh agent for this asset." alerts={wazuhAlerts} loading={sidebarLoading} emptyMessage="No recent Wazuh findings for this asset." onSelectAlert={setSelectedAlert} alertStatusBadgeClassName={alertStatusBadgeClassName} alertStatusLabel={alertStatusLabel} severityBadgeClassName={severityBadgeClassName} alertSourceLabel={alertSourceLabel} formatDate={formatDate} /> : null}

            {activeSection === 'clamav' && computeAsset ? <SecurityFindingsPanel title="ClamScan Findings" description="Recent malware scan results reported by the endpoint agent for this asset." alerts={clamavAlerts} loading={sidebarLoading} emptyMessage="No recent ClamScan findings for this asset." onSelectAlert={setSelectedAlert} alertStatusBadgeClassName={alertStatusBadgeClassName} alertStatusLabel={alertStatusLabel} severityBadgeClassName={severityBadgeClassName} alertSourceLabel={alertSourceLabel} formatDate={formatDate} /> : null}

            {activeSection === 'openscap' && computeAsset ? <SecurityFindingsPanel title="OpenSCAP Findings" description="Recent hardening and compliance results reported from OpenSCAP scans for this asset." alerts={openscapAlerts} loading={sidebarLoading} emptyMessage="No recent OpenSCAP findings for this asset." onSelectAlert={setSelectedAlert} alertStatusBadgeClassName={alertStatusBadgeClassName} alertStatusLabel={alertStatusLabel} severityBadgeClassName={severityBadgeClassName} alertSourceLabel={alertSourceLabel} formatDate={formatDate} /> : null}

            {activeSection === 'other-alerts' && computeAsset ? <OtherAlertsPanel alerts={otherAlerts} loading={sidebarLoading} onSelectAlert={setSelectedAlert} alertSourceLabel={alertSourceLabel} severityBadgeClassName={severityBadgeClassName} alertStatusBadgeClassName={alertStatusBadgeClassName} alertStatusLabel={alertStatusLabel} formatDate={formatDate} /> : null}
          </div>
        </div>
      </div>

      <EmbeddedConsoleModal
        consoleState={embeddedConsole}
        titleId="embedded-console-title"
        closeButtonRef={embeddedConsoleCloseButtonRef}
        onClose={() => setEmbeddedConsole(null)}
      />

      <PatchRunReportModal
        report={patchReport}
        onClose={() => setPatchReport(null)}
      />

      <DeviceAlertDetailModal
        selectedAlert={selectedAlert}
        hostname={device.hostname}
        assetId={device.assetId}
        assignedUserName={device.user?.fullName}
        assignedUserEmail={device.user?.email}
        departmentName={device.department?.name}
        alertDialogRef={alertDialogRef}
        alertCloseButtonRef={alertCloseButtonRef}
        onClose={() => setSelectedAlert(null)}
        severityBadgeClassName={severityBadgeClassName}
        alertSourceLabel={alertSourceLabel}
        alertStatusBadgeClassName={alertStatusBadgeClassName}
        alertStatusLabel={alertStatusLabel}
        formatDate={formatDate}
      />

      <ConfirmDialog
        open={Boolean(pendingAssetAction)}
        title={pendingAssetAction?.kind === 'delete' ? 'Delete Asset' : 'Remove Asset From User'}
        message={pendingAssetAction?.kind === 'delete' ? 'This will permanently delete the asset from ITMS and cannot be undone.' : 'This will remove the asset assignment from the current user but keep the asset in ITMS.'}
        confirmLabel={pendingAssetAction?.kind === 'delete' ? 'Delete Asset' : 'Remove From User'}
        tone={pendingAssetAction?.kind === 'delete' ? 'danger' : 'default'}
        busy={assetActionLoading}
        onClose={() => setPendingAssetAction(null)}
        onConfirm={() => {
          if (pendingAssetAction) {
            void handleAssetAction(pendingAssetAction.kind);
          }
        }}
      />
    </div>
  );
}