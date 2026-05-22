import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserInstallWorkspace, { resolveInstallVariantCommandState } from './UserInstallWorkspace';

describe('UserInstallWorkspace', () => {
  it('renders install configuration, employee fields, and copyable install/sync code', () => {
    const markup = renderToStaticMarkup(
      <UserInstallWorkspace
        selectedUser={{ id: 'user-1', fullName: 'Chris Employee', employeeCode: 'EMP-101' }}
        installConfig={{
          publicServerUrl: 'https://portal.example.com',
          inventoryIngestToken: 'token',
          saltApiBaseUrl: 'https://salt.example.com',
          saltApiConfigured: true,
          sshConfigured: true,
          sshAuthMode: 'certificate',
          wazuhApiConfigured: false,
        }}
        installConfigLoading={false}
        installAssignedToName="Chris Employee"
        installAssignedToEmail="chris@zerodha.com"
        installEmployeeCode="EMP-101"
        installDepartmentName="IT"
        mergedDepartmentOptions={[{ id: 'dept-1', name: 'IT' }]}
        includeLinuxHardinfoFallback={true}
        installEmailValid={true}
        installFieldsComplete={true}
        linuxInstallCommand="curl -fsSL https://portal.example.com/install.sh | bash"
        linuxSyncCommand="itms-sync --linux"
        windowsInstallCommand="powershell -File install.ps1"
        windowsSyncCommand="powershell -File sync.ps1"
        copyStatus="windows"
        onInstallAssignedToNameChange={vi.fn()}
        onInstallAssignedToEmailChange={vi.fn()}
        onInstallEmployeeCodeChange={vi.fn()}
        onInstallDepartmentNameChange={vi.fn()}
        onIncludeLinuxHardinfoFallbackChange={vi.fn()}
        onCopyCommand={vi.fn()}
      />,
    );

    expect(markup).toContain('Install Agents');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('EMP-101');
    expect(markup).toContain('https://portal.example.com');
    expect(markup).toContain('Configured');
    expect(markup).toContain('https://salt.example.com');
    expect(markup).toContain('Ready');
    expect(markup).toContain('Certificate-backed key');
    expect(markup).toContain('Include Linux hardinfo fallback');
    expect(markup).toContain('Use the Windows or Linux install code below on the endpoint.');
    expect(markup).toContain('Operating System');
    expect(markup).toContain('Windows install + first sync');
    expect(markup).toContain('Windows Install Code');
    expect(markup).toContain('powershell -File install.ps1');
    expect(markup).toContain('Windows Sync Code');
    expect(markup).toContain('powershell -File sync.ps1');
    expect(markup).toContain('Copied');
  });

  it('renders incomplete-form and invalid-email warnings', () => {
    const markup = renderToStaticMarkup(
      <UserInstallWorkspace
        selectedUser={null}
        installConfig={null}
        installConfigLoading={true}
        installAssignedToName=""
        installAssignedToEmail="bad@example.com"
        installEmployeeCode=""
        installDepartmentName=""
        mergedDepartmentOptions={[]}
        includeLinuxHardinfoFallback={false}
        installEmailValid={false}
        installFieldsComplete={false}
        linuxInstallCommand="linux"
        linuxSyncCommand="linux-sync"
        windowsInstallCommand="windows"
        windowsSyncCommand="windows-sync"
        copyStatus=""
        onInstallAssignedToNameChange={vi.fn()}
        onInstallAssignedToEmailChange={vi.fn()}
        onInstallEmployeeCodeChange={vi.fn()}
        onInstallDepartmentNameChange={vi.fn()}
        onIncludeLinuxHardinfoFallbackChange={vi.fn()}
        onCopyCommand={vi.fn()}
      />,
    );

    expect(markup).toContain('Select a user');
    expect(markup).toContain('Loading...');
    expect(markup).toContain('Use a valid @zerodha.com employee email.');
    expect(markup).toContain('No department list is configured yet, so enter the department manually.');
    expect(markup).toContain('Complete Employee name, Employee email, Employee ID, and Department to generate a runnable install command.');
  });

  it('keeps unsupported RPM variants on the status notice for both install and sync', () => {
    expect(resolveInstallVariantCommandState({
      key: 'fedora',
      label: 'Fedora',
      title: 'Fedora install status',
      description: 'RPM-based bootstrap is not configured in this ITMS deployment yet.',
      copyKind: 'fedora',
      supported: false,
      commandType: 'linux',
    }, 'linux-install', 'linux-sync', 'windows-install', 'windows-sync')).toEqual({
      installCommand: '# RPM-based ITMS bootstrap is not configured in this deployment yet.\n# Supported direct Linux bootstrap today: Ubuntu and Debian.\n# Contact ITMS admin if you need Fedora, CentOS, or Red Hat onboarding enabled.',
      syncCommand: '# RPM-based ITMS bootstrap is not configured in this deployment yet.\n# Supported direct Linux bootstrap today: Ubuntu and Debian.\n# Contact ITMS admin if you need Fedora, CentOS, or Red Hat onboarding enabled.',
      syncCopyKind: 'fedora',
      syncTitle: 'Fedora sync status',
    });
  });
});