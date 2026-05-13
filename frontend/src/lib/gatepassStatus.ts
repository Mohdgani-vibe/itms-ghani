export interface GatepassPendingRecord {
  status?: string;
  receiverSignedAt?: string;
  securitySignedAt?: string;
  hasReceiverSignedUpload?: boolean;
}

export function isGatepassPending(record: GatepassPendingRecord) {
  const normalized = (record.status || 'pending').toLowerCase();
  if (normalized === 'pending' || normalized === 'draft' || normalized === 'awaiting_approval' || normalized === 'in_progress') {
    return true;
  }

  if (normalized === 'approved') {
    return !record.receiverSignedAt || !record.securitySignedAt || !record.hasReceiverSignedUpload;
  }

  if (normalized === 'completed' || normalized === 'resolved' || normalized === 'rejected' || normalized === 'cancelled') {
    return false;
  }

  return !record.receiverSignedAt || !record.securitySignedAt || !record.hasReceiverSignedUpload;
}