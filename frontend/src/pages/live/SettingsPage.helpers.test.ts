import { describe, expect, it } from 'vitest';

import {
  buildLinuxArgumentString,
  buildSettingsLinuxBootstrapCommand,
  buildSettingsLinuxSyncCommand,
  buildSettingsWindowsBootstrapCommand,
  buildSettingsWindowsSyncCommand,
  buildWindowsArgumentString,
  filterRequestWorkflowUsers,
  formatDateTime,
  formatPowerShellArgument,
  isProbeWorkflowUser,
  normalizeDirectoryUsers,
  normalizePatchDepartmentName,
  normalizePatchRing,
  normalizePatchWindowTime,
  pruneWorkflowSettingsForEligibleUsers,
  normalizeWorkflowSettings,
  parseEditorTextToRoutes,
  quotePowerShell,
  quoteShell,
  resolveWorkflowMemberUsers,
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

  it('normalizes legacy workflow ids and routes', () => {
    expect(normalizeWorkflowSettings({
      requestFallbackAssigneeId: ' user-1 ',
      chatFallbackAssigneeId: ' ',
      ticketAssigneeIds: [' user-1 ', 'user-2', 'user-1'],
      chatMemberIds: [' member-1 ', '', 'member-1'],
      requestTypeRoutes: [{ match: '  Laptop   Change ', assigneeId: ' user-1 ' }, { match: ' ', assigneeId: 'user-2' }],
      requestSubjectRoutes: [{ match: ' VPN  issue ', assigneeId: ' owner-1 ' }],
      chatSubjectRoutes: [{ match: ' Owner  followup ', assigneeId: ' chat-1 ' }],
      patchWindowEnabled: false,
      patchWindowStart: '8:00',
      patchWindowEnd: '99:99',
      patchAllowedRings: [],
      patchDepartmentRings: [],
    } as never)).toMatchObject({
      requestFallbackAssigneeId: 'user-1',
      chatFallbackAssigneeId: null,
      ticketAssigneeIds: ['user-1', 'user-2'],
      chatMemberIds: ['member-1'],
      requestTypeRoutes: [{ match: 'laptop change', assigneeId: 'user-1' }],
      requestSubjectRoutes: [{ match: 'vpn issue', assigneeId: 'owner-1' }],
      chatSubjectRoutes: [{ match: 'owner followup', assigneeId: 'chat-1' }],
      patchWindowStart: '22:00',
      patchWindowEnd: '06:00',
    });
  });

  it('separates explicit workflow members from effective eligible users', () => {
    const users = [
      { id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'super_admin' },
      { id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' },
    ];

    expect(resolveWorkflowMemberUsers(users as never, [])).toEqual({
      selectedUsers: [],
      effectiveUsers: users,
    });
    expect(resolveWorkflowMemberUsers(users as never, [' user-2 ', 'user-2'])).toEqual({
      selectedUsers: [{ id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' }],
      effectiveUsers: [{ id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' }],
    });
  });

  it('limits request workflow users to privileged roles until employees exist', () => {
    const mixedUsers = [
      { id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'super_admin' },
      { id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' },
      { id: 'user-3', fullName: 'Op Admin', email: 'opadmin@example.com', role: 'admin' },
      { id: 'user-4', fullName: 'Auditor User', email: 'auditor@example.com', role: 'auditor' },
    ];

    expect(filterRequestWorkflowUsers(mixedUsers as never)).toEqual([
      { id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'super_admin' },
      { id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' },
      { id: 'user-3', fullName: 'Op Admin', email: 'opadmin@example.com', role: 'admin' },
    ]);

    expect(filterRequestWorkflowUsers([
      ...mixedUsers,
      { id: 'user-5', fullName: 'Esha Employee', email: 'esha@example.com', role: 'employee' },
    ] as never)).toEqual([
      ...mixedUsers,
      { id: 'user-5', fullName: 'Esha Employee', email: 'esha@example.com', role: 'employee' },
    ]);
  });

  it('prunes workflow assignee references against effective eligible users', () => {
    const users = [
      { id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'super_admin' },
      { id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it_team' },
    ];
    const chatUsers = [
      { id: 'chat-1', fullName: 'Chat One', email: 'chat1@example.com', role: 'it_team' },
      { id: 'chat-2', fullName: 'Chat Two', email: 'chat2@example.com', role: 'super_admin' },
    ];
    const settings = normalizeWorkflowSettings({
      requestFallbackAssigneeId: 'user-1',
      chatFallbackAssigneeId: 'chat-1',
      ticketAssigneeIds: ['user-1'],
      chatMemberIds: ['chat-1'],
      requestTypeRoutes: [
        { match: 'Portal Access', assigneeId: 'user-1' },
        { match: 'Device Enrollment', assigneeId: 'user-3' },
      ],
      requestSubjectRoutes: [
        { match: 'VPN', assigneeId: 'user-1' },
        { match: 'Laptop', assigneeId: 'user-3' },
      ],
      chatSubjectRoutes: [
        { match: 'Leave', assigneeId: 'chat-1' },
        { match: 'Patch', assigneeId: 'chat-3' },
      ],
      patchWindowEnabled: false,
      patchWindowStart: '22:00',
      patchWindowEnd: '06:00',
      patchAllowedRings: [],
      patchDepartmentRings: [],
    } as never);

    const narrowed = pruneWorkflowSettingsForEligibleUsers(settings, ['user-2'], ['chat-2']);
    expect(narrowed.requestFallbackAssigneeId).toBeNull();
    expect(narrowed.chatFallbackAssigneeId).toBeNull();
    expect(narrowed.requestTypeRoutes).toEqual([]);
    expect(narrowed.requestSubjectRoutes).toEqual([]);
    expect(narrowed.chatSubjectRoutes).toEqual([]);

    const widenedRequestIds = resolveWorkflowMemberUsers(users as never, []).effectiveUsers.map((user) => user.id);
    const widenedChatIds = resolveWorkflowMemberUsers(chatUsers as never, []).effectiveUsers.map((user) => user.id);
    const widened = pruneWorkflowSettingsForEligibleUsers(settings, widenedRequestIds, widenedChatIds);
    expect(widened.requestFallbackAssigneeId).toBe('user-1');
    expect(widened.chatFallbackAssigneeId).toBe('chat-1');
    expect(widened.requestTypeRoutes).toEqual([{ match: 'portal access', assigneeId: 'user-1' }]);
    expect(widened.requestSubjectRoutes).toEqual([{ match: 'vpn', assigneeId: 'user-1' }]);
    expect(widened.chatSubjectRoutes).toEqual([{ match: 'leave', assigneeId: 'chat-1' }]);
  });

  it('parses and serializes workflow routes', () => {
    expect(normalizePatchDepartmentName('  IT   Support  ')).toBe('it support');
    expect(normalizePatchRing(' Critical ')).toBe('critical');
    expect(normalizePatchWindowTime(' 09:30 ')).toBe('09:30');
    expect(normalizePatchWindowTime('9:30')).toBe('');
    expect(normalizePatchWindowTime('24:00')).toBe('');
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

  it('normalizes legacy patch ring values', () => {
    expect(normalizeWorkflowSettings({
      requestFallbackAssigneeId: '',
      chatFallbackAssigneeId: '',
      ticketAssigneeIds: [],
      chatMemberIds: [],
      requestTypeRoutes: [],
      requestSubjectRoutes: [],
      chatSubjectRoutes: [],
      patchWindowEnabled: false,
      patchWindowStart: '22:00',
      patchWindowEnd: '06:00',
      patchAllowedRings: [' Critical ', 'pilot', 'critical'],
      patchDepartmentRings: [{ match: ' IT ', ring: ' Critical ' }, { match: 'Finance', ring: 'standard' }, { match: 'Legal', ring: 'unknown' }],
    } as never)).toMatchObject({
      patchAllowedRings: ['critical', 'pilot'],
      patchDepartmentRings: [{ match: 'it', ring: 'critical' }],
    });
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