import { describe, expect, it } from 'vitest';

import {
  buildLinuxBootstrapCommand,
  buildLinuxSyncCommand,
  buildWindowsBootstrapCommand,
  buildWindowsSyncCommand,
} from './userInstallCommandUtils';

describe('userInstallCommandUtils', () => {
  it('builds linux bootstrap commands with config, overrides, and optional fallback', () => {
    const command = buildLinuxBootstrapCommand(
      {
        publicServerUrl: 'https://itms.example.com',
        inventoryIngestToken: 'token-123',
        saltMasterHost: 'salt.internal',
        wazuhManagerHost: 'wazuh.internal',
        saltApiConfigured: true,
        wazuhApiConfigured: true,
        portalInstallReady: true,
      },
      null,
      {
        assignedToName: "O'Brien",
        assignedToEmail: 'obrien@example.com',
        employeeCode: 'EMP-1',
        departmentName: 'IT Ops',
        includeHardinfoFallback: true,
      },
    );

    expect(command).toContain("curl -fsSL 'https://itms.example.com/installers/install-itms-agent.sh'");
    expect(command).toContain('--prompt-token');
    expect(command).toContain("--server-url 'https://itms.example.com'");
    expect(command).toContain("--assigned-to-name 'O\"'\"'Brien'");
    expect(command).toContain('--department-name');
    expect(command).toContain('--use-hardinfo-fallback');
  });

  it('builds windows bootstrap commands with quoted powershell arguments', () => {
    const command = buildWindowsBootstrapCommand(
      {
        publicServerUrl: 'https://itms.example.com',
        inventoryIngestToken: 'token-123',
        saltMasterHost: 'salt.internal',
        wazuhManagerHost: 'wazuh.internal',
        saltApiConfigured: true,
        wazuhApiConfigured: true,
        portalInstallReady: true,
      },
      null,
      {
        assignedToName: "O'Brien",
      },
    );

    expect(command).toContain("Invoke-WebRequest 'https://itms.example.com/installers/install-itms-agent.ps1'");
    expect(command).toContain('-PromptToken');
    expect(command).toContain('-ServerUrl');
    expect(command).toContain("'O''Brien'");
    expect(command).toContain('-UseDetailedHardwareInventory $true');
  });

  it('builds sync commands with defaults when config is missing', () => {
    expect(buildLinuxSyncCommand()).toContain("--server-url '<ITMS_SERVER_URL>'");
    expect(buildLinuxSyncCommand()).not.toContain('--token');
    expect(buildLinuxSyncCommand(undefined, null, false)).not.toContain('--use-hardinfo-fallback');
    expect(buildWindowsSyncCommand()).toContain("-ServerUrl '<ITMS_SERVER_URL>'");
    expect(buildWindowsSyncCommand()).not.toContain('-Token');
    expect(buildWindowsSyncCommand()).toContain("-Category 'auto'");
  });
});