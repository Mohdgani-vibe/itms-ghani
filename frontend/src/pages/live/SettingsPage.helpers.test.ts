import { describe, expect, it } from 'vitest';

import {
  buildLinuxArgumentString,
  buildSettingsLinuxBootstrapCommand,
  buildSettingsLinuxSyncCommand,
  buildSettingsWindowsBootstrapCommand,
  buildSettingsWindowsSyncCommand,
  buildWindowsArgumentString,
  formatDateTime,
  formatPowerShellArgument,
  isProbeWorkflowUser,
  normalizeDirectoryUsers,
  normalizePatchDepartmentName,
  normalizeWorkflowSettings,
  parseEditorTextToRoutes,
  quotePowerShell,
  quoteShell,
  routesToEditorText,
  serializeWorkflowSettings,
  workflowTypeAssignee,
} from './SettingsPage';

describe('SettingsPage helpers', () => {
  it('normalizes workflow settings defaults', () => {
    expect(normalizeWorkflowSettings({
      requestFallbackAssigneeId: '',
      chatFallbackAssigneeId: undefined as never,
      ticketAssigneeIds: undefined as never,
      chatMemberIds: undefined as never,
      requestTypeRoutes: undefined as never,
      requestSubjectRoutes: undefined as never,
      chatSubjectRoutes: undefined as never,
      patchWindowEnabled: undefined as never,
      patchWindowStart: '',
      patchWindowEnd: '',
      patchAllowedRings: undefined as never,
      patchDepartmentRings: undefined as never,
    } as never)).toMatchObject({
      requestFallbackAssigneeId: null,
      chatFallbackAssigneeId: null,
      ticketAssigneeIds: [],
      chatMemberIds: [],
      requestTypeRoutes: [],
      requestSubjectRoutes: [],
      chatSubjectRoutes: [],
      patchWindowEnabled: false,
      patchWindowStart: '22:00',
      patchWindowEnd: '06:00',
      patchAllowedRings: [],
      patchDepartmentRings: [],
    });
  });

  it('parses and serializes workflow routes', () => {
    expect(normalizePatchDepartmentName('  IT   Support  ')).toBe('it support');
    expect(routesToEditorText([
      { match: 'Laptop change', assigneeId: 'user-1' },
      { match: 'Portal access', assigneeId: 'user-2' },
    ])).toBe('Laptop change => user-1\nPortal access => user-2');
    expect(parseEditorTextToRoutes('Laptop change => user-1\nPortal access = user-2\ninvalid line')).toEqual({
      routes: [
        { match: 'Laptop change', assigneeId: 'user-1' },
        { match: 'Portal access', assigneeId: 'user-2' },
      ],
      invalidLines: ['invalid line'],
    });
    expect(workflowTypeAssignee({
      requestTypeRoutes: [
        { match: 'Laptop change', assigneeId: 'user-1' },
      ],
    } as never, 'laptop change')).toBe('user-1');
    expect(workflowTypeAssignee(null, 'laptop change')).toBe('');
  });

  it('normalizes directory users and serializes workflow fallbacks', () => {
    expect(normalizeDirectoryUsers([
      {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@example.com',
        role: 'it_team',
        emp_id: 'EMP-1',
      },
      {
        id: 'user-2',
        full_name: 'Priya Nair',
        email: 'priya@example.com',
        role: 'super_admin',
        emp_id: 'EMP-2',
      },
      {
        id: 'user-3',
        email: 'fallback@example.com',
        role: 'auditor',
        emp_id: 'EMP-3',
      },
    ] as never)).toEqual([
      {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@example.com',
        role: 'it_team',
        employeeCode: 'EMP-1',
      },
      {
        id: 'user-2',
        fullName: 'Priya Nair',
        email: 'priya@example.com',
        role: 'super_admin',
        employeeCode: 'EMP-2',
      },
      {
        id: 'user-3',
        fullName: 'fallback@example.com',
        email: 'fallback@example.com',
        role: 'auditor',
        employeeCode: 'EMP-3',
      },
    ]);

    expect(isProbeWorkflowUser({
      fullName: 'Probe User',
      email: 'probe@zerodha.com',
      employeeCode: 'PROBE-01',
    } as never)).toBe(true);
    expect(isProbeWorkflowUser({
      fullName: 'Regular User',
      email: 'regular@zerodha.com',
      employeeCode: 'EMP-1',
    } as never)).toBe(false);

    expect(serializeWorkflowSettings({
      requestFallbackAssigneeId: null,
      chatFallbackAssigneeId: null,
      requestTypeRoutes: [],
    } as never)).toMatchObject({
      requestFallbackAssigneeId: '',
      chatFallbackAssigneeId: '',
    });
  });

  it('quotes shell and PowerShell arguments safely', () => {
    expect(quoteShell("O'Reilly")).toBe("'O" + '"' + "'" + '"' + "'Reilly'");
    expect(quotePowerShell("O'Reilly")).toBe("'O''Reilly'");
    expect(formatPowerShellArgument('$true')).toBe('$true');
    expect(formatPowerShellArgument('plain text')).toBe("'plain text'");
    expect(buildLinuxArgumentString([
      ['server-url', 'https://itms.example'],
      ['notes', "Installed by IT's desk"],
    ])).toContain("--notes 'Installed by IT");
    expect(buildWindowsArgumentString([
      ['server-url', 'https://itms.example'],
      ['use-detailed-hardware-inventory', '$true'],
    ])).toContain('-UseDetailedHardwareInventory $true');
  });

  it('builds bootstrap and sync commands with config fallbacks', () => {
    const config = {
      publicServerUrl: 'https://itms.example',
      linuxInstallerUrl: 'https://itms.example/linux.sh',
      windowsInstallerUrl: 'https://itms.example/windows.ps1',
      inventoryIngestToken: 'token-123',
      saltMasterHost: 'salt.internal',
      wazuhManagerHost: 'wazuh.internal',
    };

    expect(buildSettingsLinuxBootstrapCommand(config as never)).toContain("curl -fsSL 'https://itms.example/linux.sh'");
    expect(buildSettingsLinuxBootstrapCommand(config as never)).toContain('--use-hardinfo-fallback');
    expect(buildSettingsLinuxBootstrapCommand(config as never, false)).not.toContain('--use-hardinfo-fallback');
    expect(buildSettingsWindowsBootstrapCommand(config as never)).toContain("Invoke-WebRequest 'https://itms.example/windows.ps1'");
    expect(buildSettingsLinuxSyncCommand(config as never)).toContain("--server-url 'https://itms.example'");
    expect(buildSettingsLinuxSyncCommand(config as never, false)).not.toContain('--use-hardinfo-fallback');
    expect(buildSettingsWindowsSyncCommand(config as never)).toContain("-ServerUrl 'https://itms.example'");
  });

  it('formats timestamps with graceful fallbacks', () => {
    expect(formatDateTime()).toBe('Not available');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('2026-05-09T10:00:00Z')).not.toBe('Not available');
  });
});