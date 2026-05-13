import { describe, expect, it } from 'vitest';

import {
  SALT_ACTION_OPTIONS,
  buildSaltActionConsolePrefill,
  buildSaltActionRequest,
  getSaltActionOption,
  isPatchReportableSaltAction,
  saltActionInputError,
  saltActionSuccessMessage,
} from './salt';

describe('salt', () => {
  it('returns action metadata and payloads for built-in and custom actions', () => {
    expect(SALT_ACTION_OPTIONS).toHaveLength(6);
    expect(getSaltActionOption('chrome-update').label).toBe('Chrome Update');
    expect(getSaltActionOption('unknown').value).toBe('system-update');

    expect(buildSaltActionRequest('system-update', '')).toEqual({ action: 'system-update' });
    expect(buildSaltActionRequest('custom-command', 'uptime')).toEqual({ action: 'custom-command', command: 'uptime' });
    expect(buildSaltActionRequest('custom-state', 'patch.run')).toEqual({ action: 'custom-state', state: 'patch.run' });
  });

  it('detects patch-reportable actions and validates required custom input', () => {
    expect(isPatchReportableSaltAction('system-update', '')).toBe(true);
    expect(isPatchReportableSaltAction('custom-state', 'patch.run')).toBe(true);
    expect(isPatchReportableSaltAction('custom-state', 'patch.chrome')).toBe(true);
    expect(isPatchReportableSaltAction('custom-state', 'inventory.sync')).toBe(false);
    expect(isPatchReportableSaltAction('custom-command', 'apt-get update')).toBe(false);

    expect(saltActionInputError('custom-command', '')).toBe('Shell command is required.');
    expect(saltActionInputError('custom-state', '')).toBe('Salt state is required.');
    expect(saltActionInputError('custom-state', 'patch.run')).toBe('');
  });

  it('builds console prefills and success messages for linux and windows targets', () => {
    expect(buildSaltActionConsolePrefill('chrome-update', '', 'Windows 11')).toContain('Google\\Update\\GoogleUpdate.exe');
    expect(buildSaltActionConsolePrefill('chrome-update', '', 'Ubuntu 24.04')).toBe('apt-get update && apt-get install --only-upgrade -y google-chrome-stable');
    expect(buildSaltActionConsolePrefill('check-salt-minion', '', 'Windows 11')).toContain('Get-Service -Name salt-minion');
    expect(buildSaltActionConsolePrefill('restart-salt-minion', '', 'Ubuntu')).toBe('systemctl restart salt-minion && systemctl status --no-pager salt-minion');
    expect(buildSaltActionConsolePrefill('custom-command', 'echo hello', 'Ubuntu')).toBe('echo hello');
    expect(buildSaltActionConsolePrefill('custom-state', 'patch.run', 'Ubuntu')).toBe('salt-call state.apply patch.run');
    expect(buildSaltActionConsolePrefill('system-update', '', 'Ubuntu')).toBe('state.apply patch.run');

    expect(saltActionSuccessMessage('system-update', 'completed', 'host-1', true)).toBe('System Update completed for host-1. Salt command console opened.');
    expect(saltActionSuccessMessage('restart-salt-minion', 'failed', 'host-1', false)).toBe('Restart Salt Minion failed for host-1.');
    expect(saltActionSuccessMessage('custom-command', 'queued', 'host-1', false)).toBe('Custom Shell Command requested for host-1.');
  });
});