import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  apiRequestMock: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useMemo: <T,>(factory: () => T) => factory(),
    useState: <T,>(initialValue: T) => {
      const value = hookState.stateQueue.length > 0 ? hookState.stateQueue.shift() as T : initialValue;
      const setter = hookState.setterQueue.length > 0 ? hookState.setterQueue.shift()! : vi.fn();
      return [value, setter] as const;
    },
  };
});

vi.mock('../../lib/api', () => ({
  apiRequest: hookState.apiRequestMock,
}));

import { useUserStatusWorkflow } from './useUserStatusWorkflow';

function queueHookState(overrides: {
  pendingUserAction?: unknown;
  pendingBulkUserAction?: unknown;
  selectedBulkUserIds?: string[];
  userActionLoadingId?: string;
  bulkUserActionLoading?: boolean;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.pendingUserAction ?? null,
    overrides.pendingBulkUserAction ?? null,
    overrides.selectedBulkUserIds ?? [],
    overrides.userActionLoadingId ?? '',
    overrides.bulkUserActionLoading ?? false,
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useUserStatusWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.apiRequestMock.mockReset();
  });

  it('toggles selections, blocks self-selection, and requests bulk actions from current state', () => {
    const setPendingUserAction = vi.fn();
    const setPendingBulkUserAction = vi.fn();
    const setSelectedBulkUserIds = vi.fn();
    const setUserActionLoadingId = vi.fn();
    const setBulkUserActionLoading = vi.fn();
    queueHookState({
      selectedBulkUserIds: ['user-2'],
      setters: [setPendingUserAction, setPendingBulkUserAction, setSelectedBulkUserIds, setUserActionLoadingId, setBulkUserActionLoading],
    });

    const workflow = useUserStatusWorkflow({
      activeTab: 'directory',
      sessionUserId: 'user-1',
      isSuperAdmin: true,
      bulkSelectableUsers: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      triggerUsersReload: vi.fn(),
      setError: vi.fn(),
      setSuccessMessage: vi.fn(),
    });

    workflow.toggleBulkUserSelection('user-3', true);
    workflow.toggleBulkUserSelection('user-1', true);
    workflow.toggleSelectAllVisibleUsers(true);
    workflow.requestBulkUserAction('deactivate');
    workflow.requestUserAction({ userId: 'user-3', userName: 'Sam Rao', action: 'reactivate' });

    expect(workflow.selectedBulkUsers).toEqual([{ id: 'user-2' }]);
    expect(workflow.allVisibleBulkUsersSelected).toBe(false);
    expect(setSelectedBulkUserIds).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(setSelectedBulkUserIds).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(setSelectedBulkUserIds).toHaveBeenNthCalledWith(3, ['user-1', 'user-2', 'user-3']);
    expect(setPendingBulkUserAction).toHaveBeenCalledWith({ action: 'deactivate', count: 1 });
    expect(setPendingUserAction).toHaveBeenCalledWith({ userId: 'user-3', userName: 'Sam Rao', action: 'reactivate' });
    expect(setUserActionLoadingId).not.toHaveBeenCalled();
    expect(setBulkUserActionLoading).not.toHaveBeenCalled();
  });

  it('prevents self-deactivation for single-user actions', async () => {
    const setPendingUserAction = vi.fn();
    const setPendingBulkUserAction = vi.fn();
    const setSelectedBulkUserIds = vi.fn();
    const setUserActionLoadingId = vi.fn();
    const setBulkUserActionLoading = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({
      pendingUserAction: { userId: 'user-1', userName: 'Alex Kumar', action: 'deactivate' },
      setters: [setPendingUserAction, setPendingBulkUserAction, setSelectedBulkUserIds, setUserActionLoadingId, setBulkUserActionLoading],
    });

    const workflow = useUserStatusWorkflow({
      activeTab: 'directory',
      sessionUserId: 'user-1',
      isSuperAdmin: true,
      bulkSelectableUsers: [],
      triggerUsersReload: vi.fn(),
      setError,
      setSuccessMessage,
    });
    await workflow.handleUserStatusAction();

    expect(setError).toHaveBeenCalledWith('Your own account cannot be deactivated from this page.');
    expect(setPendingUserAction).toHaveBeenCalledWith(null);
    expect(hookState.apiRequestMock).not.toHaveBeenCalled();
    expect(setSuccessMessage).not.toHaveBeenCalled();
  });

  it('reactivates a single user and reports success', async () => {
    const setPendingUserAction = vi.fn();
    const setPendingBulkUserAction = vi.fn();
    const setSelectedBulkUserIds = vi.fn();
    const setUserActionLoadingId = vi.fn();
    const setBulkUserActionLoading = vi.fn();
    const triggerUsersReload = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({
      pendingUserAction: { userId: 'user-2', userName: 'Sam Rao', action: 'reactivate' },
      setters: [setPendingUserAction, setPendingBulkUserAction, setSelectedBulkUserIds, setUserActionLoadingId, setBulkUserActionLoading],
    });
    hookState.apiRequestMock.mockResolvedValue(undefined);

    const workflow = useUserStatusWorkflow({
      activeTab: 'directory',
      sessionUserId: 'user-1',
      isSuperAdmin: true,
      bulkSelectableUsers: [],
      triggerUsersReload,
      setError,
      setSuccessMessage,
    });
    await workflow.handleUserStatusAction();

    expect(setUserActionLoadingId).toHaveBeenNthCalledWith(1, 'user-2');
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(hookState.apiRequestMock).toHaveBeenCalledWith('/api/users/user-2', {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true }),
    });
    expect(setPendingUserAction).toHaveBeenCalledWith(null);
    expect(triggerUsersReload).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Sam Rao was reactivated.');
    expect(setUserActionLoadingId).toHaveBeenLastCalledWith('');
  });

  it('deactivates selected bulk users while skipping the session user', async () => {
    const setPendingUserAction = vi.fn();
    const setPendingBulkUserAction = vi.fn();
    const setSelectedBulkUserIds = vi.fn();
    const setUserActionLoadingId = vi.fn();
    const setBulkUserActionLoading = vi.fn();
    const triggerUsersReload = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({
      pendingBulkUserAction: { action: 'deactivate', count: 2 },
      selectedBulkUserIds: ['user-1', 'user-2'],
      setters: [setPendingUserAction, setPendingBulkUserAction, setSelectedBulkUserIds, setUserActionLoadingId, setBulkUserActionLoading],
    });
    hookState.apiRequestMock.mockResolvedValue(undefined);

    const workflow = useUserStatusWorkflow({
      activeTab: 'directory',
      sessionUserId: 'user-1',
      isSuperAdmin: true,
      bulkSelectableUsers: [{ id: 'user-1' }, { id: 'user-2' }],
      triggerUsersReload,
      setError,
      setSuccessMessage,
    });
    await workflow.handleBulkUserStatusAction();

    expect(setBulkUserActionLoading).toHaveBeenNthCalledWith(1, true);
    expect(hookState.apiRequestMock).toHaveBeenCalledWith('/api/users/user-2', { method: 'DELETE' });
    expect(setPendingBulkUserAction).toHaveBeenCalledWith(null);
    expect(setSelectedBulkUserIds).toHaveBeenCalledWith([]);
    expect(triggerUsersReload).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Deactivated 1 user(s). Your own account was skipped.');
    expect(setBulkUserActionLoading).toHaveBeenLastCalledWith(false);
  });
});