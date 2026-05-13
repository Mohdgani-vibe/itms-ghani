export function terminalConsoleActionsReadOnly(deviceStatus?: string | null) {
  return (deviceStatus || '').trim().toLowerCase() === 'retired';
}