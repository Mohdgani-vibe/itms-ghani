import { describe, expect, it } from 'vitest';

import {
  buildDeviceLinuxBootstrapCommand,
  buildDeviceWindowsBootstrapCommand,
  hasSaltTarget,
  inferBootstrapPlatform,
  resolveSaltTarget,
  saltTargetConnected,
} from './bootstrap';

describe('bootstrap', () => {
  it('resolves salt targets from linked identifiers, fallbacks, and assigned devices', () => {
    expect(resolveSaltTarget({ toolStatus: { salt: { identifier: ' minion-1 ' } } })).toBe('minion-1');
    expect(resolveSaltTarget({ saltMinionId: ' minion-2 ' })).toBe('minion-2');
    expect(resolveSaltTarget({ hostname: 'host-1', user: { email: 'alex@example.com' } })).toBe('host-1');
    expect(resolveSaltTarget({ assetId: 'asset-1', user: { fullName: 'Alex Kumar' } })).toBe('asset-1');
    expect(resolveSaltTarget({ hostname: 'host-2' })).toBe('');

    expect(hasSaltTarget({ hostname: 'host-1', user: { id: 'user-1' } })).toBe(true);
    expect(hasSaltTarget({ hostname: 'host-1' })).toBe(false);
    expect(saltTargetConnected({ toolStatus: { salt: { connected: false } } })).toBe(false);
    expect(saltTargetConnected({ toolStatus: { salt: { connected: true } } })).toBe(true);
    expect(saltTargetConnected({})).toBe(true);
  });

  it('infers bootstrap platforms from os names', () => {
    expect(inferBootstrapPlatform('Windows 11 Pro')).toBe('Windows');
    expect(inferBootstrapPlatform('Ubuntu 24.04 LTS')).toBe('Linux');
    expect(inferBootstrapPlatform('macOS Sonoma')).toBe('macOS');
    expect(inferBootstrapPlatform('FreeBSD')).toBe('Unknown platform');
  });

  it('builds linux and windows bootstrap commands with device metadata', () => {
    const device = {
      assetId: 'AST-101',
      hostname: 'ops-laptop-01',
      deviceType: 'Laptop',
      user: {
        fullName: "O'Brien",
        email: 'obrien@example.com',
        employeeCode: 'EMP-1',
      },
      department: { name: 'IT Ops' },
    };
    const config = {
      publicServerUrl: 'https://itms.example.com',
      saltMasterHost: 'salt.internal',
      wazuhManagerHost: 'wazuh.internal',
      saltApiConfigured: true,
      portalInstallReady: true,
    };

    const linuxCommand = buildDeviceLinuxBootstrapCommand(device, config);
    const windowsCommand = buildDeviceWindowsBootstrapCommand(device, config);

    expect(linuxCommand).toContain("curl -fsSL 'https://itms.example.com/installers/install-itms-agent.sh'");
    expect(linuxCommand).toContain('--prompt-token');
    expect(linuxCommand).toContain("--category 'laptop'");
    expect(linuxCommand).toContain("--assigned-to-name 'O\"'\"'Brien'");
    expect(linuxCommand).toContain("--notes 'Installed by ITMS bootstrap for ops-laptop-01'");

    expect(windowsCommand).toContain("Invoke-WebRequest 'https://itms.example.com/installers/install-itms-agent.ps1'");
    expect(windowsCommand).toContain('-PromptToken');
    expect(windowsCommand).toContain('-Category');
    expect(windowsCommand).toContain("'O''Brien'");
    expect(windowsCommand).toContain('-UseDetailedHardwareInventory $true');
  });
});