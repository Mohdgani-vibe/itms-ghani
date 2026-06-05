// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import UserInstallWorkspace from './UserInstallWorkspace';
import { resolveInstallVariantCommandState } from './userInstallWorkspaceUtils';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderWorkspace() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <UserInstallWorkspace
        selectedUser={{ id: 'user-1', fullName: 'Chris Employee', employeeCode: 'EMP-101' }}
        installConfig={{
          publicServerUrl: 'https://portal.example.com',
          saltApiBaseUrl: 'https://salt.example.com',
          saltApiConfigured: true,
          portalInstallReady: true,
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
        copyStatus="linux-sync"
        onInstallAssignedToNameChange={vi.fn()}
        onInstallAssignedToEmailChange={vi.fn()}
        onInstallEmployeeCodeChange={vi.fn()}
        onInstallDepartmentNameChange={vi.fn()}
        onIncludeLinuxHardinfoFallbackChange={vi.fn()}
        onCopyCommand={vi.fn()}
      />,
    );
  });
  await flushEffects();

  return {
    container,
    cleanup: async () => {
      if (root) {
        await act(async () => {
          root!.unmount();
        });
      }
      container.remove();
    },
  };
}

async function changeSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('UserInstallWorkspace', () => {
  it('renders install configuration, employee fields, and copyable install/sync code', () => {
    const markup = renderToStaticMarkup(
      <UserInstallWorkspace
        selectedUser={{ id: 'user-1', fullName: 'Chris Employee', employeeCode: 'EMP-101' }}
        installConfig={{
          publicServerUrl: 'https://portal.example.com',
          saltApiBaseUrl: 'https://salt.example.com',
          saltApiConfigured: true,
          portalInstallReady: true,
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

  it('uses the shared Linux commands for supported RPM variants too', () => {
    expect(resolveInstallVariantCommandState({
      key: 'fedora',
      label: 'Fedora',
      title: 'Fedora install + first sync',
      description: 'RPM-based Linux bootstrap for Fedora endpoints using dnf-compatible install flow.',
      copyKind: 'fedora',
      supported: true,
      commandType: 'linux',
    }, 'linux-install', 'linux-sync', 'windows-install', 'windows-sync')).toEqual({
      installCommand: 'linux-install',
      syncCommand: 'linux-sync',
      syncCopyKind: 'linux-sync',
      syncTitle: 'Linux Sync Code',
    });
  });

  it('switches to Fedora while keeping shared Linux install and sync commands', async () => {
    const view = await renderWorkspace();

    const operatingSystemSelect = view.container.querySelector('select') as HTMLSelectElement | null;
    expect(operatingSystemSelect).toBeTruthy();
    expect(operatingSystemSelect?.value).toBe('windows');

    await changeSelectValue(operatingSystemSelect!, 'fedora');

    expect(view.container.textContent).toContain('Fedora install + first sync');
    expect(view.container.textContent).toContain('RPM-based Linux bootstrap for Fedora endpoints using dnf-compatible install flow.');
    expect(view.container.textContent).toContain('Fedora Install Code');
    expect(view.container.textContent).toContain('curl -fsSL https://portal.example.com/install.sh | bash');
    expect(view.container.textContent).toContain('Linux Sync Code');
    expect(view.container.textContent).toContain('itms-sync --linux');
    expect(view.container.textContent).toContain('Copied');

    await view.cleanup();
  });
});