import { describe, expect, it } from 'vitest';

import { patchRunReportRowsForCsv, type PatchRunReport } from './patchReports';

describe('patchRunReportRowsForCsv', () => {
  const report: PatchRunReport = {
    scopeLabel: 'Engineering',
    requestedAt: '2026-04-27T12:00:00Z',
    completedAt: '2026-04-27T12:05:00Z',
    successCount: 2,
    failedCount: 1,
    rows: [
      {
        deviceId: 'device-1',
        hostname: 'eng-01',
        department: 'Engineering',
        status: 'success',
        patchStatus: 'completed',
        target: 'eng-01',
        action: 'system-update',
        message: 'openssl, curl',
        updatedItems: ['openssl', 'curl'],
        packageChanges: [],
      },
      {
        deviceId: 'device-2',
        hostname: 'eng-02',
        department: 'Engineering',
        status: 'success',
        patchStatus: 'completed',
        target: 'eng-02',
        action: 'system-update',
        message: 'No packages required updates',
        updatedItems: [],
        packageChanges: [],
      },
      {
        deviceId: 'device-3',
        hostname: 'eng-03',
        department: 'Engineering',
        status: 'failed',
        patchStatus: 'failed',
        target: 'eng-03',
        action: 'system-update',
        message: 'Salt timeout',
        updatedItems: [],
        packageChanges: [],
      },
    ],
  };

  it('returns all rows for full CSV mode', () => {
    expect(patchRunReportRowsForCsv(report)).toHaveLength(3);
  });

  it('returns only rows with updated packages for updated CSV mode', () => {
    expect(patchRunReportRowsForCsv(report, 'updated').map((row) => row.deviceId)).toEqual(['device-1']);
  });
});