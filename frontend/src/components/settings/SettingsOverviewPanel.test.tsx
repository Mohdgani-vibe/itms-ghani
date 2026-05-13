import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsOverviewPanel from './SettingsOverviewPanel';

describe('SettingsOverviewPanel', () => {
  it('renders the refreshed settings workspace shell', () => {
    const markup = renderToStaticMarkup(
      <SettingsOverviewPanel
        canEditWorkflowSettings={true}
        portalLabel="IT Portal"
        loading={false}
        refreshing={false}
        error=""
        installConfig={{ portalInstallReady: true }}
        syncStatus={{ enabled: true, configured: true, running: false }}
        meta={{ roles: [], departments: [{ id: 'dept-1', name: 'IT' }], branches: [{ id: 'branch-1', name: 'HQ' }] }}
        detailSections={[{ id: 'platform', label: 'Platform' }, { id: 'workflow', label: 'Workflow' }, { id: 'bootstrap', label: 'Bootstrap' }]}
        activeSection="platform"
        onRefresh={vi.fn()}
        onSelectSection={vi.fn()}
      />,
    );

    expect(markup).toContain('Admin Workspace');
    expect(markup).toContain('Settings');
    expect(markup).toContain('IT Portal');
    expect(markup).toContain('Endpoint Onboarding');
    expect(markup).toContain('Inventory Sync');
    expect(markup).toContain('Platform');
    expect(markup).toContain('Workflow');
    expect(markup).toContain('Bootstrap');
  });
});