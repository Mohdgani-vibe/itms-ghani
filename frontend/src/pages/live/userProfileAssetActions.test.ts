import { describe, expect, it } from 'vitest';

import { userProfileAssetActionsReadOnly, userProfileAssignedAssetActionsReadOnly } from './userProfileAssetActions';

describe('userProfileAssetActionsReadOnly', () => {
  it('fails closed for inactive users even when the session can manage assets', () => {
    expect(userProfileAssetActionsReadOnly(true, 'inactive')).toBe(true);
  });

  it('allows asset actions only for active manageable profiles', () => {
    expect(userProfileAssetActionsReadOnly(true, 'active')).toBe(false);
  });
});

describe('userProfileAssignedAssetActionsReadOnly', () => {
  it('fails closed for retired devices and non-allocated inventory items', () => {
    expect(userProfileAssignedAssetActionsReadOnly(true, 'active', 'device', 'retired')).toBe(true);
    expect(userProfileAssignedAssetActionsReadOnly(true, 'active', 'inventory', 'returned')).toBe(true);
  });

  it('keeps active devices and allocated inventory items actionable', () => {
    expect(userProfileAssignedAssetActionsReadOnly(true, 'active', 'device', 'in_use')).toBe(false);
    expect(userProfileAssignedAssetActionsReadOnly(true, 'active', 'inventory', 'allocated')).toBe(false);
  });
});