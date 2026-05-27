import { sshTerminalActionsReadOnly } from './sshTerminalActions';

const SSH_TERMINAL_MISSING_TARGET_REASON = 'SSH target is missing.';
const SSH_TERMINAL_RETIRED_REASON = 'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.';

export function getSshBlockedReason(id: string, status?: string | null) {
  if (!id) {
    return SSH_TERMINAL_MISSING_TARGET_REASON;
  }
  if (sshTerminalActionsReadOnly(status)) {
    return SSH_TERMINAL_RETIRED_REASON;
  }
  return '';
}

export function shouldRecordSshTerminalSession(
  embedded: boolean,
  id: string,
  blockedReason: string,
  statusLoading: boolean,
  recordedAssetId: string,
) {
  return !(embedded || !id || blockedReason || statusLoading || recordedAssetId === id);
}