export function deviceAssignmentActionsReadOnly(canOperate: boolean, deviceStatus?: string | null, assignedUserStatus?: string | null) {
  return !canOperate || (deviceStatus || '').trim().toLowerCase() === 'retired' || assignedUserStatus === 'inactive';
}
