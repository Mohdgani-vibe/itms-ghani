import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsBootstrapSection from '../../components/settings/SettingsBootstrapSection';
import ConfirmDialog from '../../components/ConfirmDialog';
import SettingsOverviewPanel from '../../components/settings/SettingsOverviewPanel';
import SettingsPatchPolicyPanel from '../../components/settings/SettingsPatchPolicyPanel';
import SettingsPlatformSection from '../../components/settings/SettingsPlatformSection';
import SettingsRequestTypeOwnersPanel from '../../components/settings/SettingsRequestTypeOwnersPanel';
import SettingsWorkflowMembersPanel from '../../components/settings/SettingsWorkflowMembersPanel';
import SettingsWorkflowRulesPanel from '../../components/settings/SettingsWorkflowRulesPanel';
import SettingsWorkflowRoutingPanel from '../../components/settings/SettingsWorkflowRoutingPanel';
import { apiRequest } from '../../lib/api';
import { getStoredSession } from '../../lib/session';
import { isProbeLikeUser } from '../../lib/userVisibility';

const LINUX_HARDINFO_PREFERENCE_KEY = 'itms_install_linux_hardinfo_fallback';
const REQUEST_ROUTE_TYPES = ['Laptop change', 'OS reinstall', 'Software install', 'Portal access', 'Settings change', 'General issue', 'Hardware replacement', 'Peripheral request', 'Other'];

interface InstallAgentConfig {
  publicServerUrl: string;
  inventoryIngestToken: string;
  saltMasterHost: string;
  saltApiBaseUrl?: string;
  wazuhManagerHost: string;
  saltApiConfigured: boolean;
  saltBootstrapReady?: boolean;
  sshConfigured?: boolean;
  sshAuthMode?: string;
  wazuhApiConfigured: boolean;
  portalInstallReady: boolean;
  linuxInstallerUrl?: string;
  windowsInstallerUrl?: string;
}

interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  sourceType: string;
  interval: string;
  running: boolean;
  nextRunAt?: string;
  lastRun?: {
    status: string;
    startedAt: string;
    finishedAt?: string;
    recordsSeen: number;
    recordsUpserted: number;
    error?: string;
  };
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserMetaOptionsResponse {
  roles: LookupOption[];
  departments: LookupOption[];
  branches: LookupOption[];
}

interface WorkflowRoute {
  match: string;
  assigneeId: string;
}

interface PatchDepartmentRing {
  match: string;
  ring: string;
}

interface WorkflowSettings {
  requestAutoAssignEnabled: boolean;
  chatAutoCreateEnabled: boolean;
  chatAutoRouteEnabled: boolean;
  requestFallbackAssigneeId: string | null;
  chatFallbackAssigneeId: string | null;
  ticketAssigneeIds: string[];
  chatMemberIds: string[];
  requestTypeRoutes: WorkflowRoute[];
  requestSubjectRoutes: WorkflowRoute[];
  chatSubjectRoutes: WorkflowRoute[];
  patchWindowEnabled: boolean;
  patchWindowStart: string;
  patchWindowEnd: string;
  patchAllowedRings: string[];
  patchDepartmentRings: PatchDepartmentRing[];
  updatedAt?: string;
}

interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeCode?: string;
}

interface ApiDirectoryUser {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  role: string;
  emp_id?: string;
}

interface PendingWorkflowMemberAction {
  kind: 'add' | 'remove';
  key: 'ticketAssigneeIds' | 'chatMemberIds';
  userId: string;
  userName: string;
}

interface PaginatedUsersResponse {
  items: ApiDirectoryUser[];
}

type SettingsSection = 'platform' | 'workflow' | 'bootstrap';

export function normalizeDirectoryUsers(items: ApiDirectoryUser[]) {
  return items.map((user) => ({
    id: user.id,
    fullName: user.fullName || user.full_name || user.email || user.id,
    email: user.email,
    role: user.role,
    employeeCode: user.emp_id,
  }));
}

export function isProbeWorkflowUser(user: DirectoryUser) {
  return isProbeLikeUser(user);
}

export function normalizeWorkflowSettings(settings: WorkflowSettings): WorkflowSettings {
  return {
    ...settings,
    requestFallbackAssigneeId: settings.requestFallbackAssigneeId || null,
    chatFallbackAssigneeId: settings.chatFallbackAssigneeId || null,
    ticketAssigneeIds: settings.ticketAssigneeIds || [],
    chatMemberIds: settings.chatMemberIds || [],
    requestTypeRoutes: settings.requestTypeRoutes || [],
    requestSubjectRoutes: settings.requestSubjectRoutes || [],
    chatSubjectRoutes: settings.chatSubjectRoutes || [],
    patchWindowEnabled: settings.patchWindowEnabled === true,
    patchWindowStart: settings.patchWindowStart || '22:00',
    patchWindowEnd: settings.patchWindowEnd || '06:00',
    patchAllowedRings: settings.patchAllowedRings || [],
    patchDepartmentRings: settings.patchDepartmentRings || [],
  };
}

export function serializeWorkflowSettings(settings: WorkflowSettings) {
  return {
    ...settings,
    requestFallbackAssigneeId: settings.requestFallbackAssigneeId ?? '',
    chatFallbackAssigneeId: settings.chatFallbackAssigneeId ?? '',
  };
}

export function normalizePatchDepartmentName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function routesToEditorText(routes: WorkflowRoute[]) {
  return routes.map((route) => `${route.match} => ${route.assigneeId}`).join('\n');
}

export function parseEditorTextToRoutes(value: string) {
  const routes: WorkflowRoute[] = [];
  const invalidLines: string[] = [];

  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const arrowIndex = line.indexOf('=>');
      const equalsIndex = arrowIndex >= 0 ? -1 : line.indexOf('=');
      const separatorIndex = arrowIndex >= 0 ? arrowIndex : equalsIndex;
      const separatorLength = arrowIndex >= 0 ? 2 : equalsIndex >= 0 ? 1 : 0;

      if (separatorIndex < 0) {
        invalidLines.push(line);
        return;
      }

      const match = line.slice(0, separatorIndex).trim();
      const assigneeId = line.slice(separatorIndex + separatorLength).trim();

      if (!match || !assigneeId) {
        invalidLines.push(line);
        return;
      }

      routes.push({ match, assigneeId });
    });

  return { routes, invalidLines };
}

export function workflowTypeAssignee(settings: WorkflowSettings | null, type: string) {
  const route = settings?.requestTypeRoutes.find((item) => item.match.toLowerCase() === type.toLowerCase());
  return route?.assigneeId || '';
}

export function quoteShell(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, `''`)}'`;
}

export function formatPowerShellArgument(value: string) {
  if (/^\$(true|false)$/i.test(value)) {
    return value;
  }
  return quotePowerShell(value);
}

export function buildLinuxArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `--${key} ${quoteShell(value)}`).join(' ');
}

export function buildWindowsArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `-${key.replace(/(^|-)([a-z])/g, (_, prefix: string, chr: string) => `${prefix === '-' ? '' : ''}${chr.toUpperCase()}`)} ${formatPowerShellArgument(value)}`).join(' ');
}

export function buildSettingsLinuxBootstrapCommand(config?: InstallAgentConfig | null, includeHardinfoFallback = true) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.linuxInstallerUrl || `${serverUrl}/installers/install-itms-agent.sh`;
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['token', ingestToken],
    ['category', 'auto'],
    ['assigned-to-name', '<EMPLOYEE_NAME>'],
    ['assigned-to-email', '<EMPLOYEE_EMAIL>'],
    ['employee-code', '<EMPLOYEE_ID>'],
    ['department-name', '<DEPARTMENT>'],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', 'Installed by ITMS bootstrap'],
  ];
  const commandParts = [buildLinuxArgumentString(installArgs)];
  if (includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  return `curl -fsSL ${quoteShell(installerUrl)} -o /tmp/install-itms-agent.sh && sudo bash /tmp/install-itms-agent.sh ${commandParts.join(' ')}`;
}

export function buildSettingsWindowsBootstrapCommand(config?: InstallAgentConfig | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.windowsInstallerUrl || `${serverUrl}/installers/install-itms-agent.ps1`;
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['token', ingestToken],
    ['category', 'auto'],
    ['use-detailed-hardware-inventory', '$true'],
    ['assigned-to-name', '<EMPLOYEE_NAME>'],
    ['assigned-to-email', '<EMPLOYEE_EMAIL>'],
    ['employee-code', '<EMPLOYEE_ID>'],
    ['department-name', '<DEPARTMENT>'],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', 'Installed by ITMS bootstrap'],
  ];
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$scriptPath = Join-Path $env:TEMP 'install-itms-agent.ps1'; Invoke-WebRequest ${quotePowerShell(installerUrl)} -OutFile $scriptPath; & $scriptPath ${buildWindowsArgumentString(installArgs)}"`;
}

export function buildSettingsLinuxSyncCommand(config?: InstallAgentConfig | null, includeHardinfoFallback = true) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  const commandParts = [
    `sudo /usr/bin/python3 /opt/itms/push-system-inventory.py --server-url ${quoteShell(serverUrl)} --token ${quoteShell(ingestToken)} --category 'auto'`,
  ];
  if (includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  return commandParts.join(' ');
}

export function buildSettingsWindowsSyncCommand(config?: InstallAgentConfig | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\ProgramData\\ITMS\\push-system-inventory.ps1" -ServerUrl ${quotePowerShell(serverUrl)} -Token ${quotePowerShell(ingestToken)} -Category 'auto' -UseDetailedHardwareInventory $true`;
}

export function formatDateTime(value?: string) {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getStoredSession();
  const portalLabel = useMemo(() => {
    if (location.pathname.startsWith('/admin')) {
      return 'Super Admin Portal';
    }
    if (location.pathname.startsWith('/it')) {
      return 'IT Portal';
    }
    return 'Portal';
  }, [location.pathname]);

  const [installConfig, setInstallConfig] = useState<InstallAgentConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [meta, setMeta] = useState<UserMetaOptionsResponse | null>(null);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings | null>(null);
  const [requestWorkflowUsers, setRequestWorkflowUsers] = useState<DirectoryUser[]>([]);
  const [chatWorkflowUsers, setChatWorkflowUsers] = useState<DirectoryUser[]>([]);
  const [ticketAssigneeDraft, setTicketAssigneeDraft] = useState('');
  const [chatMemberDraft, setChatMemberDraft] = useState('');
  const [requestSubjectEditor, setRequestSubjectEditor] = useState('');
  const [chatSubjectEditor, setChatSubjectEditor] = useState('');
  const [pendingWorkflowMemberAction, setPendingWorkflowMemberAction] = useState<PendingWorkflowMemberAction | null>(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [workflowSaveStatus, setWorkflowSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'linux' | 'windows' | 'linux-sync' | 'windows-sync' | ''>('');
  const [activeSection, setActiveSection] = useState<SettingsSection>('platform');
  const [includeLinuxHardinfoFallback, setIncludeLinuxHardinfoFallback] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.localStorage.getItem(LINUX_HARDINFO_PREFERENCE_KEY) !== 'false';
  });
  const mountedRef = useRef(true);
  const copyStatusTimeoutRef = useRef<number | null>(null);
  const workflowSaveStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current);
      }
      if (workflowSaveStatusTimeoutRef.current !== null) {
        window.clearTimeout(workflowSaveStatusTimeoutRef.current);
      }
    };
  }, []);

  const linuxBootstrapCommand = useMemo(
    () => buildSettingsLinuxBootstrapCommand(installConfig, includeLinuxHardinfoFallback),
    [includeLinuxHardinfoFallback, installConfig],
  );
  const windowsBootstrapCommand = useMemo(
    () => buildSettingsWindowsBootstrapCommand(installConfig),
    [installConfig],
  );
  const linuxSyncCommand = useMemo(
    () => buildSettingsLinuxSyncCommand(installConfig, includeLinuxHardinfoFallback),
    [includeLinuxHardinfoFallback, installConfig],
  );
  const windowsSyncCommand = useMemo(
    () => buildSettingsWindowsSyncCommand(installConfig),
    [installConfig],
  );
  const canViewWorkflowSettings = session?.user.role === 'super_admin' || session?.user.role === 'it_team';
  const parsedRequestSubjectRoutes = useMemo(() => parseEditorTextToRoutes(requestSubjectEditor), [requestSubjectEditor]);
  const parsedChatSubjectRoutes = useMemo(() => parseEditorTextToRoutes(chatSubjectEditor), [chatSubjectEditor]);
  const canEditWorkflowSettings = session?.user.role === 'super_admin';
  const hasActiveEmployeeWorkflowUsers = useMemo(
    () => requestWorkflowUsers.some((user) => user.role === 'employee'),
    [requestWorkflowUsers],
  );
  const availableTicketAssigneeOptions = useMemo(
    () => requestWorkflowUsers.filter((user) => !workflowSettings?.ticketAssigneeIds.includes(user.id)),
    [requestWorkflowUsers, workflowSettings?.ticketAssigneeIds],
  );
  const ticketAssigneeUsers = useMemo(() => {
    if (!workflowSettings || workflowSettings.ticketAssigneeIds.length === 0) {
      return requestWorkflowUsers;
    }
    return requestWorkflowUsers.filter((user) => workflowSettings.ticketAssigneeIds.includes(user.id));
  }, [requestWorkflowUsers, workflowSettings]);
  const chatMemberUsers = useMemo(() => {
    if (!workflowSettings || workflowSettings.chatMemberIds.length === 0) {
      return chatWorkflowUsers;
    }
    return chatWorkflowUsers.filter((user) => workflowSettings.chatMemberIds.includes(user.id));
  }, [chatWorkflowUsers, workflowSettings]);
  const availableChatMemberOptions = useMemo(
    () => chatWorkflowUsers.filter((user) => !workflowSettings?.chatMemberIds.includes(user.id)),
    [chatWorkflowUsers, workflowSettings?.chatMemberIds],
  );
  const detailSections: Array<{ id: SettingsSection; label: string }> = useMemo(() => {
    const sections: Array<{ id: SettingsSection; label: string }> = [{ id: 'platform', label: 'Platform' }];

    if (canViewWorkflowSettings && workflowSettings) {
      sections.push({ id: 'workflow', label: 'Workflow' });
    }

    sections.push({ id: 'bootstrap', label: 'Bootstrap' });
    return sections;
  }, [canViewWorkflowSettings, workflowSettings]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError('');

        const [installData, syncData, metaData, workflowData, requestWorkflowUsersData, chatWorkflowUsersData] = await Promise.all([
          apiRequest<InstallAgentConfig>('/api/integrations/install-config').catch(() => null),
          apiRequest<SyncStatus>('/api/inventory-sync/status').catch(() => null),
          apiRequest<UserMetaOptionsResponse>('/api/users/meta/options').catch(() => null),
          canViewWorkflowSettings ? apiRequest<WorkflowSettings>('/api/settings/workflow') : Promise.resolve(null),
          canViewWorkflowSettings
            ? apiRequest<PaginatedUsersResponse>('/api/users?paginate=1&page=1&page_size=2000&status=active').catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
          canViewWorkflowSettings
            ? apiRequest<PaginatedUsersResponse>('/api/users?paginate=1&page=1&page_size=500&role=it_team&role=super_admin&status=active').catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
        ]);

        if (!cancelled) {
          const normalizedWorkflowData = workflowData ? normalizeWorkflowSettings(workflowData) : workflowData;
          const requestWorkflowUserItems = normalizeDirectoryUsers(requestWorkflowUsersData.items || []).filter((user) => !isProbeWorkflowUser(user));
          const chatWorkflowUserItems = normalizeDirectoryUsers(chatWorkflowUsersData.items || []);
          setInstallConfig(installData);
          setSyncStatus(syncData);
          setMeta(metaData);
          setWorkflowSettings(normalizedWorkflowData);
          setRequestWorkflowUsers(requestWorkflowUserItems);
          setChatWorkflowUsers(chatWorkflowUserItems);
          setRequestSubjectEditor(routesToEditorText(normalizedWorkflowData?.requestSubjectRoutes ?? []));
          setChatSubjectEditor(routesToEditorText(normalizedWorkflowData?.chatSubjectRoutes ?? []));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [canViewWorkflowSettings]);

  useEffect(() => {
    window.localStorage.setItem(LINUX_HARDINFO_PREFERENCE_KEY, includeLinuxHardinfoFallback ? 'true' : 'false');
  }, [includeLinuxHardinfoFallback]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    const validSection = detailSections.some((section) => section.id === hash) ? (hash as SettingsSection) : null;

    if (validSection) {
      setActiveSection(validSection);
      return;
    }

    if (!detailSections.some((section) => section.id === activeSection)) {
      setActiveSection(detailSections[0]?.id || 'platform');
    }
  }, [activeSection, detailSections, location.hash]);

  const handleSelectSection = (section: SettingsSection) => {
    setActiveSection(section);
    navigate(`${location.pathname}#${section}`, { replace: true });
  };

  const handleCopyCommand = async (kind: 'linux' | 'windows' | 'linux-sync' | 'windows-sync', command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      if (!mountedRef.current) {
        return;
      }
      setCopyStatus(kind);
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current);
      }
      copyStatusTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        setCopyStatus((current) => (current === kind ? '' : current));
      }, 1500);
    } catch (copyError) {
      if (mountedRef.current) {
        setError(copyError instanceof Error ? copyError.message : 'Failed to copy command');
      }
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError('');
      const [installData, syncData, metaData, workflowData, requestWorkflowUsersData, chatWorkflowUsersData] = await Promise.all([
        apiRequest<InstallAgentConfig>('/api/integrations/install-config').catch(() => null),
        apiRequest<SyncStatus>('/api/inventory-sync/status').catch(() => null),
        apiRequest<UserMetaOptionsResponse>('/api/users/meta/options').catch(() => null),
        canViewWorkflowSettings ? apiRequest<WorkflowSettings>('/api/settings/workflow') : Promise.resolve(null),
        canViewWorkflowSettings
          ? apiRequest<PaginatedUsersResponse>('/api/users?paginate=1&page=1&page_size=2000&status=active').catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        canViewWorkflowSettings
          ? apiRequest<PaginatedUsersResponse>('/api/users?paginate=1&page=1&page_size=500&role=it_team&role=super_admin&status=active').catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
      ]);
      const normalizedWorkflowData = workflowData ? normalizeWorkflowSettings(workflowData) : workflowData;
      const requestWorkflowUserItems = normalizeDirectoryUsers(requestWorkflowUsersData.items || []).filter((user) => !isProbeWorkflowUser(user));
      const chatWorkflowUserItems = normalizeDirectoryUsers(chatWorkflowUsersData.items || []);
      if (!mountedRef.current) {
        return;
      }
      setInstallConfig(installData);
      setSyncStatus(syncData);
      setMeta(metaData);
      setWorkflowSettings(normalizedWorkflowData);
      setRequestWorkflowUsers(requestWorkflowUserItems);
      setChatWorkflowUsers(chatWorkflowUserItems);
      setRequestSubjectEditor(routesToEditorText(normalizedWorkflowData?.requestSubjectRoutes ?? []));
      setChatSubjectEditor(routesToEditorText(normalizedWorkflowData?.chatSubjectRoutes ?? []));
    } catch (requestError) {
      if (mountedRef.current) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to refresh settings');
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  const handleWorkflowTypeChange = (type: string, assigneeId: string) => {
    setWorkflowSettings((current) => {
      if (!current) {
        return current;
      }
      const remaining = current.requestTypeRoutes.filter((route) => route.match.toLowerCase() !== type.toLowerCase());
      return {
        ...current,
        requestTypeRoutes: assigneeId ? [...remaining, { match: type, assigneeId }] : remaining,
      };
    });
  };

  const patchDepartmentRing = (departmentName: string) => workflowSettings?.patchDepartmentRings.find((route) => route.match === normalizePatchDepartmentName(departmentName))?.ring || '';

  const handlePatchDepartmentRingChange = (departmentName: string, ring: string) => {
    setWorkflowSettings((current) => {
      if (!current) {
        return current;
      }
      const match = normalizePatchDepartmentName(departmentName);
      const remaining = current.patchDepartmentRings.filter((route) => route.match !== match);
      return {
        ...current,
        patchDepartmentRings: ring ? [...remaining, { match, ring }] : remaining,
      };
    });
  };

  const workflowMemberScopeLabel = (key: 'ticketAssigneeIds' | 'chatMemberIds') => key === 'ticketAssigneeIds' ? 'ticket assignee list' : 'chat member list';

  const findWorkflowUserName = (userId: string) => requestWorkflowUsers.find((user) => user.id === userId)?.fullName || chatWorkflowUsers.find((user) => user.id === userId)?.fullName || 'Selected teammate';

  const addWorkflowMember = (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => {
    if (!userId) {
      return;
    }
    setWorkflowSettings((current) => {
      if (!current || current[key].includes(userId)) {
        return current;
      }
      return {
        ...current,
        [key]: [...current[key], userId],
      };
    });
  };

  const openAddWorkflowMemberDialog = (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => {
    if (!userId) {
      return;
    }
    setPendingWorkflowMemberAction({ kind: 'add', key, userId, userName: findWorkflowUserName(userId) });
  };

  const openRemoveWorkflowMemberDialog = (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => {
    setPendingWorkflowMemberAction({ kind: 'remove', key, userId, userName: findWorkflowUserName(userId) });
  };

  const removeWorkflowMember = (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => {
    setWorkflowSettings((current) => {
      if (!current) {
        return current;
      }
      const next = current[key].filter((id) => id !== userId);
      return {
        ...current,
        [key]: next,
        requestFallbackAssigneeId: key === 'ticketAssigneeIds' && current.requestFallbackAssigneeId === userId ? null : current.requestFallbackAssigneeId,
        chatFallbackAssigneeId: key === 'chatMemberIds' && current.chatFallbackAssigneeId === userId ? null : current.chatFallbackAssigneeId,
      };
    });
  };

  const handleConfirmWorkflowMemberAction = () => {
    if (!pendingWorkflowMemberAction) {
      return;
    }
    if (pendingWorkflowMemberAction.kind === 'add') {
      addWorkflowMember(pendingWorkflowMemberAction.key, pendingWorkflowMemberAction.userId);
      if (pendingWorkflowMemberAction.key === 'ticketAssigneeIds') {
        setTicketAssigneeDraft('');
      } else {
        setChatMemberDraft('');
      }
    } else {
      removeWorkflowMember(pendingWorkflowMemberAction.key, pendingWorkflowMemberAction.userId);
    }
    setPendingWorkflowMemberAction(null);
  };

  const handleWorkflowSave = async () => {
    if (!workflowSettings) {
      return;
    }
    if (parsedRequestSubjectRoutes.invalidLines.length > 0 || parsedChatSubjectRoutes.invalidLines.length > 0) {
      setError('Workflow subject rules contain invalid lines. Use keyword => assignee-id for each non-empty line before saving.');
      setWorkflowSaveStatus('');
      return;
    }
    try {
      setSavingWorkflow(true);
      setError('');
      setWorkflowSaveStatus('');
      const saved = await apiRequest<WorkflowSettings>('/api/settings/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          ...serializeWorkflowSettings(workflowSettings),
          requestSubjectRoutes: parsedRequestSubjectRoutes.routes,
          chatSubjectRoutes: parsedChatSubjectRoutes.routes,
        }),
      });
      const normalizedSaved = normalizeWorkflowSettings(saved);
      if (!mountedRef.current) {
        return;
      }
      setWorkflowSettings(normalizedSaved);
      setRequestSubjectEditor(routesToEditorText(normalizedSaved.requestSubjectRoutes));
      setChatSubjectEditor(routesToEditorText(normalizedSaved.chatSubjectRoutes));
      setWorkflowSaveStatus('Saved');
      if (workflowSaveStatusTimeoutRef.current !== null) {
        window.clearTimeout(workflowSaveStatusTimeoutRef.current);
      }
      workflowSaveStatusTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        setWorkflowSaveStatus((current) => (current === 'Saved' ? '' : current));
      }, 1600);
    } catch (requestError) {
      if (mountedRef.current) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to save workflow settings');
      }
    } finally {
      if (mountedRef.current) {
        setSavingWorkflow(false);
      }
    }
  };

  return (
    <div className="space-y-5 bg-zinc-50/60 px-4 py-5 sm:px-6 lg:px-8">
      <SettingsOverviewPanel
        canEditWorkflowSettings={canEditWorkflowSettings}
        portalLabel={portalLabel}
        loading={loading}
        refreshing={refreshing}
        error={error}
        installConfig={installConfig}
        syncStatus={syncStatus}
        meta={meta}
        detailSections={detailSections}
        activeSection={activeSection}
        onRefresh={handleRefresh}
        onSelectSection={handleSelectSection}
      />

      {activeSection === 'platform' ? (
        <SettingsPlatformSection
          installConfig={installConfig}
          syncStatus={syncStatus}
          meta={meta}
          sessionUser={session?.user}
          formatDateTime={formatDateTime}
        />
      ) : null}

      {activeSection === 'workflow' && canViewWorkflowSettings && workflowSettings ? (
        <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-[linear-gradient(180deg,_#fcfdff_0%,_#f7fafc_100%)] px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Workflow Routing</h2>
                <p className="mt-1 text-sm text-zinc-500">Control request auto-assignment and chat subject routing from one place.</p>
              </div>
              <div className="flex items-center gap-3">
                {workflowSettings.updatedAt ? <span className="text-xs font-semibold text-zinc-500">Updated {formatDateTime(workflowSettings.updatedAt)}</span> : null}
                <button
                  type="button"
                  onClick={handleWorkflowSave}
                  disabled={savingWorkflow || !canEditWorkflowSettings}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingWorkflow ? 'Saving...' : workflowSaveStatus || (canEditWorkflowSettings ? 'Save routing' : 'Super admin only')}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <SettingsWorkflowMembersPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              hasActiveEmployeeWorkflowUsers={hasActiveEmployeeWorkflowUsers}
              ticketAssigneeDraft={ticketAssigneeDraft}
              chatMemberDraft={chatMemberDraft}
              availableTicketAssigneeOptions={availableTicketAssigneeOptions}
              availableChatMemberOptions={availableChatMemberOptions}
              ticketAssigneeUsers={ticketAssigneeUsers}
              chatMemberUsers={chatMemberUsers}
              onTicketAssigneeDraftChange={setTicketAssigneeDraft}
              onChatMemberDraftChange={setChatMemberDraft}
              onAddWorkflowMember={openAddWorkflowMemberDialog}
              onRemoveWorkflowMember={openRemoveWorkflowMemberDialog}
            />

            <SettingsWorkflowRoutingPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              workflowSettings={workflowSettings}
              ticketAssigneeUsers={ticketAssigneeUsers}
              chatMemberUsers={chatMemberUsers}
              onWorkflowSettingsChange={(patch) => setWorkflowSettings((current) => (current ? { ...current, ...patch } : current))}
            />

            <SettingsPatchPolicyPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              workflowSettings={workflowSettings}
              departments={meta?.departments ?? []}
              getDepartmentRing={patchDepartmentRing}
              onWorkflowSettingsChange={(patch) => setWorkflowSettings((current) => (current ? { ...current, ...patch } : current))}
              onDepartmentRingChange={handlePatchDepartmentRingChange}
            />

            <SettingsRequestTypeOwnersPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              requestRouteTypes={REQUEST_ROUTE_TYPES}
              ticketAssigneeUsers={ticketAssigneeUsers}
              getTypeAssignee={(type) => workflowTypeAssignee(workflowSettings, type)}
              onTypeChange={handleWorkflowTypeChange}
            />

            <SettingsWorkflowRulesPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              requestSubjectEditor={requestSubjectEditor}
              chatSubjectEditor={chatSubjectEditor}
              invalidRequestSubjectRules={parsedRequestSubjectRoutes.invalidLines}
              invalidChatSubjectRules={parsedChatSubjectRoutes.invalidLines}
              onRequestSubjectEditorChange={(value) => {
                setRequestSubjectEditor(value);
                setError((current) => current.startsWith('Workflow subject rules contain invalid lines.') ? '' : current);
              }}
              onChatSubjectEditorChange={(value) => {
                setChatSubjectEditor(value);
                setError((current) => current.startsWith('Workflow subject rules contain invalid lines.') ? '' : current);
              }}
            />
          </div>
        </section>
      ) : null}

      {activeSection === 'bootstrap' ? (
        <SettingsBootstrapSection
          includeLinuxHardinfoFallback={includeLinuxHardinfoFallback}
          copyStatus={copyStatus}
          linuxBootstrapCommand={linuxBootstrapCommand}
          windowsBootstrapCommand={windowsBootstrapCommand}
          linuxSyncCommand={linuxSyncCommand}
          windowsSyncCommand={windowsSyncCommand}
          onIncludeLinuxHardinfoFallbackChange={setIncludeLinuxHardinfoFallback}
          onCopyCommand={(kind, command) => {
            void handleCopyCommand(kind, command);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingWorkflowMemberAction)}
        title={pendingWorkflowMemberAction?.kind === 'remove' ? 'Remove Workflow Member' : 'Add Workflow Member'}
        message={pendingWorkflowMemberAction ? `${pendingWorkflowMemberAction.kind === 'remove' ? 'Remove' : 'Add'} ${pendingWorkflowMemberAction.userName} ${pendingWorkflowMemberAction.kind === 'remove' ? 'from' : 'to'} the ${workflowMemberScopeLabel(pendingWorkflowMemberAction.key)}?` : 'Confirm workflow member update.'}
        confirmLabel={pendingWorkflowMemberAction?.kind === 'remove' ? 'Remove' : 'Add'}
        tone={pendingWorkflowMemberAction?.kind === 'remove' ? 'danger' : 'default'}
        onClose={() => setPendingWorkflowMemberAction(null)}
        onConfirm={handleConfirmWorkflowMemberAction}
      />
    </div>
  );
}
