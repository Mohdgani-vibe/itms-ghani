import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const usersPageMocks = vi.hoisted(() => ({
  useStateCallCount: 0,
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  usersPageHeaderMock: vi.fn(),
  usersPageFeedbackMock: vi.fn(),
  usersPageDialogsMock: vi.fn(),
  userEditorDialogMock: vi.fn(),
  useUserEditorWorkflowMock: vi.fn(),
  useUsersCsvWorkflowMock: vi.fn(),
  useUserStatusWorkflowMock: vi.fn(),
  useUserPortalAccessWorkflowMock: vi.fn(),
  useUserInstallWorkflowMock: vi.fn(),
  useEmployeeCreationWorkflowMock: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(initialValue: T) => {
      usersPageMocks.useStateCallCount += 1;
      if (usersPageMocks.useStateCallCount === 1) {
        return ['access' as T, vi.fn()] as const;
      }
      return actual.useState(initialValue);
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: usersPageMocks.useLocationMock,
    useNavigate: usersPageMocks.useNavigateMock,
  };
});

vi.mock('../../lib/session', () => ({
  getStoredSession: usersPageMocks.getStoredSessionMock,
}));

vi.mock('../../components/users/UsersPageHeader', () => ({
  default: (props: unknown) => {
    usersPageMocks.usersPageHeaderMock(props);
    return <div>users-page-header</div>;
  },
}));

vi.mock('../../components/users/UsersPageFeedback', () => ({
  default: (props: unknown) => {
    usersPageMocks.usersPageFeedbackMock(props);
    return <div>users-page-feedback</div>;
  },
}));

vi.mock('../../components/users/UsersPageDialogs', () => ({
  default: (props: unknown) => {
    usersPageMocks.usersPageDialogsMock(props);
    return <div>users-page-dialogs</div>;
  },
}));

vi.mock('../../components/users/UserEditorDialog', () => ({
  default: (props: unknown) => {
    usersPageMocks.userEditorDialogMock(props);
    return <div>user-editor-dialog</div>;
  },
}));

vi.mock('../../components/Pagination', () => ({ default: () => <div>pagination</div> }));

vi.mock('../../components/users/useUserEditorWorkflow', () => ({
  useUserEditorWorkflow: usersPageMocks.useUserEditorWorkflowMock,
}));

vi.mock('../../components/users/useUsersCsvWorkflow', () => ({
  useUsersCsvWorkflow: usersPageMocks.useUsersCsvWorkflowMock,
}));

vi.mock('../../components/users/useUserStatusWorkflow', () => ({
  useUserStatusWorkflow: usersPageMocks.useUserStatusWorkflowMock,
}));

vi.mock('../../components/users/useUserPortalAccessWorkflow', () => ({
  useUserPortalAccessWorkflow: usersPageMocks.useUserPortalAccessWorkflowMock,
}));

vi.mock('../../components/users/useUserInstallWorkflow', () => ({
  useUserInstallWorkflow: usersPageMocks.useUserInstallWorkflowMock,
}));

vi.mock('../../components/users/useEmployeeCreationWorkflow', () => ({
  useEmployeeCreationWorkflow: usersPageMocks.useEmployeeCreationWorkflowMock,
}));

import UsersPage from './UsersPage';

describe('UsersPage', () => {
  beforeEach(() => {
    usersPageMocks.useStateCallCount = 0;
    usersPageMocks.useLocationMock.mockReset();
    usersPageMocks.useNavigateMock.mockReset();
    usersPageMocks.getStoredSessionMock.mockReset();
    usersPageMocks.usersPageHeaderMock.mockReset();
    usersPageMocks.usersPageFeedbackMock.mockReset();
    usersPageMocks.usersPageDialogsMock.mockReset();
    usersPageMocks.userEditorDialogMock.mockReset();

    usersPageMocks.useUserEditorWorkflowMock.mockReturnValue({
      editingUser: null,
      userEditorMode: 'edit',
      savingEditedUser: false,
      closeUserEditor: vi.fn(),
      openUserEditor: vi.fn(),
      updateEditingUserField: vi.fn(),
      handleSaveEditedUser: vi.fn(),
    });
    usersPageMocks.useUsersCsvWorkflowMock.mockReturnValue({
      userImportInputRef: { current: null },
      csvActionLoading: '',
      importingUsers: false,
      openImportPicker: vi.fn(),
      handleDownloadUsersCsv: vi.fn(),
      handleImportUsers: vi.fn(),
    });
    usersPageMocks.useUserStatusWorkflowMock.mockReturnValue({
      pendingUserAction: null,
      pendingBulkUserAction: null,
      selectedBulkUserIds: [],
      selectedBulkUsers: [],
      allVisibleBulkUsersSelected: false,
      userActionLoadingId: '',
      bulkUserActionLoading: false,
      setPendingUserAction: vi.fn(),
      setPendingBulkUserAction: vi.fn(),
      toggleBulkUserSelection: vi.fn(),
      toggleSelectAllVisibleUsers: vi.fn(),
      requestBulkUserAction: vi.fn(),
      requestUserAction: vi.fn(),
      handleUserStatusAction: vi.fn(),
      handleBulkUserStatusAction: vi.fn(),
    });
    usersPageMocks.useUserPortalAccessWorkflowMock.mockReturnValue({
      portalDrafts: {},
      accessSavingUserId: '',
      handlePortalToggle: vi.fn(),
      handlePortalSave: vi.fn(),
    });
    usersPageMocks.useUserInstallWorkflowMock.mockReturnValue({
      installAssignedToName: '',
      installAssignedToEmail: '',
      installEmployeeCode: '',
      installDepartmentName: '',
      includeLinuxHardinfoFallback: true,
      copyStatus: '',
      installEmailValid: false,
      installFieldsComplete: false,
      linuxInstallCommand: '',
      linuxSyncCommand: '',
      windowsInstallCommand: '',
      windowsSyncCommand: '',
      setInstallAssignedToName: vi.fn(),
      setInstallAssignedToEmail: vi.fn(),
      setInstallEmployeeCode: vi.fn(),
      setInstallDepartmentName: vi.fn(),
      setIncludeLinuxHardinfoFallback: vi.fn(),
      handleCopyCommand: vi.fn(),
    });
    usersPageMocks.useEmployeeCreationWorkflowMock.mockReturnValue({
      setSelectedEmployeeEntityId: vi.fn(),
      creatingEmployee: false,
      employeeForm: { role: '' },
      defaultEntityId: '',
      defaultEntityLabel: '',
      updateEmployeeFormField: vi.fn(),
      handleCreateEmployee: vi.fn(),
    });
  });

  it('renders the access-tab loading shell for super admins', () => {
    usersPageMocks.useLocationMock.mockReturnValue({ pathname: '/admin/users' });
    usersPageMocks.useNavigateMock.mockReturnValue(vi.fn());
    usersPageMocks.getStoredSessionMock.mockReturnValue({ user: { role: 'super_admin', id: 'user-1' } });

    const markup = renderToStaticMarkup(<UsersPage />);

    expect(markup).toContain('users-page-header');
    expect(markup).toContain('users-page-feedback');
    expect(markup).toContain('users-page-dialogs');
    expect(markup).toContain('user-editor-dialog');
    expect(markup).toContain('Loading portal access...');
    expect(usersPageMocks.usersPageHeaderMock).toHaveBeenCalledWith(expect.objectContaining({
      activeTab: 'access',
      isSuperAdmin: true,
      isAuditor: false,
    }));
  });
});