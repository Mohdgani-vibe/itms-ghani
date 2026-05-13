export function userProfileAssetActionsReadOnly(canManageAssets: boolean, userStatus?: string | null) {
  return !canManageAssets || userStatus === 'inactive';
}

export function userProfileAssignedAssetActionsReadOnly(
  canManageAssets: boolean,
  userStatus?: string | null,
  assetKind?: 'device' | 'inventory',
  assetStatus?: string | null,
) {
  if (userProfileAssetActionsReadOnly(canManageAssets, userStatus)) {
    return true;
  }

  const normalizedStatus = (assetStatus || '').trim().toLowerCase();
  if (assetKind === 'device') {
    return normalizedStatus === 'retired';
  }
  if (assetKind === 'inventory') {
    return normalizedStatus !== 'allocated';
  }
  return false;
}

export function userProfileAssignedAssetReadOnlyMessage(assetKind: 'device' | 'inventory', assetStatus?: string | null) {
  const normalizedStatus = (assetStatus || '').trim().toLowerCase();
  if (assetKind === 'device') {
    return 'This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.';
  }
  if (normalizedStatus === 'retired') {
    return 'This inventory item is retired. Asset actions are read-only until the item returns to an allocated state.';
  }
  if (normalizedStatus === 'returned' || normalizedStatus === 'inventory') {
    return 'This inventory item is no longer allocated to this user. Asset actions are read-only until the item is allocated again.';
  }
  return 'This inventory item is read-only until the item is allocated to this user.';
}