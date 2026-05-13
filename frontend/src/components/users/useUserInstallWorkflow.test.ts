import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  linuxInstallCommandMock: vi.fn(() => 'linux-install-command'),
  windowsInstallCommandMock: vi.fn(() => 'windows-install-command'),
  linuxSyncCommandMock: vi.fn(() => 'linux-sync-command'),
  windowsSyncCommandMock: vi.fn(() => 'windows-sync-command'),
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
    useRef: <T,>(initialValue: T) => ({ current: initialValue }),
    useState: <T,>(initialValue: T) => {
      const value = hookState.stateQueue.length > 0 ? hookState.stateQueue.shift() as T : initialValue;
      const setter = hookState.setterQueue.length > 0 ? hookState.setterQueue.shift()! : vi.fn();
      return [value, setter] as const;
    },
  };
});

vi.mock('./userInstallCommandUtils', () => ({
  buildLinuxBootstrapCommand: hookState.linuxInstallCommandMock,
  buildWindowsBootstrapCommand: hookState.windowsInstallCommandMock,
  buildLinuxSyncCommand: hookState.linuxSyncCommandMock,
  buildWindowsSyncCommand: hookState.windowsSyncCommandMock,
}));

import { useUserInstallWorkflow } from './useUserInstallWorkflow';

function queueHookState(overrides: {
  installFormState?: Record<string, unknown>;
  includeLinuxHardinfoFallback?: boolean;
  copyStatus?: string;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.installFormState ?? {
      userId: 'user-1',
      assignedToName: 'Alex Kumar',
      assignedToEmail: 'alex@zerodha.com',
      employeeCode: 'EMP-1',
      departmentName: 'IT',
    },
    overrides.includeLinuxHardinfoFallback ?? true,
    overrides.copyStatus ?? '',
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useUserInstallWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.linuxInstallCommandMock.mockClear();
    hookState.windowsInstallCommandMock.mockClear();
    hookState.linuxSyncCommandMock.mockClear();
    hookState.windowsSyncCommandMock.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('derives install state, validation, and generated commands from the selected user', () => {
    const setInstallFormState = vi.fn();
    const setIncludeLinuxHardinfoFallback = vi.fn();
    const setCopyStatus = vi.fn();
    const localStorageGetItem = vi.fn(() => 'true');
    const localStorageSetItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: localStorageGetItem, setItem: localStorageSetItem },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 1),
    });
    queueHookState({
      setters: [setInstallFormState, setIncludeLinuxHardinfoFallback, setCopyStatus],
    });

    const workflow = useUserInstallWorkflow({
      selectedUser: {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@zerodha.com',
        employeeCode: 'EMP-1',
        department: { name: 'IT' },
        branch: { name: 'BLR' },
      } as never,
      installConfig: { linuxScriptUrl: 'https://example.com/install.sh' } as never,
      setError: vi.fn(),
      setSuccessMessage: vi.fn(),
    });

    workflow.setInstallAssignedToName('Sam Rao');
    workflow.setInstallAssignedToEmail('sam@zerodha.com');
    workflow.setInstallEmployeeCode('EMP-2');
    workflow.setInstallDepartmentName('Finance');

    expect(workflow.installAssignedToName).toBe('Alex Kumar');
    expect(workflow.installAssignedToEmail).toBe('alex@zerodha.com');
    expect(workflow.installEmployeeCode).toBe('EMP-1');
    expect(workflow.installDepartmentName).toBe('IT');
    expect(workflow.includeLinuxHardinfoFallback).toBe(true);
    expect(workflow.copyStatus).toBe('');
    expect(workflow.installEmailValid).toBe(true);
    expect(workflow.installFieldsComplete).toBe(true);
    expect(workflow.linuxInstallCommand).toBe('linux-install-command');
    expect(workflow.windowsInstallCommand).toBe('windows-install-command');
    expect(workflow.linuxSyncCommand).toBe('linux-sync-command');
    expect(workflow.windowsSyncCommand).toBe('windows-sync-command');
    expect(localStorageSetItem).toHaveBeenCalledWith('itms_install_linux_hardinfo_fallback', 'true');
    expect(setInstallFormState).toHaveBeenCalledTimes(4);
    expect(setCopyStatus).not.toHaveBeenCalled();
    expect(setIncludeLinuxHardinfoFallback).not.toHaveBeenCalled();
  });

  it('copies commands through the clipboard api and reports success', async () => {
    const setInstallFormState = vi.fn();
    const setIncludeLinuxHardinfoFallback = vi.fn();
    const setCopyStatus = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const setTimeoutMock = vi.fn(() => 17);
    const clearTimeoutMock = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: vi.fn(() => 'true'), setItem: vi.fn() },
      clearTimeout: clearTimeoutMock,
      setTimeout: setTimeoutMock,
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    queueHookState({
      setters: [setInstallFormState, setIncludeLinuxHardinfoFallback, setCopyStatus],
    });

    const workflow = useUserInstallWorkflow({
      selectedUser: {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@zerodha.com',
        employeeCode: 'EMP-1',
        department: { name: 'IT' },
      } as never,
      installConfig: { linuxScriptUrl: 'https://example.com/install.sh' } as never,
      setError,
      setSuccessMessage,
    });
    await workflow.handleCopyCommand('ubuntu', workflow.linuxInstallCommand);

    expect(writeText).toHaveBeenCalledWith('linux-install-command');
    expect(setCopyStatus).toHaveBeenCalledWith('ubuntu');
    expect(setSuccessMessage).toHaveBeenCalledWith('Ubuntu install copied.');
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 1500);
    expect(clearTimeoutMock).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('reports invalid install emails from the active form state', () => {
    const setInstallFormState = vi.fn();
    const setIncludeLinuxHardinfoFallback = vi.fn();
    const setCopyStatus = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: vi.fn(() => 'false'), setItem: vi.fn() },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 1),
    });
    queueHookState({
      installFormState: {
        userId: 'user-1',
        assignedToName: 'Alex Kumar',
        assignedToEmail: 'alex@example.com',
        employeeCode: 'EMP-1',
        departmentName: 'IT',
      },
      includeLinuxHardinfoFallback: false,
      setters: [setInstallFormState, setIncludeLinuxHardinfoFallback, setCopyStatus],
    });

    const workflow = useUserInstallWorkflow({
      selectedUser: {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@zerodha.com',
        employeeCode: 'EMP-1',
        department: { name: 'IT' },
      } as never,
      installConfig: null,
      setError: vi.fn(),
      setSuccessMessage: vi.fn(),
    });

    expect(workflow.includeLinuxHardinfoFallback).toBe(false);
    expect(workflow.installEmailValid).toBe(false);
    expect(workflow.installFieldsComplete).toBe(false);
  });
});