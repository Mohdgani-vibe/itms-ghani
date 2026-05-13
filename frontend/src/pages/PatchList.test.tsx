import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const patchListMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  apiRequestMock: vi.fn(() => new Promise(() => undefined)),
  patchListHeaderMock: vi.fn(),
  patchDepartmentRunPanelMock: vi.fn(),
  patchDepartmentFilterPanelMock: vi.fn(),
  patchRecentReportsPanelMock: vi.fn(),
  patchDeviceTablePanelMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: patchListMocks.useLocationMock,
    useNavigate: patchListMocks.useNavigateMock,
  };
});

vi.mock('../lib/api', () => ({
  apiRequest: patchListMocks.apiRequestMock,
}));

vi.mock('../lib/session', () => ({
  getStoredSession: patchListMocks.getStoredSessionMock,
}));

vi.mock('../components/patch/PatchListHeader', () => ({
  default: (props: unknown) => {
    patchListMocks.patchListHeaderMock(props);
    return <div>patch-list-header</div>;
  },
}));

vi.mock('../components/patch/PatchDepartmentRunPanel', () => ({
  default: (props: unknown) => {
    patchListMocks.patchDepartmentRunPanelMock(props);
    return <div>patch-department-run-panel</div>;
  },
}));

vi.mock('../components/patch/PatchDepartmentFilterPanel', () => ({
  default: (props: unknown) => {
    patchListMocks.patchDepartmentFilterPanelMock(props);
    return <div>patch-department-filter-panel</div>;
  },
}));

vi.mock('../components/patch/PatchRecentReportsPanel', () => ({
  default: (props: unknown) => {
    patchListMocks.patchRecentReportsPanelMock(props);
    return <div>patch-recent-reports-panel</div>;
  },
}));

vi.mock('../components/patch/PatchDeviceTablePanel', () => ({
  default: (props: unknown) => {
    patchListMocks.patchDeviceTablePanelMock(props);
    return <div>patch-device-table-panel</div>;
  },
}));

vi.mock('../components/patch/PatchDeviceRow', () => ({ default: () => null }));
vi.mock('../components/patch/PatchListFeedback', () => ({ default: () => null }));
vi.mock('../components/DepartmentSaltConsolePickerModal', () => ({ default: () => null }));
vi.mock('../components/EmbeddedConsoleModal', () => ({ default: () => null }));
vi.mock('../components/PatchRunReportModal', () => ({ default: () => null }));
vi.mock('../components/Pagination', () => ({ default: () => null }));

import PatchList from './PatchList';

describe('PatchList', () => {
  it('renders the initial patch dashboard shell for operators before device data resolves', () => {
    patchListMocks.useLocationMock.mockReturnValue({ pathname: '/admin/patch/devices' });
    patchListMocks.useNavigateMock.mockReturnValue(vi.fn());
    patchListMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });

    const markup = renderToStaticMarkup(<PatchList />);

    expect(markup).toContain('patch-list-header');
    expect(markup).toContain('patch-department-run-panel');
    expect(markup).toContain('patch-department-filter-panel');
    expect(markup).toContain('patch-recent-reports-panel');
    expect(markup).toContain('patch-device-table-panel');
    expect(patchListMocks.patchDepartmentRunPanelMock).toHaveBeenCalledWith(expect.objectContaining({
      loading: true,
      canOperate: true,
      totalDevices: 0,
    }));
    expect(patchListMocks.patchDeviceTablePanelMock).toHaveBeenCalledWith(expect.objectContaining({
      loading: true,
      totalLabel: 'Loading devices',
      isEmpty: true,
    }));
  });
});