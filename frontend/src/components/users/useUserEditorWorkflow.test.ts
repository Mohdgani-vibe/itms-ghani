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

import { useUserEditorWorkflow } from './useUserEditorWorkflow';

function queueHookState(overrides: {
  editingUser?: unknown;
  userEditorMode?: 'edit' | 'reset-password';
  savingEditedUser?: boolean;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.editingUser ?? null,
    overrides.userEditorMode ?? 'edit',
    overrides.savingEditedUser ?? false,
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useUserEditorWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.apiRequestMock.mockReset();
  });

  it('opens the editor with normalized user fields and clears feedback', () => {
    const setEditingUser = vi.fn();
    const setUserEditorMode = vi.fn();
    const setSavingEditedUser = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({ setters: [setEditingUser, setUserEditorMode, setSavingEditedUser] });

    const workflow = useUserEditorWorkflow({
      activeTab: 'directory',
      isSuperAdmin: true,
      triggerUsersReload: vi.fn(),
      setError,
      setSuccessMessage,
    });

    workflow.openUserEditor({
      id: 'user-1',
      fullName: 'Alex Kumar',
      email: 'alex@example.com',
      employeeCode: 'EMP-1',
      entityId: 'entity-1',
      departmentId: 'dept-1',
      branchId: 'branch-1',
      role: { name: 'employee' },
      status: 'inactive',
    } as never, 'reset-password');

    expect(setEditingUser).toHaveBeenCalledWith({
      id: 'user-1',
      fullName: 'Alex Kumar',
      email: 'alex@example.com',
      employeeCode: 'EMP-1',
      entityId: 'entity-1',
      departmentId: 'dept-1',
      branchId: 'branch-1',
      role: 'employee',
      status: 'inactive',
      nextPassword: '',
    });
    expect(setUserEditorMode).toHaveBeenCalledWith('reset-password');
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(setSavingEditedUser).not.toHaveBeenCalled();
  });

  it('saves edited users and reports success', async () => {
    const setEditingUser = vi.fn();
    const setUserEditorMode = vi.fn();
    const setSavingEditedUser = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const triggerUsersReload = vi.fn();
    queueHookState({
      editingUser: {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@example.com',
        employeeCode: 'EMP-1',
        entityId: 'entity-1',
        departmentId: 'dept-1',
        branchId: 'branch-1',
        role: 'employee',
        status: 'active',
        nextPassword: '',
      },
      userEditorMode: 'edit',
      setters: [setEditingUser, setUserEditorMode, setSavingEditedUser],
    });
    hookState.apiRequestMock.mockResolvedValue(undefined);

    const workflow = useUserEditorWorkflow({
      activeTab: 'directory',
      isSuperAdmin: true,
      triggerUsersReload,
      setError,
      setSuccessMessage,
    });
    await workflow.handleSaveEditedUser();

    expect(setSavingEditedUser).toHaveBeenNthCalledWith(1, true);
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(hookState.apiRequestMock).toHaveBeenCalledWith('/api/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({
        full_name: 'Alex Kumar',
        email: 'alex@example.com',
        emp_id: 'EMP-1',
        entity_id: 'entity-1',
        dept_id: 'dept-1',
        location_id: 'branch-1',
        role: 'employee',
        is_active: true,
        initial_password: '',
      }),
    });
    expect(setEditingUser).toHaveBeenCalledWith(null);
    expect(setUserEditorMode).toHaveBeenCalledWith('edit');
    expect(triggerUsersReload).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('User updated successfully.');
    expect(setSavingEditedUser).toHaveBeenLastCalledWith(false);
  });

  it('requires a temporary password before saving reset-password mode', async () => {
    const setEditingUser = vi.fn();
    const setUserEditorMode = vi.fn();
    const setSavingEditedUser = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({
      editingUser: {
        id: 'user-2',
        fullName: 'Sam Rao',
        email: 'sam@example.com',
        employeeCode: 'EMP-2',
        entityId: 'entity-1',
        departmentId: 'dept-1',
        branchId: 'branch-1',
        role: 'employee',
        status: 'active',
        nextPassword: '   ',
      },
      userEditorMode: 'reset-password',
      setters: [setEditingUser, setUserEditorMode, setSavingEditedUser],
    });

    const workflow = useUserEditorWorkflow({
      activeTab: 'directory',
      isSuperAdmin: true,
      triggerUsersReload: vi.fn(),
      setError,
      setSuccessMessage,
    });
    await workflow.handleSaveEditedUser();

    expect(setError).toHaveBeenLastCalledWith('Enter a strong temporary password before saving the reset.');
    expect(hookState.apiRequestMock).not.toHaveBeenCalled();
    expect(setSavingEditedUser).not.toHaveBeenCalledWith(true);
  });
});