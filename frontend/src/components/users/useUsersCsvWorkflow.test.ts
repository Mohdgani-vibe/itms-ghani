import type { ChangeEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  apiRequestMock: vi.fn(),
  resolveApiUrlMock: vi.fn((value: string) => value),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useRef: <T,>(initialValue: T) => ({ current: initialValue }),
    useState: <T,>(initialValue: T) => {
      const value = hookState.stateQueue.length > 0 ? hookState.stateQueue.shift() as T : initialValue;
      const setter = hookState.setterQueue.length > 0 ? hookState.setterQueue.shift()! : vi.fn();
      return [value, setter] as const;
    },
  };
});

vi.mock('../../lib/api', () => ({
  apiRequest: hookState.apiRequestMock,
  resolveApiUrl: hookState.resolveApiUrlMock,
}));

import { useUsersCsvWorkflow } from './useUsersCsvWorkflow';

function queueHookState(overrides: {
  csvActionLoading?: '' | 'template' | 'minimal-template' | 'export';
  importingUsers?: boolean;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.csvActionLoading ?? '',
    overrides.importingUsers ?? false,
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn()]
  ));
}

describe('useUsersCsvWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.apiRequestMock.mockReset();
    hookState.resolveApiUrlMock.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports missing tokens before attempting csv downloads', async () => {
    const setCsvActionLoading = vi.fn();
    const setImportingUsers = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({ setters: [setCsvActionLoading, setImportingUsers] });

    const workflow = useUsersCsvWorkflow({
      token: undefined,
      activeTab: 'directory',
      searchQuery: '',
      departmentFilter: 'all',
      userRoleFilter: 'all',
      userStatusFilter: 'all',
      userEntityFilter: 'all',
      userBranchFilter: 'all',
      setError,
      setSuccessMessage,
      setDirectoryPage: vi.fn(),
      setInstallPage: vi.fn(),
      setAccessPage: vi.fn(),
      setSelectedUserId: vi.fn(),
      setActiveTab: vi.fn(),
      triggerUsersReload: vi.fn(),
    });
    await workflow.handleDownloadUsersCsv('template');

    expect(setError).toHaveBeenCalledWith('Sign in again before downloading CSV files.');
    expect(setCsvActionLoading).not.toHaveBeenCalled();
    expect(setImportingUsers).not.toHaveBeenCalled();
  });

  it('downloads filtered user exports and reports success', async () => {
    const setCsvActionLoading = vi.fn();
    const setImportingUsers = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    queueHookState({ setters: [setCsvActionLoading, setImportingUsers] });

    const fetchMock = vi.fn(async () => new Response(new Blob(['csv,data']), {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="users.csv"' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:url'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ href: '', download: '', click, remove })),
      body: { appendChild },
    });

    const workflow = useUsersCsvWorkflow({
      token: 'token-123',
      activeTab: 'directory',
      searchQuery: 'alex',
      departmentFilter: 'IT',
      userRoleFilter: 'employee',
      userStatusFilter: 'active',
      userEntityFilter: 'entity-1',
      userBranchFilter: 'branch-1',
      setError,
      setSuccessMessage,
      setDirectoryPage: vi.fn(),
      setInstallPage: vi.fn(),
      setAccessPage: vi.fn(),
      setSelectedUserId: vi.fn(),
      setActiveTab: vi.fn(),
      triggerUsersReload: vi.fn(),
    });
    await workflow.handleDownloadUsersCsv('export');

    expect(setCsvActionLoading).toHaveBeenNthCalledWith(1, 'export');
    expect(hookState.resolveApiUrlMock).toHaveBeenCalledWith('/api/users/export?search=alex&department_label=IT&exclude_role=super_admin&role=employee&status=active&entity=entity-1&location=branch-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/users/export?search=alex&department_label=IT&exclude_role=super_admin&role=employee&status=active&entity=entity-1&location=branch-1', {
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Current filtered users exported to CSV.');
    expect(setCsvActionLoading).toHaveBeenLastCalledWith('');
  });

  it('imports users csv files and resets the directory context', async () => {
    const setCsvActionLoading = vi.fn();
    const setImportingUsers = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const setDirectoryPage = vi.fn();
    const setInstallPage = vi.fn();
    const setAccessPage = vi.fn();
    const setSelectedUserId = vi.fn();
    const setActiveTab = vi.fn();
    const triggerUsersReload = vi.fn();
    queueHookState({ setters: [setCsvActionLoading, setImportingUsers] });
    hookState.apiRequestMock.mockResolvedValue({
      created: 2,
      updated: 1,
      errors: [{ row: 4, message: 'Missing email' }],
    });

    const workflow = useUsersCsvWorkflow({
      token: 'token-123',
      activeTab: 'directory',
      searchQuery: '',
      departmentFilter: 'all',
      userRoleFilter: 'all',
      userStatusFilter: 'all',
      userEntityFilter: 'all',
      userBranchFilter: 'all',
      setError,
      setSuccessMessage,
      setDirectoryPage,
      setInstallPage,
      setAccessPage,
      setSelectedUserId,
      setActiveTab,
      triggerUsersReload,
    });
    const file = new File(['csv,data'], 'users.csv', { type: 'text/csv' });
    const target = { files: [file], value: 'users.csv' } as unknown as HTMLInputElement;
    const event = { target } as ChangeEvent<HTMLInputElement>;

    await workflow.handleImportUsers(event);

    expect(target.value).toBe('');
    expect(setImportingUsers).toHaveBeenNthCalledWith(1, true);
    expect(hookState.apiRequestMock).toHaveBeenCalledTimes(1);
    expect(hookState.apiRequestMock.mock.calls[0][0]).toBe('/api/users/import');
    expect(hookState.apiRequestMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(hookState.apiRequestMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    expect(setDirectoryPage).toHaveBeenCalledWith(1);
    expect(setInstallPage).toHaveBeenCalledWith(1);
    expect(setAccessPage).toHaveBeenCalledWith(1);
    expect(setSelectedUserId).toHaveBeenCalledWith('');
    expect(setActiveTab).toHaveBeenCalledWith('directory');
    expect(triggerUsersReload).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('CSV processed: 2 created, 1 updated. 1 row(s) need attention.');
    expect(setError).toHaveBeenLastCalledWith('Row 4: Missing email');
    expect(setImportingUsers).toHaveBeenLastCalledWith(false);
  });
});