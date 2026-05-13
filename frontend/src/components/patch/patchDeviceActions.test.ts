import { describe, expect, it } from 'vitest';

import { PATCH_DEVICE_READ_ONLY_REASON, patchDeviceActionsReadOnly } from './patchDeviceActions';

describe('patchDeviceActionsReadOnly', () => {
  it('marks retired devices as read-only', () => {
    expect(patchDeviceActionsReadOnly(' retired ')).toBe(true);
    expect(PATCH_DEVICE_READ_ONLY_REASON).toContain('Retired assets are read-only');
  });

  it('leaves active devices writable', () => {
    expect(patchDeviceActionsReadOnly('active')).toBe(false);
    expect(patchDeviceActionsReadOnly(undefined)).toBe(false);
  });
});