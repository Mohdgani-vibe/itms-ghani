import { describe, expect, it } from 'vitest';

import { sshTerminalActionsReadOnly } from './sshTerminalActions';

describe('sshTerminalActionsReadOnly', () => {
  it('treats retired assets as read-only regardless of spacing or case', () => {
    expect(sshTerminalActionsReadOnly(' retired ')).toBe(true);
    expect(sshTerminalActionsReadOnly('RETIRED')).toBe(true);
  });

  it('keeps non-retired statuses writable', () => {
    expect(sshTerminalActionsReadOnly('active')).toBe(false);
    expect(sshTerminalActionsReadOnly('')).toBe(false);
    expect(sshTerminalActionsReadOnly(null)).toBe(false);
  });
});