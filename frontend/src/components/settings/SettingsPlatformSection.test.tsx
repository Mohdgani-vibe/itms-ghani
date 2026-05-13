import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SettingsPlatformSection from './SettingsPlatformSection';

describe('SettingsPlatformSection', () => {
  it('renders platform status, sync details, and portal context', () => {
    const markup = renderToStaticMarkup(
      <SettingsPlatformSection
        installConfig={{
          publicServerUrl: 'https://portal.example.com',
          inventoryIngestToken: 'token',
          saltMasterHost: 'salt-master.internal',
          saltApiBaseUrl: 'https://salt.example.com',
          wazuhManagerHost: 'wazuh.internal',
          saltApiConfigured: true,
          saltBootstrapReady: true,
          sshConfigured: true,
          sshAuthMode: 'certificate',
          wazuhApiConfigured: false,
          portalInstallReady: true,
          linuxInstallerUrl: 'https://portal.example.com/agent.sh',
          windowsInstallerUrl: 'https://portal.example.com/agent.ps1',
        }}
        syncStatus={{
          enabled: true,
          configured: true,
          sourceType: 'ldap',
          interval: '15m',
          running: false,
          nextRunAt: '2026-05-08T12:30:00Z',
          lastRun: {
            status: 'success',
            startedAt: '2026-05-08T12:00:00Z',
            finishedAt: '2026-05-08T12:01:00Z',
            recordsSeen: 42,
            recordsUpserted: 17,
            error: 'Transient warning',
          },
        }}
        meta={{
          roles: [],
          departments: [{ id: 'dept-1', name: 'IT' }],
          branches: [{ id: 'branch-1', name: 'HQ' }],
        }}
        sessionUser={{
          fullName: 'Taylor Admin',
          email: 'taylor@example.com',
          role: 'admin',
          defaultPortal: 'operations',
        }}
        formatDateTime={(value) => value ? `formatted:${value}` : 'Unknown'}
      />,
    );

    expect(markup).toContain('Platform Status');
    expect(markup).toContain('https://portal.example.com');
    expect(markup).toContain('15m');
    expect(markup).toContain('salt-master.internal');
    expect(markup).toContain('Connected');
    expect(markup).toContain('Optional integration not configured');
    expect(markup).toContain('Certificate-backed');
    expect(markup).toContain('Ready');
    expect(markup).toContain('formatted:2026-05-08T12:00:00Z');
    expect(markup).toContain('Status: success');
    expect(markup).toContain('Records seen: 42');
    expect(markup).toContain('Upserted: 17');
    expect(markup).toContain('Transient warning');
    expect(markup).toContain('Taylor Admin');
    expect(markup).toContain('taylor@example.com • admin');
    expect(markup).toContain('operations');
    expect(markup).toContain('IT');
    expect(markup).toContain('HQ');
    expect(markup).toContain('Next run: formatted:2026-05-08T12:30:00Z');
  });

  it('renders fallback values when platform data is missing', () => {
    const markup = renderToStaticMarkup(
      <SettingsPlatformSection
        installConfig={null}
        syncStatus={null}
        meta={{ roles: [], departments: [], branches: [] }}
        sessionUser={null}
        formatDateTime={() => 'Unknown'}
      />,
    );

    expect(markup).toContain('Not configured');
    expect(markup).toContain('Not available');
    expect(markup).toContain('Unknown user');
    expect(markup).toContain('No email • No role');
    expect(markup).toContain('No departments returned by the backend.');
    expect(markup).toContain('No branches returned by the backend.');
    expect(markup).toContain('Next run: Unknown');
  });
});