import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

export interface PendingUserAction {
  userId: string;
  userName: string;
  action: 'deactivate' | 'reactivate';
}

export interface PendingBulkUserAction {
  action: 'deactivate' | 'reactivate';
  count: number;
}

interface UserLike {
  id: string;
}

interface UseUserStatusWorkflowOptions {
  activeTab: string;
  sessionUserId?: string;
  isSuperAdmin: boolean;
  bulkSelectableUsers: UserLike[];
  triggerUsersReload: () => void;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
}

export function useUserStatusWorkflow({
  activeTab,
  sessionUserId,
  isSuperAdmin,
  bulkSelectableUsers,
  triggerUsersReload,
  setError,
  setSuccessMessage,
}: UseUserStatusWorkflowOptions) {
  const [pendingUserAction, setPendingUserAction] = useState<PendingUserAction | null>(null);
  const [pendingBulkUserAction, setPendingBulkUserAction] = useState<PendingBulkUserAction | null>(null);
  const [selectedBulkUserIds, setSelectedBulkUserIds] = useState<string[]>([]);
  const [userActionLoadingId, setUserActionLoadingId] = useState('');
  const [bulkUserActionLoading, setBulkUserActionLoading] = useState(false);

  const selectedBulkUsers = useMemo(
    () => bulkSelectableUsers.filter((user) => selectedBulkUserIds.includes(user.id)),
    [bulkSelectableUsers, selectedBulkUserIds],
  );

  const allVisibleBulkUsersSelected = useMemo(
    () => bulkSelectableUsers.length > 0 && bulkSelectableUsers.every((user) => selectedBulkUserIds.includes(user.id)),
    [bulkSelectableUsers, selectedBulkUserIds],
  );

  useEffect(() => {
    if (activeTab !== 'directory' && activeTab !== 'access') {
      setSelectedBulkUserIds([]);
      return;
    }

    setSelectedBulkUserIds((current) => current.filter((userId) => bulkSelectableUsers.some((user) => user.id === userId)));
  }, [activeTab, bulkSelectableUsers]);

  useEffect(() => {
    setPendingUserAction(null);
    setPendingBulkUserAction(null);
  }, [activeTab]);

  const toggleBulkUserSelection = useCallback((userId: string, checked: boolean) => {
    if (userId === sessionUserId) {
      return;
    }

    setSelectedBulkUserIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return Array.from(next);
    });
  }, [sessionUserId]);

  const toggleSelectAllVisibleUsers = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedBulkUserIds(bulkSelectableUsers.map((user) => user.id));
      return;
    }
    setSelectedBulkUserIds([]);
  }, [bulkSelectableUsers]);

  const requestBulkUserAction = useCallback((action: PendingBulkUserAction['action']) => {
    setPendingBulkUserAction({ action, count: selectedBulkUsers.length });
  }, [selectedBulkUsers.length]);

  const requestUserAction = useCallback((action: PendingUserAction) => {
    setPendingUserAction(action);
  }, []);

  const handleUserStatusAction = useCallback(async () => {
    if (!pendingUserAction || !isSuperAdmin) {
      return;
    }

    if (sessionUserId === pendingUserAction.userId && pendingUserAction.action === 'deactivate') {
      setError('Your own account cannot be deactivated from this page.');
      setPendingUserAction(null);
      return;
    }

    try {
      setUserActionLoadingId(pendingUserAction.userId);
      setError('');
      setSuccessMessage('');

      if (pendingUserAction.action === 'deactivate') {
        await apiRequest(`/api/users/${pendingUserAction.userId}`, {
          method: 'DELETE',
        });
      } else {
        await apiRequest(`/api/users/${pendingUserAction.userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: true }),
        });
      }

      setPendingUserAction(null);
      triggerUsersReload();
      setSuccessMessage(
        pendingUserAction.action === 'deactivate'
          ? `${pendingUserAction.userName} was deactivated.`
          : `${pendingUserAction.userName} was reactivated.`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to ${pendingUserAction.action} user`);
    } finally {
      setUserActionLoadingId('');
    }
  }, [isSuperAdmin, pendingUserAction, sessionUserId, setError, setSuccessMessage, triggerUsersReload]);

  const handleBulkUserStatusAction = useCallback(async () => {
    if (!pendingBulkUserAction || !isSuperAdmin || selectedBulkUsers.length === 0) {
      return;
    }

    const action = pendingBulkUserAction.action;
    const skipSelfDeactivate = action === 'deactivate' && sessionUserId
      ? selectedBulkUsers.filter((user) => user.id === sessionUserId).length
      : 0;
    const targetUsers = action === 'deactivate' && sessionUserId
      ? selectedBulkUsers.filter((user) => user.id !== sessionUserId)
      : selectedBulkUsers;

    if (!targetUsers.length) {
      setPendingBulkUserAction(null);
      setSelectedBulkUserIds([]);
      setError('Your own account cannot be deactivated from this page.');
      return;
    }

    try {
      setBulkUserActionLoading(true);
      setError('');
      setSuccessMessage('');

      for (const user of targetUsers) {
        if (action === 'deactivate') {
          await apiRequest(`/api/users/${user.id}`, { method: 'DELETE' });
        } else {
          await apiRequest(`/api/users/${user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: true }),
          });
        }
      }

      setPendingBulkUserAction(null);
      setSelectedBulkUserIds([]);
      triggerUsersReload();
      setSuccessMessage(
        action === 'deactivate'
          ? `Deactivated ${targetUsers.length} user(s).${skipSelfDeactivate ? ' Your own account was skipped.' : ''}`
          : `Reactivated ${targetUsers.length} user(s).`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to ${action} selected users`);
    } finally {
      setBulkUserActionLoading(false);
    }
  }, [isSuperAdmin, pendingBulkUserAction, selectedBulkUsers, sessionUserId, setError, setSuccessMessage, triggerUsersReload]);

  return {
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
  };
}