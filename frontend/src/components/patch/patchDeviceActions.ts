export function patchDeviceActionsReadOnly(deviceStatus?: string | null) {
  return (deviceStatus || '').trim().toLowerCase() === 'retired';
}

export const PATCH_DEVICE_READ_ONLY_REASON = 'Retired assets are read-only for patch and Salt console actions until they return to an active lifecycle state.';