import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { normalizePortalSelection, normalizeUsers, portalsToRole, type ApiUserRecord, type UserRecord } from './userDirectoryUtils';

interface NamedCount {
  name: string;
  count: number;
}

interface AccessUsersResponse {
  items: ApiUserRecord[];
  total: number;
}

interface DirectorySummaryResponse {
  summary?: {
    departmentCounts?: NamedCount[];
    assetTotal?: number;
  };
}

interface UseUserPortalAccessWorkflowOptions {
  accessUsers: UserRecord[];
  accessPage: number;
  accessScopedUserFilters: {
    status?: string;
    role?: string;
    entityId?: string;
    locationId?: string;
  };
  directoryScopedUserFilters: {
    search: string;
    departmentLabel: string;
    excludeRole: string;
    status?: string;
    role?: string;
    entityId?: string;
    locationId?: string;
  };
  isSuperAdmin: boolean;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
  loadUsersPage: (options: {
    page: number;
    search?: string;
    departmentLabel?: string;
    excludeRole?: string;
    role?: string;
    status?: string;
    entityId?: string;
    locationId?: string;
    pageSize?: number;
  }) => Promise<AccessUsersResponse & DirectorySummaryResponse>;
  setAccessUsers: (users: UserRecord[]) => void;
  setAccessTotal: (value: number) => void;
  setDirectorySummary: (value: { departmentCounts: NamedCount[]; assetTotal: number }) => void;
}

export function useUserPortalAccessWorkflow({
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
}: UseUserPortalAccessWorkflowOptions) {
  const [portalDrafts, setPortalDrafts] = useState<Record<string, string[]>>({});
  const [accessSavingUserId, setAccessSavingUserId] = useState('');

  useEffect(() => {
    setPortalDrafts((current) => {
      const next: Record<string, string[]> = {};
      accessUsers.forEach((user) => {
        next[user.id] = current[user.id] ? normalizePortalSelection(current[user.id]) : normalizePortalSelection(user.portals || []);
      });
      return next;
    });
  }, [accessUsers]);

  const handlePortalToggle = useCallback((userId: string, portalId: string, checked: boolean) => {
    setPortalDrafts((current) => {
      const existing = new Set(current[userId] || ['employee']);
      if (checked) {
        existing.add(portalId);
      } else {
        existing.delete(portalId);
      }
      return {
        ...current,
        [userId]: normalizePortalSelection(Array.from(existing)),
      };
    });
  }, []);

  const handleRoleChange = useCallback(async (user: UserRecord, nextRole: string) => {
    if (!isSuperAdmin) {
      setError('Only super admin can update portal access.');
      return false;
    }

    if (!nextRole || nextRole === user.role?.name) {
      return false;
    }

    try {
      setAccessSavingUserId(user.id);
      setError('');
      setSuccessMessage('');

      await apiRequest(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: user.fullName,
          emp_id: user.employeeCode,
          email: user.email,
          entity_id: user.entityId,
          dept_id: user.departmentId || '',
          location_id: user.branchId || '',
          role: nextRole,
        }),
      });

      const [accessData, summaryData] = await Promise.all([
        loadUsersPage({ page: accessPage, ...accessScopedUserFilters }),
        loadUsersPage({ page: 1, ...directoryScopedUserFilters }),
      ]);
      setAccessUsers(normalizeUsers(accessData.items));
      setAccessTotal(accessData.total);
      setDirectorySummary({
        departmentCounts: summaryData.summary?.departmentCounts || [],
        assetTotal: summaryData.summary?.assetTotal || 0,
      });
      setSuccessMessage(`Updated portal access for ${user.fullName}.`);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update portal access');
      return false;
    } finally {
      setAccessSavingUserId('');
    }
  }, [accessPage, accessScopedUserFilters, directoryScopedUserFilters, isSuperAdmin, loadUsersPage, setAccessTotal, setAccessUsers, setDirectorySummary, setError, setSuccessMessage]);

  const handlePortalSave = useCallback(async (user: UserRecord) => {
    if (!isSuperAdmin) {
      setError('Only super admin can update portal access.');
      return;
    }

    const draftPortals = normalizePortalSelection(portalDrafts[user.id] || user.portals || []);
    const nextRole = portalsToRole(draftPortals);
    const saved = await handleRoleChange(user, nextRole);
    if (saved) {
      setPortalDrafts((current) => ({
        ...current,
        [user.id]: draftPortals,
      }));
    }
  }, [handleRoleChange, isSuperAdmin, portalDrafts, setError]);

  return {
    portalDrafts,
    accessSavingUserId,
    handlePortalToggle,
    handlePortalSave,
  };
}