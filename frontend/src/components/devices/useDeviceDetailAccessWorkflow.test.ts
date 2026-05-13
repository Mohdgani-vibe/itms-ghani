import { describe, expect, it } from 'vitest';

import { deviceDetailAccessActionsReadOnly } from './useDeviceDetailAccessWorkflow';

describe('deviceDetailAccessActionsReadOnly', () => {
  it('fails closed for retired assets', () => {
    expect(deviceDetailAccessActionsReadOnly('retired')).toBe(true);
  });

  it('keeps active in-use assets operable', () => {
    expect(deviceDetailAccessActionsReadOnly('in_use')).toBe(false);
  });
});