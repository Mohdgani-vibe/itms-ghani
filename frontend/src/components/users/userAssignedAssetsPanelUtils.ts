export function userAssignedDeviceActionsReadOnly(readOnly: boolean, userStatus?: string | null, deviceStatus?: string | null) {
  return readOnly || userStatus === 'inactive' || (deviceStatus || '').trim().toLowerCase() === 'retired';
}

export function userAssignedInventoryActionsReadOnly(readOnly: boolean, userStatus?: string | null, itemStatus?: string | null) {
  return readOnly || userStatus === 'inactive' || (itemStatus || '').trim().toLowerCase() !== 'allocated';
}

export function inventoryReadOnlyMessage(itemStatus?: string | null) {
  const normalized = (itemStatus || '').trim().toLowerCase();
  if (normalized === 'retired') {
    return 'This inventory item is retired. Asset actions are read-only until the item returns to an allocated state.';
  }
  if (normalized === 'returned' || normalized === 'inventory') {
    return 'This inventory item is no longer allocated to this user. Asset actions are read-only until the item is allocated again.';
  }
  return 'This inventory item is read-only until the item is allocated to this user.';
}
