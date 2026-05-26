export function deviceLifecycleActionsReadOnly(canOperate: boolean, deviceStatus?: string | null) {
  return !canOperate || (deviceStatus || '').trim().toLowerCase() === 'retired';
}
