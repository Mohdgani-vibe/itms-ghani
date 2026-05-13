import { describe, expect, it } from 'vitest';

import { isGatepassPending } from './gatepassStatus';

describe('isGatepassPending', () => {
  it('keeps approved records pending until upload and signoff are complete', () => {
    expect(isGatepassPending({
      status: 'approved',
      receiverSignedAt: '2026-05-03T10:00:00Z',
      securitySignedAt: '2026-05-03T10:15:00Z',
      hasReceiverSignedUpload: false,
    })).toBe(true);
  });

  it('treats completed records as archived even without a receiver upload file', () => {
    expect(isGatepassPending({
      status: 'completed',
      receiverSignedAt: '2026-05-03T10:00:00Z',
      securitySignedAt: '2026-05-03T10:15:00Z',
      hasReceiverSignedUpload: false,
    })).toBe(false);
  });

  it('treats rejected records as archived', () => {
    expect(isGatepassPending({
      status: 'rejected',
      hasReceiverSignedUpload: false,
    })).toBe(false);
  });
});