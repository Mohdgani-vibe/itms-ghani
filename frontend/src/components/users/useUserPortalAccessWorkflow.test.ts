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

import { useUserPortalAccessWorkflow } from './useUserPortalAccessWorkflow';

function queueHookState(overrides: {
  portalDrafts?: Record<string, string[]>;
  accessSavingUserId?: string;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.portalDrafts ?? {},
    overrides.accessSavingUserId ?? '',
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn()]
  ));
}

describe('useUserPortalAccessWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.apiRequestMock.mockReset();
  });

  it('seeds portal drafts from access users and toggles portal selections', () => {
    const setPortalDrafts = vi.fn();
    const setAccessSavingUserId = vi.fn();
    queueHookState({
      portalDrafts: { 'user-1': ['employee', 'manager'] },
      setters: [setPortalDrafts, setAccessSavingUserId],
    });

    const workflow = useUserPortalAccessWorkflow({
      accessUsers: [
        { id: 'user-1', portals: ['employee'], role: { name: 'manager' } },
        { id: 'user-2', portals: ['employee', 'request_manager'], role: { name: 'request_manager' } },
      ] as never,
      accessPage: 2,
      accessScopedUserFilters: { status: 'active' },
      directoryScopedUserFilters: { search: '', departmentLabel: 'all', excludeRole: 'super_admin' },
      isSuperAdmin: true,
      setError: vi.fn(),
      setSuccessMessage: vi.fn(),
      loadUsersPage: vi.fn(),
      setAccessUsers: vi.fn(),
      setAccessTotal: vi.fn(),
      setDirectorySummary: vi.fn(),
    });

    workflow.handlePortalToggle('user-2', 'inventory_manager', true);
    workflow.handlePortalToggle('user-2', 'request_manager', false);

    expect(workflow.portalDrafts).toEqual({ 'user-1': ['employee', 'manager'] });
    expect(setPortalDrafts).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(setPortalDrafts).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(setPortalDrafts).toHaveBeenNthCalledWith(3, expect.any(Function));
    expect(setAccessSavingUserId).not.toHaveBeenCalled();
  });

  it('blocks portal saves for non-super-admin users', async () => {
    const setPortalDrafts = vi.fn();
    const setAccessSavingUserId = vi.fn();
    const setError = vi.fn();
    queueHookState({ setters: [setPortalDrafts, setAccessSavingUserId] });

    const workflow = useUserPortalAccessWorkflow({
      accessUsers: [],
      accessPage: 1,
      accessScopedUserFilters: {},
      directoryScopedUserFilters: { search: '', departmentLabel: 'all', excludeRole: 'super_admin' },
      isSuperAdmin: false,
      setError,
      setSuccessMessage: vi.fn(),
      loadUsersPage: vi.fn(),
      setAccessUsers: vi.fn(),
      setAccessTotal: vi.fn(),
      setDirectorySummary: vi.fn(),
    });
    await workflow.handlePortalSave({
      id: 'user-1',
      fullName: 'Alex Kumar',
      portals: ['employee'],
      role: { name: 'employee' },
    } as never);

    expect(setError).toHaveBeenCalledWith('Only super admin can update portal access.');
    expect(hookState.apiRequestMock).not.toHaveBeenCalled();
  });

  it('saves portal drafts, refreshes users, and updates directory summary', async () => {
    const setPortalDrafts = vi.fn();
    const setAccessSavingUserId = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const loadUsersPage = vi.fn()
      .mockResolvedValueOnce({
        items: [{ id: 'user-1', full_name: 'Alex Kumar', role: 'it_team', portals: ['employee', 'it_team'] }],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        summary: { departmentCounts: [{ name: 'IT', count: 4 }], assetTotal: 12 },
      });
    const setAccessUsers = vi.fn();
    const setAccessTotal = vi.fn();
    const setDirectorySummary = vi.fn();
    queueHookState({
      portalDrafts: { 'user-1': ['employee', 'it_team'] },
      setters: [setPortalDrafts, setAccessSavingUserId],
    });
    hookState.apiRequestMock.mockResolvedValue(undefined);

    const workflow = useUserPortalAccessWorkflow({
      accessUsers: [],
      accessPage: 3,
      accessScopedUserFilters: { status: 'active', role: 'employee' },
      directoryScopedUserFilters: { search: 'alex', departmentLabel: 'IT', excludeRole: 'super_admin', status: 'active' },
      isSuperAdmin: true,
      setError,
      setSuccessMessage,
      loadUsersPage,
      setAccessUsers,
      setAccessTotal,
      setDirectorySummary,
    });
    await workflow.handlePortalSave({
      id: 'user-1',
      fullName: 'Alex Kumar',
      employeeCode: 'EMP-1',
      email: 'alex@zerodha.com',
      entityId: 'entity-1',
      departmentId: 'dept-1',
      branchId: 'branch-1',
      portals: ['employee'],
      role: { name: 'employee' },
    } as never);

    expect(setAccessSavingUserId).toHaveBeenNthCalledWith(1, 'user-1');
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(hookState.apiRequestMock).toHaveBeenCalledWith('/api/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({
        full_name: 'Alex Kumar',
        emp_id: 'EMP-1',
        email: 'alex@zerodha.com',
        entity_id: 'entity-1',
        dept_id: 'dept-1',
        location_id: 'branch-1',
        role: 'it_team',
      }),
    });
    expect(loadUsersPage).toHaveBeenNthCalledWith(1, { page: 3, status: 'active', role: 'employee' });
    expect(loadUsersPage).toHaveBeenNthCalledWith(2, { page: 1, search: 'alex', departmentLabel: 'IT', excludeRole: 'super_admin', status: 'active' });
    expect(setAccessUsers).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'user-1', fullName: 'Alex Kumar' })]));
    expect(setAccessTotal).toHaveBeenCalledWith(1);
    expect(setDirectorySummary).toHaveBeenCalledWith({
      departmentCounts: [{ name: 'IT', count: 4 }],
      assetTotal: 12,
    });
    expect(setPortalDrafts).toHaveBeenLastCalledWith(expect.any(Function));
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Updated portal access for Alex Kumar.');
    expect(setAccessSavingUserId).toHaveBeenLastCalledWith('');
  });
});