import { describe, expect, it } from 'vitest';

import { sshTerminalActionsReadOnly } from './sshTerminalActions';

describe('sshTerminalActionsReadOnly', () => {
  it('fails closed for retired assets', () => {
    expect(sshTerminalActionsReadOnly('retired')).toBe(true);
  });

  it('keeps active assets actionable', () => {
    expect(sshTerminalActionsReadOnly('in_use')).toBe(false);
  });
});