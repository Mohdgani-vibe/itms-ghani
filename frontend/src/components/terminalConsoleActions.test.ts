import { describe, expect, it } from 'vitest';

import { terminalConsoleActionsReadOnly } from './terminalConsoleActions';

describe('terminalConsoleActionsReadOnly', () => {
  it('fails closed for retired assets', () => {
    expect(terminalConsoleActionsReadOnly('retired')).toBe(true);
  });

  it('keeps active assets actionable', () => {
    expect(terminalConsoleActionsReadOnly('in_use')).toBe(false);
  });
});