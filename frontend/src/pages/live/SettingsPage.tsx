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
import {
  buildSettingsLinuxBootstrapCommand,
  buildSettingsLinuxSyncCommand,
  buildSettingsWindowsBootstrapCommand,
  buildSettingsWindowsSyncCommand,
  filterRequestWorkflowUsers,
  formatDateTime,
  isProbeWorkflowUser,
  normalizeDirectoryUsers,
  normalizePatchDepartmentName,
  normalizePatchRing,
  normalizeWorkflowSettings,
  parseEditorTextToRoutes,
  pruneWorkflowSettingsForEligibleUsers,
  resolveWorkflowMemberUsers,
  routesToEditorText,
  serializeWorkflowSettings,
  workflowTypeAssignee,
  type ApiDirectoryUser,
  type DirectoryUser,
  type InstallAgentConfig,
  type WorkflowSettings,
} from './settingsPageUtils';

const LINUX_HARDINFO_PREFERENCE_KEY = 'itms_install_linux_hardinfo_fallback';
const REQUEST_ROUTE_TYPES = ['Laptop change', 'OS reinstall', 'Software install', 'Portal access', 'Settings change', 'General issue', 'Hardware replacement', 'Peripheral request', 'Other'];

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
  const { selectedUsers: selectedTicketAssigneeUsers, effectiveUsers: effectiveTicketAssigneeUsers } = useMemo(
    () => resolveWorkflowMemberUsers(requestWorkflowUsers, workflowSettings?.ticketAssigneeIds),
    [requestWorkflowUsers, workflowSettings?.ticketAssigneeIds],
  );
  const { selectedUsers: selectedChatMemberUsers, effectiveUsers: effectiveChatMemberUsers } = useMemo(
    () => resolveWorkflowMemberUsers(chatWorkflowUsers, workflowSettings?.chatMemberIds),
    [chatWorkflowUsers, workflowSettings?.chatMemberIds],
  );
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
          const requestWorkflowUserItems = filterRequestWorkflowUsers(
            normalizeDirectoryUsers(requestWorkflowUsersData.items || []).filter((user) => !isProbeWorkflowUser(user)),
          );
          const chatWorkflowUserItems = normalizeDirectoryUsers(chatWorkflowUsersData.items || []);
          const requestEligibleUserIds = normalizedWorkflowData
            ? resolveWorkflowMemberUsers(requestWorkflowUserItems, normalizedWorkflowData.ticketAssigneeIds).effectiveUsers.map((user) => user.id)
            : [];
          const chatEligibleUserIds = normalizedWorkflowData
            ? resolveWorkflowMemberUsers(chatWorkflowUserItems, normalizedWorkflowData.chatMemberIds).effectiveUsers.map((user) => user.id)
            : [];
          const prunedWorkflowData = normalizedWorkflowData
            ? pruneWorkflowSettingsForEligibleUsers(normalizedWorkflowData, requestEligibleUserIds, chatEligibleUserIds)
            : normalizedWorkflowData;
          setInstallConfig(installData);
          setSyncStatus(syncData);
          setMeta(metaData);
          setWorkflowSettings(prunedWorkflowData);
          setRequestWorkflowUsers(requestWorkflowUserItems);
          setChatWorkflowUsers(chatWorkflowUserItems);
          setRequestSubjectEditor(routesToEditorText(prunedWorkflowData?.requestSubjectRoutes ?? []));
          setChatSubjectEditor(routesToEditorText(prunedWorkflowData?.chatSubjectRoutes ?? []));
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
      const requestWorkflowUserItems = filterRequestWorkflowUsers(
        normalizeDirectoryUsers(requestWorkflowUsersData.items || []).filter((user) => !isProbeWorkflowUser(user)),
      );
      const chatWorkflowUserItems = normalizeDirectoryUsers(chatWorkflowUsersData.items || []);
      const requestEligibleUserIds = normalizedWorkflowData
        ? resolveWorkflowMemberUsers(requestWorkflowUserItems, normalizedWorkflowData.ticketAssigneeIds).effectiveUsers.map((user) => user.id)
        : [];
      const chatEligibleUserIds = normalizedWorkflowData
        ? resolveWorkflowMemberUsers(chatWorkflowUserItems, normalizedWorkflowData.chatMemberIds).effectiveUsers.map((user) => user.id)
        : [];
      const prunedWorkflowData = normalizedWorkflowData
        ? pruneWorkflowSettingsForEligibleUsers(normalizedWorkflowData, requestEligibleUserIds, chatEligibleUserIds)
        : normalizedWorkflowData;
      if (!mountedRef.current) {
        return;
      }
      setInstallConfig(installData);
      setSyncStatus(syncData);
      setMeta(metaData);
      setWorkflowSettings(prunedWorkflowData);
      setRequestWorkflowUsers(requestWorkflowUserItems);
      setChatWorkflowUsers(chatWorkflowUserItems);
      setRequestSubjectEditor(routesToEditorText(prunedWorkflowData?.requestSubjectRoutes ?? []));
      setChatSubjectEditor(routesToEditorText(prunedWorkflowData?.chatSubjectRoutes ?? []));
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

  const patchDepartmentRing = (departmentName: string) => {
    const ring = workflowSettings?.patchDepartmentRings.find((route) => normalizePatchDepartmentName(route.match) === normalizePatchDepartmentName(departmentName))?.ring || '';
    return ring === 'standard' ? '' : ring;
  };

  const handlePatchDepartmentRingChange = (departmentName: string, ring: string) => {
    setWorkflowSettings((current) => {
      if (!current) {
        return current;
      }
      const match = normalizePatchDepartmentName(departmentName);
      const remaining = current.patchDepartmentRings.filter((route) => normalizePatchDepartmentName(route.match) !== match);
      const normalizedRing = normalizePatchRing(ring);
      return {
        ...current,
        patchDepartmentRings: normalizedRing && normalizedRing !== 'standard' ? [...remaining, { match, ring: normalizedRing }] : remaining,
      };
    });
  };

  const workflowMemberScopeLabel = (key: 'ticketAssigneeIds' | 'chatMemberIds') => key === 'ticketAssigneeIds' ? 'ticket assignee list' : 'chat member list';

  const findWorkflowUserName = (userId: string) => requestWorkflowUsers.find((user) => user.id === userId)?.fullName || chatWorkflowUsers.find((user) => user.id === userId)?.fullName || 'Selected teammate';

  const addWorkflowMember = (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => {
    if (!userId || !workflowSettings) {
      return;
    }

    if (workflowSettings[key].includes(userId)) {
      return;
    }

    const nextSelectedIds = [...workflowSettings[key], userId];
    const requestEligibleUserIds = resolveWorkflowMemberUsers(
      requestWorkflowUsers,
      key === 'ticketAssigneeIds' ? nextSelectedIds : workflowSettings.ticketAssigneeIds,
    ).effectiveUsers.map((user) => user.id);
    const chatEligibleUserIds = resolveWorkflowMemberUsers(
      chatWorkflowUsers,
      key === 'chatMemberIds' ? nextSelectedIds : workflowSettings.chatMemberIds,
    ).effectiveUsers.map((user) => user.id);
    const nextWorkflowSettings = pruneWorkflowSettingsForEligibleUsers(
      {
        ...workflowSettings,
        [key]: nextSelectedIds,
      },
      requestEligibleUserIds,
      chatEligibleUserIds,
      parsedRequestSubjectRoutes.invalidLines.length === 0 ? parsedRequestSubjectRoutes.routes : workflowSettings.requestSubjectRoutes,
      parsedChatSubjectRoutes.invalidLines.length === 0 ? parsedChatSubjectRoutes.routes : workflowSettings.chatSubjectRoutes,
    );

    setWorkflowSettings(nextWorkflowSettings);

    if (parsedRequestSubjectRoutes.invalidLines.length === 0) {
      setRequestSubjectEditor(routesToEditorText(nextWorkflowSettings.requestSubjectRoutes));
    }
    if (parsedChatSubjectRoutes.invalidLines.length === 0) {
      setChatSubjectEditor(routesToEditorText(nextWorkflowSettings.chatSubjectRoutes));
    }
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
    if (!workflowSettings) {
      return;
    }

    const nextSelectedIds = workflowSettings[key].filter((id) => id !== userId);
    const requestEligibleUserIds = resolveWorkflowMemberUsers(
      requestWorkflowUsers,
      key === 'ticketAssigneeIds' ? nextSelectedIds : workflowSettings.ticketAssigneeIds,
    ).effectiveUsers.map((user) => user.id);
    const chatEligibleUserIds = resolveWorkflowMemberUsers(
      chatWorkflowUsers,
      key === 'chatMemberIds' ? nextSelectedIds : workflowSettings.chatMemberIds,
    ).effectiveUsers.map((user) => user.id);
    const nextWorkflowSettings = pruneWorkflowSettingsForEligibleUsers(
      {
        ...workflowSettings,
        [key]: nextSelectedIds,
      },
      requestEligibleUserIds,
      chatEligibleUserIds,
      parsedRequestSubjectRoutes.invalidLines.length === 0 ? parsedRequestSubjectRoutes.routes : workflowSettings.requestSubjectRoutes,
      parsedChatSubjectRoutes.invalidLines.length === 0 ? parsedChatSubjectRoutes.routes : workflowSettings.chatSubjectRoutes,
    );

    setWorkflowSettings(nextWorkflowSettings);

    if (parsedRequestSubjectRoutes.invalidLines.length === 0) {
      setRequestSubjectEditor(routesToEditorText(nextWorkflowSettings.requestSubjectRoutes));
    }
    if (parsedChatSubjectRoutes.invalidLines.length === 0) {
      setChatSubjectEditor(routesToEditorText(nextWorkflowSettings.chatSubjectRoutes));
    }
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
      const prunedWorkflowSettings = pruneWorkflowSettingsForEligibleUsers(
        workflowSettings,
        effectiveTicketAssigneeUsers.map((user) => user.id),
        effectiveChatMemberUsers.map((user) => user.id),
        parsedRequestSubjectRoutes.routes,
        parsedChatSubjectRoutes.routes,
      );
      const saved = await apiRequest<WorkflowSettings>('/api/settings/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          ...serializeWorkflowSettings(prunedWorkflowSettings),
        }),
      });
      const normalizedSaved = pruneWorkflowSettingsForEligibleUsers(
        normalizeWorkflowSettings(saved),
        effectiveTicketAssigneeUsers.map((user) => user.id),
        effectiveChatMemberUsers.map((user) => user.id),
      );
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
    <>
    <style>{`
      .settings-page-root { color: #0F1B2D !important; }
      .settings-page-root *, .settings-page-root *::before, .settings-page-root *::after { color: #0F1B2D !important; }
      .settings-page-root .text-ink { color: #0F1B2D !important; }
      .settings-page-root .text-muted { color: #8C96A4 !important; }
      .settings-page-root .text-primary { color: #2667E8 !important; }
      .settings-page-root .text-white { color: white !important; }
      .settings-page-root .text-success { color: #30A46C !important; }
      .settings-page-root .text-warning { color: #FFB224 !important; }
      .settings-page-root .text-danger { color: #E5484D !important; }
      .settings-page-root .bg-white { background-color: white !important; }
    `}</style>
    <div className="space-y-5 bg-zinc-50/60 px-4 py-5 sm:px-6 lg:px-8 settings-page-root">
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
              ticketAssigneeUsers={selectedTicketAssigneeUsers}
              chatMemberUsers={selectedChatMemberUsers}
              onTicketAssigneeDraftChange={setTicketAssigneeDraft}
              onChatMemberDraftChange={setChatMemberDraft}
              onAddWorkflowMember={openAddWorkflowMemberDialog}
              onRemoveWorkflowMember={openRemoveWorkflowMemberDialog}
            />

            <SettingsWorkflowRoutingPanel
              canEditWorkflowSettings={canEditWorkflowSettings}
              workflowSettings={workflowSettings}
              ticketAssigneeUsers={effectiveTicketAssigneeUsers}
              chatMemberUsers={effectiveChatMemberUsers}
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
              ticketAssigneeUsers={effectiveTicketAssigneeUsers}
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
    </>
  );
}
