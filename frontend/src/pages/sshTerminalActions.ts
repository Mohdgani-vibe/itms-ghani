export function sshTerminalActionsReadOnly(deviceStatus?: string | null) {
  return (deviceStatus || '').trim().toLowerCase() === 'retired';
}