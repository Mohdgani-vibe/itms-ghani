import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users as UsersIcon } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import UserAccessCard from '../../components/users/UserAccessCard';
import UserAccessToolbar from '../../components/users/UserAccessToolbar';
import UserAssignedAssetsPanel from '../../components/users/UserAssignedAssetsPanel';
import UserAuditList from '../../components/users/UserAuditList';
import UserAuditToolbar from '../../components/users/UserAuditToolbar';
import UserBulkActionsPanel from '../../components/users/UserBulkActionsPanel';
import UserDepartmentSidebar from '../../components/users/UserDepartmentSidebar';
import UserEmployeeCreationPanel from '../../components/users/UserEmployeeCreationPanel';
import UserEditorDialog from '../../components/users/UserEditorDialog';
import UserDirectoryCard from '../../components/users/UserDirectoryCard';
import UserDirectoryFiltersPanel from '../../components/users/UserDirectoryFiltersPanel';
import UserDirectoryListPanel from '../../components/users/UserDirectoryListPanel';
import UserInstallSidebar from '../../components/users/UserInstallSidebar';
import UserInstallWorkspace from '../../components/users/UserInstallWorkspace';
import UserImportsPanel from '../../components/users/UserImportsPanel';
import UsersPageDialogs from '../../components/users/UsersPageDialogs';
import UsersPageHeader from '../../components/users/UsersPageHeader';
import UsersPageFeedback from '../../components/users/UsersPageFeedback';
import { ACCESS_AUDIT_ACTION_PRESETS, assetPresenceState, type AuditModule, formatAssignmentAge, formatAuditActionLabel, formatAuditModuleLabel, formatCurrency, formatToolStatusLabel, formatWarranty, getAuditModule, getToolBadgeClasses, resolveAuditEntityPath, TOOL_STATUS_ITEMS } from '../../components/users/userDisplayUtils';
import { PORTAL_CHOICES, type ApiUserRecord, formatPortalLabel, formatRoleNameLabel, mergeDepartmentSuggestions, normalizePortalSelection, normalizeSelectFilterValue, normalizeUsers, portalsToRole, type LookupOption, type UserRecord } from '../../components/users/userDirectoryUtils';
import { useEmployeeCreationWorkflow } from '../../components/users/useEmployeeCreationWorkflow';
import { type InstallAgentConfig } from '../../components/users/userInstallCommandUtils';
import { useUserInstallWorkflow } from '../../components/users/useUserInstallWorkflow';
import { useUserEditorWorkflow } from '../../components/users/useUserEditorWorkflow';
import { useUserPortalAccessWorkflow } from '../../components/users/useUserPortalAccessWorkflow';
import { useUserStatusWorkflow } from '../../components/users/useUserStatusWorkflow';
import { useUsersCsvWorkflow } from '../../components/users/useUsersCsvWorkflow';
import { getStoredSession } from '../../lib/session';
import Pagination from '../../components/Pagination';

const USERS_PAGE_SIZE = 18;
const AUDIT_PAGE_SIZE = 25;
interface NamedCount {
  name: string;
  count: number;
}

interface PaginatedUsersResponse {
  items: ApiUserRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    departmentCounts?: NamedCount[];
    assetTotal?: number;
  };
}

interface DeviceAsset {
  id: string;
  assetTag: string;
  hostname: string;
  rustdeskId?: string | null;
  cost?: string | null;
  osName?: string | null;
  lastSeenAt?: string | null;
  category?: string | null;
  serialNumber: string;
  specs: string;
  warrantyExpiresAt: string;
  assignedAt?: string;
  status: string;
  kind: 'device';
  name: string;
  toolStatus?: {
    salt?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string; identifier?: string | null };
    wazuh?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string; identifier?: string | null };
    openscap?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string; identifier?: string | null };
    clamav?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string; identifier?: string | null };
  };
}


interface InventoryAsset {
  id: string;
  itemCode: string;
  name: string;
  serialNumber: string;
  specs: string;
  warrantyExpiresAt: string;
  cost?: string | null;
  assignedAt?: string;
  status: string;
  kind: 'inventory';
}

interface UserAssetsResponse {
  devices: DeviceAsset[];
  items: InventoryAsset[];
}

interface AvailableDeviceRecord {
  id: string;
  assetId?: string;
  hostname: string;
  serialNumber?: string | null;
  model?: string | null;
  status: string;
  branch?: { name?: string } | null;
  department?: { name?: string } | null;
}

interface PaginatedDevicesResponse {
  items: AvailableDeviceRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface UserMetaOptionsResponse {
  roles: LookupOption[];
  departments: LookupOption[];
  branches: LookupOption[];
}

interface EntityOption {
  id: string;
  short_code: string;
  full_name: string;
  is_active: boolean;
}

interface PendingAssetAction {
  assetId: string;
  action: 'unassign' | 'delete';
}

interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
  module?: string;
  actor?: { fullName: string; email: string } | null;
  subject?: { fullName: string } | null;
}

interface PaginatedAuditResponse {
  items: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    moduleCounts?: NamedCount[];
  };
}

type DirectoryTab = 'directory' | 'employee' | 'imports' | 'install' | 'access' | 'audit' | 'unassigned';
type UserStatusFilter = 'all' | 'active' | 'inactive';
type UserSystemAssignmentFilter = 'all' | 'assigned' | 'unassigned';
type UserSelectFilter = 'all' | string;

export default function UsersPage() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/users')[0];
  const isSuperAdmin = session?.user.role === 'super_admin';
  const isAuditor = session?.user.role === 'auditor';
  const [activeTab, setActiveTab] = useState<DirectoryTab>('directory');
  const [directoryUsers, setDirectoryUsers] = useState<UserRecord[]>([]);
  const [installUsers, setInstallUsers] = useState<UserRecord[]>([]);
  const [accessUsers, setAccessUsers] = useState<UserRecord[]>([]);
  const [assets, setAssets] = useState<UserAssetsResponse>({ devices: [], items: [] });
  const [availableDevices, setAvailableDevices] = useState<AvailableDeviceRecord[]>([]);
  const [auditItems, setAuditItems] = useState<AuditRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<UserSelectFilter>('all');
  const [userEntityFilter, setUserEntityFilter] = useState<UserSelectFilter>('all');
  const [userBranchFilter, setUserBranchFilter] = useState<UserSelectFilter>('all');
  const [userSystemAssignmentFilter, setUserSystemAssignmentFilter] = useState<UserSystemAssignmentFilter>('all');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [installPage, setInstallPage] = useState(1);
  const [accessPage, setAccessPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [availableDevicesLoading, setAvailableDevicesLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModuleFilter, setAuditModuleFilter] = useState<AuditModule>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [assetActionLoadingId, setAssetActionLoadingId] = useState('');
  const [availableDeviceActionLoadingId, setAvailableDeviceActionLoadingId] = useState('');
  const [installConfig, setInstallConfig] = useState<InstallAgentConfig | null>(null);
  const [installConfigLoading, setInstallConfigLoading] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<LookupOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<LookupOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<LookupOption[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [pendingAssetAction, setPendingAssetAction] = useState<PendingAssetAction | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usersReloadKey, setUsersReloadKey] = useState(0);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [installTotal, setInstallTotal] = useState(0);
  const [accessTotal, setAccessTotal] = useState(0);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [directorySummary, setDirectorySummary] = useState<{ departmentCounts: NamedCount[]; assetTotal: number }>({ departmentCounts: [], assetTotal: 0 });
  const [auditSummary, setAuditSummary] = useState<{ moduleCounts: NamedCount[] }>({ moduleCounts: [] });

  const activePagedUsers = useMemo(() => (activeTab === 'install' ? installUsers : directoryUsers), [activeTab, directoryUsers, installUsers]);

  const mergedDepartmentOptions = useMemo(() => mergeDepartmentSuggestions(departmentOptions), [departmentOptions]);
  const directoryScopedUserFilters = useMemo(() => ({
    search: searchQuery,
    departmentLabel: departmentFilter,
    excludeRole: 'super_admin',
    status: userStatusFilter !== 'all' ? userStatusFilter : undefined,
    role: userRoleFilter !== 'all' ? userRoleFilter : undefined,
    entityId: userEntityFilter !== 'all' ? userEntityFilter : undefined,
    locationId: userBranchFilter !== 'all' ? userBranchFilter : undefined,
    deviceAssignment: activeTab === 'unassigned'
      ? 'unassigned'
      : userSystemAssignmentFilter !== 'all'
        ? userSystemAssignmentFilter
        : undefined,
  }), [activeTab, departmentFilter, searchQuery, userBranchFilter, userEntityFilter, userRoleFilter, userStatusFilter, userSystemAssignmentFilter]);
  const accessScopedUserFilters = useMemo(() => ({
    status: userStatusFilter !== 'all' ? userStatusFilter : undefined,
    role: userRoleFilter !== 'all' ? userRoleFilter : undefined,
    entityId: userEntityFilter !== 'all' ? userEntityFilter : undefined,
    locationId: userBranchFilter !== 'all' ? userBranchFilter : undefined,
  }), [userBranchFilter, userEntityFilter, userRoleFilter, userStatusFilter]);
  const unassignedBadgeFilters = useMemo(() => ({
    excludeRole: 'super_admin',
    status: userStatusFilter !== 'all' ? userStatusFilter : undefined,
    role: userRoleFilter !== 'all' ? userRoleFilter : undefined,
    entityId: userEntityFilter !== 'all' ? userEntityFilter : undefined,
    locationId: userBranchFilter !== 'all' ? userBranchFilter : undefined,
    departmentLabel: departmentFilter !== 'all' ? departmentFilter : undefined,
    deviceAssignment: 'unassigned' as const,
  }), [departmentFilter, userBranchFilter, userEntityFilter, userRoleFilter, userStatusFilter]);
  const previousDirectoryFiltersRef = useRef(directoryScopedUserFilters);
  const previousAccessFiltersRef = useRef(accessScopedUserFilters);

  const bulkActionUsers = useMemo(() => {
    if (activeTab === 'access') {
      return accessUsers;
    }
    if (activeTab === 'directory' || activeTab === 'unassigned') {
      return directoryUsers;
    }
    return [] as UserRecord[];
  }, [accessUsers, activeTab, directoryUsers]);

  const bulkSelectableUsers = useMemo(
    () => bulkActionUsers.filter((user) => user.id !== session?.user.id),
    [bulkActionUsers, session?.user.id],
  );

  const triggerUsersReload = useCallback(() => {
    setUsersReloadKey((current) => current + 1);
  }, []);

  const {
    editingUser,
    userEditorMode,
    savingEditedUser,
    closeUserEditor,
    openUserEditor,
    updateEditingUserField,
    handleSaveEditedUser,
  } = useUserEditorWorkflow({
    activeTab,
    isSuperAdmin,
    triggerUsersReload,
    setError,
    setSuccessMessage,
  });

  const {
    userImportInputRef,
    csvActionLoading,
    importingUsers,
    openImportPicker,
    handleDownloadUsersCsv,
    handleImportUsers,
  } = useUsersCsvWorkflow({
    token: session?.token,
    activeTab,
    searchQuery,
    departmentFilter,
    userRoleFilter,
    userStatusFilter,
    userEntityFilter,
    userBranchFilter,
    setError,
    setSuccessMessage,
    setDirectoryPage,
    setInstallPage,
    setAccessPage,
    setSelectedUserId,
    setActiveTab,
    triggerUsersReload,
  });

  const {
    pendingUserAction,
    pendingBulkUserAction,
    selectedBulkUserIds,
    selectedBulkUsers,
    allVisibleBulkUsersSelected,
    userActionLoadingId,
    bulkUserActionLoading,
    setPendingUserAction,
    setPendingBulkUserAction,
    toggleBulkUserSelection,
    toggleSelectAllVisibleUsers,
    requestBulkUserAction,
    requestUserAction,
    handleUserStatusAction,
    handleBulkUserStatusAction,
  } = useUserStatusWorkflow({
    activeTab,
    sessionUserId: session?.user.id,
    isSuperAdmin,
    bulkSelectableUsers,
    triggerUsersReload,
    setError,
    setSuccessMessage,
  });

  useEffect(() => {
    if (activeTab === 'access' && !isSuperAdmin) {
      setActiveTab('directory');
    }
    if (isAuditor && activeTab !== 'directory') {
      setActiveTab('directory');
    }
  }, [activeTab, isAuditor, isSuperAdmin]);

  const loadUsersPage = useCallback(async (options: {
    page: number;
    search?: string;
    departmentLabel?: string;
    excludeRole?: string;
    role?: string;
    status?: string;
    entityId?: string;
    locationId?: string;
    deviceAssignment?: UserSystemAssignmentFilter;
    pageSize?: number;
  }) => {
    const params = new URLSearchParams({
      paginate: '1',
      page: String(options.page),
      page_size: String(options.pageSize || USERS_PAGE_SIZE),
    });

    if (options.search?.trim()) {
      params.set('search', options.search.trim());
    }
    if (options.departmentLabel && options.departmentLabel !== 'all') {
      params.set('department_label', options.departmentLabel);
    }
    if (options.excludeRole) {
      params.set('exclude_role', options.excludeRole);
    }
    if (options.role) {
      params.set('role', options.role);
    }
    if (options.status) {
      params.set('status', options.status);
    }
    if (options.entityId) {
      params.set('entity', options.entityId);
    }
    if (options.locationId) {
      params.set('location', options.locationId);
    }
    if (options.deviceAssignment && options.deviceAssignment !== 'all') {
      params.set('device_assignment', options.deviceAssignment);
    }

    return apiRequest<PaginatedUsersResponse>(`/api/users?${params.toString()}`);
  }, []);

  const {
    portalDrafts,
    accessSavingUserId,
    handlePortalToggle,
    handlePortalSave,
  } = useUserPortalAccessWorkflow({
    accessUsers,
    accessPage,
    accessScopedUserFilters,
    directoryScopedUserFilters,
    isSuperAdmin,
    setError,
    setSuccessMessage,
    loadUsersPage,
    setAccessUsers,
    setAccessTotal,
    setDirectorySummary,
  });

  const refreshUserSummary = useCallback(async () => {
    const data = await loadUsersPage({ page: 1, ...directoryScopedUserFilters });
    setDirectoryTotal(data.total);
    setDirectorySummary({
      departmentCounts: data.summary?.departmentCounts || [],
      assetTotal: data.summary?.assetTotal || 0,
    });
  }, [directoryScopedUserFilters, loadUsersPage]);

  useEffect(() => {
    void refreshUserSummary();
  }, [refreshUserSummary, usersReloadKey]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setUnassignedTotal(0);
      return;
    }

    let cancelled = false;

    const loadUnassignedTotal = async () => {
      try {
        const data = await loadUsersPage({ page: 1, ...unassignedBadgeFilters });
        if (!cancelled) {
          setUnassignedTotal(data.total);
        }
      } catch {
        if (!cancelled) {
          setUnassignedTotal(0);
        }
      }
    };

    void loadUnassignedTotal();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, loadUsersPage, unassignedBadgeFilters, usersReloadKey]);

  useEffect(() => {
    let cancelled = false;

    const loadDirectoryUsers = async () => {
      try {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        const [data, summary] = await Promise.all([
          loadUsersPage({
            page: directoryPage,
            ...directoryScopedUserFilters,
          }),
          loadUsersPage({
            page: 1,
            ...directoryScopedUserFilters,
          }),
        ]);
        if (cancelled) {
          return;
        }

        const normalizedUsers = normalizeUsers(data.items);
        setDirectoryUsers(normalizedUsers);
        setDirectoryTotal(data.total);
        setDirectorySummary({
          departmentCounts: summary.summary?.departmentCounts || [],
          assetTotal: summary.summary?.assetTotal || 0,
        });
        setSelectedUserId((current) => current || normalizedUsers[0]?.id || '');
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (activeTab === 'directory') {
      const previousFilters = previousDirectoryFiltersRef.current;
      const filtersChanged = JSON.stringify(previousFilters) !== JSON.stringify(directoryScopedUserFilters);

      if (filtersChanged && directoryPage !== 1) {
        return () => {
          cancelled = true;
        };
      }

      previousDirectoryFiltersRef.current = directoryScopedUserFilters;
      void loadDirectoryUsers();
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, directoryPage, directoryScopedUserFilters, loadUsersPage, usersReloadKey]);

  useEffect(() => {
    if (activeTab !== 'install') {
      return;
    }

    let cancelled = false;

    const loadInstallUsers = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await loadUsersPage({
          page: installPage,
          ...directoryScopedUserFilters,
        });
        if (cancelled) {
          return;
        }

        const normalizedUsers = normalizeUsers(data.items);
        setInstallUsers(normalizedUsers);
        setInstallTotal(data.total);
        setSelectedUserId((current) => current || normalizedUsers[0]?.id || '');
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const previousFilters = previousDirectoryFiltersRef.current;
    const filtersChanged = JSON.stringify(previousFilters) !== JSON.stringify(directoryScopedUserFilters);

    if (filtersChanged && installPage !== 1) {
      return () => {
        cancelled = true;
      };
    }

    previousDirectoryFiltersRef.current = directoryScopedUserFilters;
    void loadInstallUsers();

    return () => {
      cancelled = true;
    };
  }, [activeTab, directoryScopedUserFilters, installPage, loadUsersPage, usersReloadKey]);

  useEffect(() => {
    if (activeTab !== 'access') {
      return;
    }

    if (!isSuperAdmin) {
      return;
    }

    let cancelled = false;

    const loadAccessUsers = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await loadUsersPage({
          page: accessPage,
          ...accessScopedUserFilters,
        });
        if (cancelled) {
          return;
        }

        setAccessUsers(normalizeUsers(data.items));
        setAccessTotal(data.total);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const previousFilters = previousAccessFiltersRef.current;
    const filtersChanged = JSON.stringify(previousFilters) !== JSON.stringify(accessScopedUserFilters);

    if (filtersChanged && accessPage !== 1) {
      return () => {
        cancelled = true;
      };
    }

    previousAccessFiltersRef.current = accessScopedUserFilters;
    void loadAccessUsers();

    return () => {
      cancelled = true;
    };
  }, [accessPage, accessScopedUserFilters, activeTab, isSuperAdmin, loadUsersPage, usersReloadKey]);

  useEffect(() => {
    if (!selectedUserId || (activeTab !== 'directory' && activeTab !== 'unassigned')) {
      return;
    }

    let cancelled = false;

    const loadAssets = async () => {
      try {
        setAssetsLoading(true);
        setSuccessMessage('');
        const data = await apiRequest<UserAssetsResponse>(`/api/users/${selectedUserId}/assets`);
        if (!cancelled) {
          setAssets(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load user assets');
        }
      } finally {
        if (!cancelled) {
          setAssetsLoading(false);
        }
      }
    };

    void loadAssets();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedUserId]);

  useEffect(() => {
    if (activeTab !== 'unassigned' || !selectedUserId || isAuditor) {
      setAvailableDevices([]);
      setAvailableDevicesLoading(false);
      return;
    }

    let cancelled = false;

    const loadAvailableDevices = async () => {
      try {
        setAvailableDevicesLoading(true);
        const data = await apiRequest<PaginatedDevicesResponse>('/api/devices?paginate=1&page=1&page_size=12&assigned=unassigned');
        if (!cancelled) {
          setAvailableDevices(data.items || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setAvailableDevices([]);
          setError(requestError instanceof Error ? requestError.message : 'Failed to load unassigned systems');
        }
      } finally {
        if (!cancelled) {
          setAvailableDevicesLoading(false);
        }
      }
    };

    void loadAvailableDevices();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuditor, selectedUserId, usersReloadKey]);

  useEffect(() => {
    if (activeTab !== 'access' && activeTab !== 'install' && activeTab !== 'employee' && activeTab !== 'imports') {
      return;
    }

    let cancelled = false;

    const loadMetaOptions = async () => {
      try {
        const [data, entities] = await Promise.all([
          apiRequest<UserMetaOptionsResponse>('/api/users/meta/options'),
          apiRequest<EntityOption[]>('/api/entities'),
        ]);
        if (!cancelled) {
          setRoleOptions(data.roles || []);
          setDepartmentOptions(data.departments || []);
          setBranchOptions(data.branches || []);
          setEntityOptions(Array.isArray(entities) ? entities : []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load access options');
        }
      }
    };

    void loadMetaOptions();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'install') {
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
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load install-agent configuration');
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
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'audit') {
      return;
    }

    let cancelled = false;

    const loadAudit = async () => {
      try {
        setAuditLoading(true);
        const params = new URLSearchParams({
          paginate: '1',
          page: String(auditPage),
          page_size: String(AUDIT_PAGE_SIZE),
        });
        if (auditModuleFilter !== 'all') {
          params.set('module', auditModuleFilter);
        }
        if (auditSearchQuery.trim()) {
          params.set('search', auditSearchQuery.trim());
        }
        if (auditActionFilter.trim()) {
          params.set('action', auditActionFilter.trim());
        }
        const data = await apiRequest<PaginatedAuditResponse>(`/api/audit?${params.toString()}`);
        if (!cancelled) {
          setAuditItems(data.items || []);
          setAuditTotal(data.total || 0);
          setAuditSummary({ moduleCounts: data.summary?.moduleCounts || [] });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load audit activity');
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    };

    void loadAudit();

    return () => {
      cancelled = true;
    };
  }, [activeTab, auditActionFilter, auditModuleFilter, auditPage, auditSearchQuery]);

  const departmentCounts = useMemo(() => {
    return directorySummary.departmentCounts;
  }, [directorySummary.departmentCounts]);

  useEffect(() => {
    setDirectoryPage((page) => (page === 1 ? page : 1));
    setInstallPage((page) => (page === 1 ? page : 1));
    setAccessPage((page) => (page === 1 ? page : 1));
  }, [departmentFilter, searchQuery, userStatusFilter, userRoleFilter, userEntityFilter, userBranchFilter]);

  useEffect(() => {
    if (activeTab !== 'directory' && activeTab !== 'install' && activeTab !== 'unassigned') {
      return;
    }

    if (!activePagedUsers.length) {
      setSelectedUserId('');
      return;
    }

    if (!activePagedUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(activePagedUsers[0].id);
    }
  }, [activePagedUsers, activeTab, selectedUserId]);

  const selectedUser = activePagedUsers.find((user) => user.id === selectedUserId) || null;
  const {
    installAssignedToName,
    installAssignedToEmail,
    installEmployeeCode,
    installDepartmentName,
    includeLinuxHardinfoFallback,
    copyStatus,
    installEmailValid,
    installFieldsComplete,
    linuxInstallCommand,
    linuxSyncCommand,
    windowsInstallCommand,
    windowsSyncCommand,
    setInstallAssignedToName,
    setInstallAssignedToEmail,
    setInstallEmployeeCode,
    setInstallDepartmentName,
    setIncludeLinuxHardinfoFallback,
    handleCopyCommand,
  } = useUserInstallWorkflow({
    selectedUser,
    installConfig,
    setError,
    setSuccessMessage,
  });
  const activeEntityOptions = useMemo(() => {
    const activeItems = entityOptions.filter((entity) => entity.is_active);
    return activeItems.length ? activeItems : entityOptions;
  }, [entityOptions]);

  const {
    setSelectedEmployeeEntityId,
    creatingEmployee,
    employeeForm,
    defaultEntityId,
    defaultEntityLabel,
    updateEmployeeFormField,
    handleCreateEmployee,
  } = useEmployeeCreationWorkflow({
    activeEntityOptions,
    selectedUser,
    triggerUsersReload,
    setDirectoryPage,
    setActiveTab,
    setError,
    setSuccessMessage,
  });

  const availableRoleOptions = useMemo(() => {
    const options = roleOptions.length
      ? roleOptions
      : PORTAL_CHOICES.map((portal) => ({ id: portal.id, name: portal.id }));

    if (employeeForm.role && !options.some((option) => option.name === employeeForm.role)) {
      return [...options, { id: employeeForm.role, name: employeeForm.role }];
    }

    return options;
  }, [employeeForm.role, roleOptions]);

  const selectedAssets = useMemo(() => [...assets.devices, ...assets.items], [assets.devices, assets.items]);
  const auditModuleCounts = useMemo(() => {
    const counts = new Map<AuditModule, number>();
    auditSummary.moduleCounts.forEach((entry) => {
      counts.set(entry.name as AuditModule, entry.count);
    });
    return counts;
  }, [auditSummary.moduleCounts]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditModuleFilter, auditSearchQuery]);

  const refreshSelectedUserAssets = async () => {
    if (!selectedUserId) {
      return;
    }

    const [usersData, assetsData] = await Promise.all([
      loadUsersPage({
        page: activeTab === 'install' ? installPage : directoryPage,
        ...directoryScopedUserFilters,
      }),
      apiRequest<UserAssetsResponse>(`/api/users/${selectedUserId}/assets`),
    ]);

    const normalizedUsers = normalizeUsers(usersData.items);
    if (activeTab === 'install') {
      setInstallUsers(normalizedUsers);
      setInstallTotal(usersData.total);
    } else {
      setDirectoryUsers(normalizedUsers);
      setDirectoryTotal(usersData.total);
    }
    setAssets(assetsData);
    await refreshUserSummary();
  };


  const handleInventoryAction = async (assetId: string, action: 'return' | 'retire') => {
    if (!selectedUserId) {
      return;
    }

    try {
      setAssetActionLoadingId(assetId);
      setError('');
      setSuccessMessage('');
      await apiRequest<{ status: string }>(`/api/inventory/${assetId}/${action}`, { method: 'POST' });

      await refreshSelectedUserAssets();
      setSuccessMessage(`Inventory item ${action === 'retire' ? 'scrapped' : 'returned'} successfully.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to ${action === 'retire' ? 'scrap' : action} inventory item`);
    } finally {
      setAssetActionLoadingId('');
    }
  };

  const handleAssetAction = async (assetId: string, action: 'unassign' | 'delete') => {
    try {
      setAssetActionLoadingId(assetId);
      setError('');
      setSuccessMessage('');
      await apiRequest(action === 'delete' ? `/api/assets/${assetId}` : `/api/assets/${assetId}/unassign`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
      });
      await refreshSelectedUserAssets();
      setPendingAssetAction(null);
      setSuccessMessage(action === 'delete' ? 'Asset deleted successfully.' : 'Asset removed from user successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to ${action} asset`);
    } finally {
      setAssetActionLoadingId('');
    }
  };

  const handleAssignAvailableDevice = async (assetId: string) => {
    if (!selectedUserId || !selectedUser) {
      return;
    }

    try {
      setAvailableDeviceActionLoadingId(assetId);
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/assets/${assetId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      triggerUsersReload();
      await refreshSelectedUserAssets();
      setSuccessMessage(`Assigned the selected system to ${selectedUser.fullName}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to assign system');
    } finally {
      setAvailableDeviceActionLoadingId('');
    }
  };

  return (
    <>
    <style>{`
      .users-page-root { color: #0F1B2D !important; }
      .users-page-root *, .users-page-root *::before, .users-page-root *::after { color: #0F1B2D !important; }
      .users-page-root .text-ink { color: #0F1B2D !important; }
      .users-page-root .text-muted { color: #8C96A4 !important; }
      .users-page-root .text-primary { color: #2667E8 !important; }
      .users-page-root .text-white { color: white !important; }
      .users-page-root .text-success { color: #30A46C !important; }
      .users-page-root .text-warning { color: #FFB224 !important; }
      .users-page-root .text-danger { color: #E5484D !important; }
      .users-page-root .bg-white { background-color: white !important; }
    `}</style>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 users-page-root">
      <div className="max-w-7xl mx-auto px-4 py-8 xl:px-6 space-y-6">
        <UsersPageHeader
          directoryTotal={directoryTotal}
          departmentCount={departmentCounts.length}
          assetTotal={directorySummary.assetTotal}
          auditTotal={auditTotal}
          unassignedTotal={unassignedTotal}
          activeTab={activeTab}
          isSuperAdmin={isSuperAdmin}
          isAuditor={isAuditor}
          UsersIcon={UsersIcon}
          onTabChange={setActiveTab}
        />

      <input
        ref={userImportInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => void handleImportUsers(event)}
      />

      <UsersPageFeedback error={error} successMessage={successMessage} />

      <UsersPageDialogs
        pendingAssetAction={pendingAssetAction}
        pendingUserAction={pendingUserAction}
        pendingBulkUserAction={pendingBulkUserAction}
        assetActionLoadingId={assetActionLoadingId}
        userActionLoadingId={userActionLoadingId}
        bulkUserActionLoading={bulkUserActionLoading}
        onCloseAssetAction={() => setPendingAssetAction(null)}
        onConfirmAssetAction={() => {
          if (pendingAssetAction) {
            void handleAssetAction(pendingAssetAction.assetId, pendingAssetAction.action);
          }
        }}
        onCloseUserAction={() => setPendingUserAction(null)}
        onConfirmUserAction={() => { void handleUserStatusAction(); }}
        onCloseBulkUserAction={() => setPendingBulkUserAction(null)}
        onConfirmBulkUserAction={() => { void handleBulkUserStatusAction(); }}
      />

      <UserEditorDialog
        editingUser={editingUser}
        userEditorMode={userEditorMode}
        savingEditedUser={savingEditedUser}
        availableRoleOptions={availableRoleOptions}
        activeEntityOptions={activeEntityOptions}
        departmentOptions={departmentOptions}
        branchOptions={branchOptions}
        formatRoleNameLabel={formatRoleNameLabel}
        onClose={closeUserEditor}
        onSave={() => { void handleSaveEditedUser(); }}
        onFieldChange={updateEditingUserField}
      />

      {activeTab === 'directory' || activeTab === 'unassigned' ? (
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_420px]">
          <UserDepartmentSidebar
            departmentFilter={departmentFilter}
            directoryTotal={directoryTotal}
            departmentCounts={departmentCounts}
            onDepartmentFilterChange={setDepartmentFilter}
          />

          <section className="space-y-4">
            <UserDirectoryFiltersPanel
              searchQuery={searchQuery}
              userRoleFilter={userRoleFilter}
              userEntityFilter={userEntityFilter}
              userBranchFilter={userBranchFilter}
              userStatusFilter={userStatusFilter}
              userSystemAssignmentFilter={userSystemAssignmentFilter}
              hideUserSystemAssignmentFilter={activeTab === 'unassigned'}
              availableRoleOptions={availableRoleOptions}
              activeEntityOptions={activeEntityOptions}
              branchOptions={branchOptions}
              formatRoleNameLabel={formatRoleNameLabel}
              onSearchQueryChange={setSearchQuery}
              onUserRoleFilterChange={(value) => setUserRoleFilter(normalizeSelectFilterValue(value))}
              onUserEntityFilterChange={(value) => setUserEntityFilter(normalizeSelectFilterValue(value))}
              onUserBranchFilterChange={(value) => setUserBranchFilter(normalizeSelectFilterValue(value))}
              onUserStatusFilterChange={setUserStatusFilter}
              onUserSystemAssignmentFilterChange={setUserSystemAssignmentFilter}
            />

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-zinc-500">
                {activeTab === 'unassigned'
                  ? 'Users without assigned systems are shown here.'
                  : 'Employee directory and assigned assets are shown here.'}
              </div>
            </div>

            {isSuperAdmin ? (
              <UserBulkActionsPanel
                allVisibleBulkUsersSelected={allVisibleBulkUsersSelected}
                hasSelectableUsers={bulkSelectableUsers.length > 0}
                selectedUserCount={selectedBulkUsers.length}
                onToggleSelectAll={toggleSelectAllVisibleUsers}
                onDeactivateSelected={() => requestBulkUserAction('deactivate')}
                onReactivateSelected={() => requestBulkUserAction('reactivate')}
              />
            ) : null}

            <UserDirectoryListPanel
              loading={loading}
              isEmpty={directoryUsers.length === 0}
              rows={directoryUsers.map((user) => {
                const active = user.id === selectedUserId;
                const isCurrentSessionUser = session?.user.id === user.id;
                const portalLabels = normalizePortalSelection(user.portals || []).map(formatPortalLabel);
                const accessSummary = portalLabels.join(', ') || 'Employee';

                return (
                  <UserDirectoryCard
                    key={user.id}
                    user={user}
                    active={active}
                    isSuperAdmin={isSuperAdmin}
                    isCurrentSessionUser={isCurrentSessionUser}
                    selectedForBulk={selectedBulkUserIds.includes(user.id)}
                    accessSummary={accessSummary}
                    portalLabels={portalLabels}
                    userActionLoading={userActionLoadingId === user.id}
                    onSelect={() => setSelectedUserId(user.id)}
                    onToggleBulkSelection={(checked) => toggleBulkUserSelection(user.id, checked)}
                    onOpenProfile={() => navigate(`/admin/users/${user.id}`.replace('/admin', location.pathname.startsWith('/it/') ? '/it' : '/admin'))}
                    onQuickEdit={() => openUserEditor(user)}
                    onResetPassword={() => openUserEditor(user, 'reset-password')}
                    onManageAccess={() => {
                      setActiveTab('access');
                      setAccessPage(1);
                    }}
                    onToggleStatus={() => {
                      requestUserAction({
                        userId: user.id,
                        userName: user.fullName,
                        action: user.status === 'active' ? 'deactivate' : 'reactivate',
                      });
                    }}
                  />
                );
              })}
              pagination={(
                <Pagination
                  currentPage={directoryPage}
                  totalItems={directoryTotal}
                  pageSize={USERS_PAGE_SIZE}
                  onPageChange={setDirectoryPage}
                  itemLabel={activeTab === 'unassigned' ? 'unassigned users' : 'users'}
                />
              )}
            />
          </section>

          <UserAssignedAssetsPanel
            selectedUser={selectedUser}
            assetsLoading={assetsLoading}
            devices={assets.devices}
            items={assets.items}
            assetActionLoadingId={assetActionLoadingId}
            showAvailableDevices={activeTab === 'unassigned' && !isAuditor}
            availableDevicesLoading={availableDevicesLoading}
            availableDevices={availableDevices}
            availableDeviceActionLoadingId={availableDeviceActionLoadingId}
            selectedAssetsCount={selectedAssets.length}
            toolStatusItems={TOOL_STATUS_ITEMS}
            readOnly={isAuditor}
            getDevicePresence={assetPresenceState}
            formatWarranty={formatWarranty}
            formatCurrency={formatCurrency}
            formatAssignmentAge={formatAssignmentAge}
            getToolBadgeClasses={getToolBadgeClasses}
            formatToolStatusLabel={formatToolStatusLabel}
            onOpenDevice={(deviceId) => navigate(`${basePath}/devices/${deviceId}`)}
            onUnassignDevice={(assetId) => setPendingAssetAction({ assetId, action: 'unassign' })}
            onDeleteAsset={(assetId) => setPendingAssetAction({ assetId, action: 'delete' })}
            onReturnInventoryAsset={(assetId) => { void handleInventoryAction(assetId, 'return'); }}
            onRetireInventoryAsset={(assetId) => { void handleInventoryAction(assetId, 'retire'); }}
            onAssignAvailableDevice={(assetId) => { void handleAssignAvailableDevice(assetId); }}
          />
        </div>
      ) : null}

      {activeTab === 'employee' ? (
        <UserEmployeeCreationPanel
          defaultEntityId={defaultEntityId}
          defaultEntityLabel={defaultEntityLabel}
          creatingEmployee={creatingEmployee}
          activeEntityOptions={activeEntityOptions}
          availableRoleOptions={availableRoleOptions}
          departmentOptions={departmentOptions}
          branchOptions={branchOptions}
          employeeForm={employeeForm}
          formatRoleNameLabel={formatRoleNameLabel}
          onSubmit={handleCreateEmployee}
          onSelectedEmployeeEntityChange={setSelectedEmployeeEntityId}
          onEmployeeFormFieldChange={updateEmployeeFormField}
        />
      ) : null}

      {activeTab === 'imports' ? (
        <UserImportsPanel
          csvActionLoading={csvActionLoading}
          importingUsers={importingUsers}
          onDownloadMinimalTemplate={() => { void handleDownloadUsersCsv('minimal-template'); }}
          onDownloadTemplate={() => { void handleDownloadUsersCsv('template'); }}
          onExportUsers={() => { void handleDownloadUsersCsv('export'); }}
          onOpenImportPicker={openImportPicker}
        />
      ) : null}

      {activeTab === 'install' ? (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <UserInstallSidebar
            searchQuery={searchQuery}
            userRoleFilter={userRoleFilter}
            userEntityFilter={userEntityFilter}
            userBranchFilter={userBranchFilter}
            userStatusFilter={userStatusFilter}
            availableRoleOptions={availableRoleOptions}
            activeEntityOptions={activeEntityOptions}
            branchOptions={branchOptions}
            installUsers={installUsers}
            selectedUserId={selectedUserId}
            installPage={installPage}
            installTotal={installTotal}
            pageSize={USERS_PAGE_SIZE}
            formatRoleNameLabel={formatRoleNameLabel}
            onSearchQueryChange={setSearchQuery}
            onUserRoleFilterChange={(value) => setUserRoleFilter(normalizeSelectFilterValue(value))}
            onUserEntityFilterChange={(value) => setUserEntityFilter(normalizeSelectFilterValue(value))}
            onUserBranchFilterChange={(value) => setUserBranchFilter(normalizeSelectFilterValue(value))}
            onUserStatusFilterChange={setUserStatusFilter}
            onSelectUser={setSelectedUserId}
            onInstallPageChange={setInstallPage}
          />

          <UserInstallWorkspace
            selectedUser={selectedUser}
            installConfig={installConfig}
            installConfigLoading={installConfigLoading}
            installAssignedToName={installAssignedToName}
            installAssignedToEmail={installAssignedToEmail}
            installEmployeeCode={installEmployeeCode}
            installDepartmentName={installDepartmentName}
            mergedDepartmentOptions={mergedDepartmentOptions}
            includeLinuxHardinfoFallback={includeLinuxHardinfoFallback}
            installEmailValid={installEmailValid}
            installFieldsComplete={installFieldsComplete}
            linuxInstallCommand={linuxInstallCommand}
            linuxSyncCommand={linuxSyncCommand}
            windowsInstallCommand={windowsInstallCommand}
            windowsSyncCommand={windowsSyncCommand}
            copyStatus={copyStatus}
            onInstallAssignedToNameChange={setInstallAssignedToName}
            onInstallAssignedToEmailChange={setInstallAssignedToEmail}
            onInstallEmployeeCodeChange={setInstallEmployeeCode}
            onInstallDepartmentNameChange={setInstallDepartmentName}
            onIncludeLinuxHardinfoFallbackChange={setIncludeLinuxHardinfoFallback}
            onCopyCommand={(kind, command) => { void handleCopyCommand(kind, command); }}
          />
        </div>
      ) : null}

      {activeTab === 'access' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {!isSuperAdmin ? (
            <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
              <div className="text-base font-bold text-amber-900">Portal access editing is restricted</div>
              <p className="mt-2 text-sm text-amber-800">Only super admin can edit user portal access.</p>
            </div>
          ) : null}
          {loading ? <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">Loading portal access...</div> : null}
          {!loading && isSuperAdmin && accessUsers.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <div className="text-base font-bold text-zinc-900">No users available for portal access</div>
              <p className="mt-2 text-sm text-zinc-500">The access tab now ignores directory filters. If this is still empty, no user records were returned by the API for the current account.</p>
            </div>
          ) : null}
          {!loading && isSuperAdmin ? (
            <UserAccessToolbar
              userRoleFilter={userRoleFilter}
              userEntityFilter={userEntityFilter}
              userBranchFilter={userBranchFilter}
              userStatusFilter={userStatusFilter}
              availableRoleOptions={availableRoleOptions}
              activeEntityOptions={activeEntityOptions}
              branchOptions={branchOptions}
              allVisibleBulkUsersSelected={allVisibleBulkUsersSelected}
              bulkSelectableUsersCount={bulkSelectableUsers.length}
              selectedBulkUsersCount={selectedBulkUsers.length}
              formatRoleNameLabel={formatRoleNameLabel}
              onUserRoleFilterChange={(value) => setUserRoleFilter(normalizeSelectFilterValue(value))}
              onUserEntityFilterChange={(value) => setUserEntityFilter(normalizeSelectFilterValue(value))}
              onUserBranchFilterChange={(value) => setUserBranchFilter(normalizeSelectFilterValue(value))}
              onUserStatusFilterChange={setUserStatusFilter}
              onToggleSelectAllVisibleUsers={toggleSelectAllVisibleUsers}
              onDeactivateSelected={() => requestBulkUserAction('deactivate')}
              onReactivateSelected={() => requestBulkUserAction('reactivate')}
            />
          ) : null}
          {!loading && isSuperAdmin && accessUsers.map((user) => {
            const selectedPortals = normalizePortalSelection(portalDrafts[user.id] || user.portals || []);
            const isCurrentSessionUser = session?.user.id === user.id;
            const isLockedUser = isCurrentSessionUser && user.role?.name === 'super_admin';
            const nextRole = portalsToRole(selectedPortals);
            const saveDisabled = isLockedUser || accessSavingUserId === user.id || nextRole === (user.role?.name || 'employee');

            return (
              <UserAccessCard
                key={user.id}
                user={user}
                selectedPortals={selectedPortals}
                selectedForBulk={selectedBulkUserIds.includes(user.id)}
                isCurrentSessionUser={isCurrentSessionUser}
                isLockedUser={isLockedUser}
                isSaving={accessSavingUserId === user.id}
                saveDisabled={saveDisabled}
                portalChoices={PORTAL_CHOICES}
                formatPortalLabel={formatPortalLabel}
                onToggleBulkSelection={(checked) => toggleBulkUserSelection(user.id, checked)}
                onPortalToggle={(portalId, checked) => handlePortalToggle(user.id, portalId, checked)}
                onSaveAccess={() => { void handlePortalSave(user); }}
              />
            );
          })}
          <div className="lg:col-span-2">
            <Pagination
              currentPage={accessPage}
              totalItems={accessTotal}
              pageSize={USERS_PAGE_SIZE}
              onPageChange={setAccessPage}
              itemLabel="users"
            />
          </div>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <UserAuditToolbar
            auditSearchQuery={auditSearchQuery}
            auditModuleFilter={auditModuleFilter}
            auditActionFilter={auditActionFilter}
            auditTotal={auditTotal}
            auditModuleCounts={auditModuleCounts}
            accessAuditActionPresets={ACCESS_AUDIT_ACTION_PRESETS}
            formatAuditModuleLabel={formatAuditModuleLabel}
            formatAuditActionLabel={formatAuditActionLabel}
            onAuditSearchQueryChange={setAuditSearchQuery}
            onAuditModuleFilterChange={setAuditModuleFilter}
            onAuditActionFilterChange={setAuditActionFilter}
            onClearAuditActionFilter={() => setAuditActionFilter('')}
          />

          <UserAuditList
            auditLoading={auditLoading}
            auditItems={auditItems}
            auditPage={auditPage}
            auditTotal={auditTotal}
            auditPageSize={AUDIT_PAGE_SIZE}
            basePath={basePath}
            getAuditModule={getAuditModule}
            resolveAuditEntityPath={resolveAuditEntityPath}
            formatAuditModuleLabel={formatAuditModuleLabel}
            onAuditModuleFilterChange={setAuditModuleFilter}
            onAuditActionFilterChange={setAuditActionFilter}
            onAuditSearchQueryChange={setAuditSearchQuery}
            onNavigate={navigate}
            onAuditPageChange={setAuditPage}
          />
        </div>
      ) : null}
      </div>
    </div>
    </>
  );
}