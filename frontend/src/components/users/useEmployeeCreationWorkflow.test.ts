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

import { useEmployeeCreationWorkflow } from './useEmployeeCreationWorkflow';

function queueHookState(overrides: {
  selectedEmployeeEntityId?: string;
  creatingEmployee?: boolean;
  employeeForm?: unknown;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.selectedEmployeeEntityId ?? '',
    overrides.creatingEmployee ?? false,
    overrides.employeeForm ?? {
      fullName: '',
      email: '',
      employeeCode: '',
      departmentId: '',
      branchId: '',
      role: 'employee',
      initialPassword: '',
    },
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useEmployeeCreationWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.apiRequestMock.mockReset();
  });

  it('derives the default entity and updates employee form fields', () => {
    const setSelectedEmployeeEntityId = vi.fn();
    const setCreatingEmployee = vi.fn();
    const setEmployeeForm = vi.fn();
    queueHookState({ setters: [setSelectedEmployeeEntityId, setCreatingEmployee, setEmployeeForm] });

    const workflow = useEmployeeCreationWorkflow({
      activeEntityOptions: [
        { id: 'entity-1', full_name: 'Entity One' },
        { id: 'entity-2', full_name: 'Entity Two' },
      ],
      selectedUser: { entityId: 'entity-2' },
      triggerUsersReload: vi.fn(),
      setDirectoryPage: vi.fn(),
      setActiveTab: vi.fn(),
      setError: vi.fn(),
      setSuccessMessage: vi.fn(),
    });

    workflow.updateEmployeeFormField('email', 'alex@zerodha.com');

    expect(workflow.defaultEntityId).toBe('entity-2');
    expect(workflow.defaultEntityLabel).toBe('Entity Two');
    expect(setSelectedEmployeeEntityId).toHaveBeenCalledWith(expect.any(Function));
    expect(setEmployeeForm).toHaveBeenCalledWith(expect.any(Function));
    expect(setCreatingEmployee).not.toHaveBeenCalled();
  });

  it('creates an employee and resets state on success', async () => {
    const setSelectedEmployeeEntityId = vi.fn();
    const setCreatingEmployee = vi.fn();
    const setEmployeeForm = vi.fn();
    const setDirectoryPage = vi.fn();
    const setActiveTab = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const triggerUsersReload = vi.fn();
    queueHookState({
      selectedEmployeeEntityId: 'entity-1',
      employeeForm: {
        fullName: 'Alex Kumar',
        email: 'alex@zerodha.com',
        employeeCode: 'EMP-1',
        departmentId: 'dept-1',
        branchId: 'branch-1',
        role: 'employee',
        initialPassword: 'Secret123!',
      },
      setters: [setSelectedEmployeeEntityId, setCreatingEmployee, setEmployeeForm],
    });
    hookState.apiRequestMock.mockResolvedValue(undefined);

    const workflow = useEmployeeCreationWorkflow({
      activeEntityOptions: [{ id: 'entity-1', full_name: 'Entity One' }],
      selectedUser: null,
      triggerUsersReload,
      setDirectoryPage,
      setActiveTab,
      setError,
      setSuccessMessage,
    });

    const preventDefault = vi.fn();
    await workflow.handleCreateEmployee({ preventDefault } as never);

    expect(preventDefault).toHaveBeenCalled();
    expect(setCreatingEmployee).toHaveBeenNthCalledWith(1, true);
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(hookState.apiRequestMock).toHaveBeenCalledWith('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Alex Kumar',
        email: 'alex@zerodha.com',
        emp_id: 'EMP-1',
        entity_id: 'entity-1',
        dept_id: 'dept-1',
        location_id: 'branch-1',
        role: 'employee',
        initial_password: 'Secret123!',
        is_active: true,
      }),
    });
    expect(setEmployeeForm).toHaveBeenCalledWith({
      fullName: '',
      email: '',
      employeeCode: '',
      departmentId: '',
      branchId: '',
      role: 'employee',
      initialPassword: '',
    });
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Employee created successfully.');
    expect(setDirectoryPage).toHaveBeenCalledWith(1);
    expect(setActiveTab).toHaveBeenCalledWith('directory');
    expect(triggerUsersReload).toHaveBeenCalled();
    expect(setCreatingEmployee).toHaveBeenLastCalledWith(false);
  });
});