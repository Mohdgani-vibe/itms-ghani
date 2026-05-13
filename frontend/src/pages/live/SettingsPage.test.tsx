import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const settingsMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  settingsOverviewPanelMock: vi.fn(),
  settingsPlatformSectionMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: settingsMocks.useLocationMock,
    useNavigate: settingsMocks.useNavigateMock,
  };
});

vi.mock('../../lib/session', () => ({
  getStoredSession: settingsMocks.getStoredSessionMock,
}));

vi.mock('../../components/settings/SettingsOverviewPanel', () => ({
  default: (props: unknown) => {
    settingsMocks.settingsOverviewPanelMock(props);
    return <div>settings-overview-panel</div>;
  },
}));

vi.mock('../../components/settings/SettingsPlatformSection', () => ({
  default: (props: unknown) => {
    settingsMocks.settingsPlatformSectionMock(props);
    return <div>settings-platform-section</div>;
  },
}));

vi.mock('../../components/ConfirmDialog', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsBootstrapSection', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsPatchPolicyPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsRequestTypeOwnersPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsWorkflowMembersPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsWorkflowRulesPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/SettingsWorkflowRoutingPanel', () => ({ default: () => null }));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('renders the default platform section and overview navigation for a super admin', () => {
    settingsMocks.useLocationMock.mockReturnValue({ pathname: '/admin/settings', hash: '' });
    settingsMocks.useNavigateMock.mockReturnValue(vi.fn());
    settingsMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });

    const markup = renderToStaticMarkup(<SettingsPage />);

    expect(markup).toContain('settings-overview-panel');
    expect(markup).toContain('settings-platform-section');
    expect(settingsMocks.settingsOverviewPanelMock).toHaveBeenCalledWith(expect.objectContaining({
      portalLabel: 'Super Admin Portal',
      activeSection: 'platform',
      canEditWorkflowSettings: true,
      detailSections: [
        { id: 'platform', label: 'Platform' },
        { id: 'bootstrap', label: 'Bootstrap' },
      ],
    }));
    expect(settingsMocks.settingsPlatformSectionMock).toHaveBeenCalledWith(expect.objectContaining({
      sessionUser: { role: 'super_admin' },
    }));
  });
});