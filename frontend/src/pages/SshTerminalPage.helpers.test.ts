import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });
});

import { getSshBlockedReason, shouldRecordSshTerminalSession } from './sshTerminalPageUtils';

describe('SshTerminalPage helpers', () => {
  it('blocks missing and retired SSH targets', () => {
    expect(getSshBlockedReason('')).toBe('SSH target is missing.');
    expect(getSshBlockedReason('asset-1', 'retired')).toBe(
      'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.',
    );
  });

  it('leaves active SSH targets unblocked', () => {
    expect(getSshBlockedReason('asset-2', 'active')).toBe('');
    expect(getSshBlockedReason('asset-3', null)).toBe('');
  });

  it('allows session recording only when the route is actionable', () => {
    expect(shouldRecordSshTerminalSession(false, 'asset-4', '', false, '')).toBe(true);
    expect(shouldRecordSshTerminalSession(true, 'asset-4', '', false, '')).toBe(false);
    expect(shouldRecordSshTerminalSession(false, '', '', false, '')).toBe(false);
    expect(shouldRecordSshTerminalSession(false, 'asset-4', 'blocked', false, '')).toBe(false);
    expect(shouldRecordSshTerminalSession(false, 'asset-4', '', true, '')).toBe(false);
    expect(shouldRecordSshTerminalSession(false, 'asset-4', '', false, 'asset-4')).toBe(false);
  });
});