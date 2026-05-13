import { describe, expect, it } from 'vitest';

import { normalizePatchSecuritySourceStatus, shouldResetOpeningReportId, summarizePatchSecurityStatus } from './patchDashboardState';

describe('shouldResetOpeningReportId', () => {
  it('returns true when a report open button is still marked loading after the modal and reportId are both gone', () => {
    expect(shouldResetOpeningReportId('report-1', null, null)).toBe(true);
  });

  it('returns false while the matching modal is still open', () => {
    expect(shouldResetOpeningReportId('report-1', {
      id: 'report-1',
      scopeLabel: 'All departments',
      requestedAt: '2026-04-27T07:32:13.366Z',
      completedAt: '2026-04-27T07:33:13.460Z',
      successCount: 1,
      failedCount: 5,
      rows: [],
    }, null)).toBe(false);
  });

  it('returns false while the URL is still targeting a report to load', () => {
    expect(shouldResetOpeningReportId('report-1', null, 'report-1')).toBe(false);
  });

  it('returns false when no report action is currently marked loading', () => {
    expect(shouldResetOpeningReportId('', null, null)).toBe(false);
  });
});

describe('normalizePatchSecuritySourceStatus', () => {
  it('falls back to clean when the payload only reports an active source without errors', () => {
    expect(normalizePatchSecuritySourceStatus({ active: true })).toEqual({
      status: 'clean',
      active: true,
      openAlerts: 0,
    });
  });

  it('prioritizes error status when open alerts are present', () => {
    expect(normalizePatchSecuritySourceStatus({ active: true, openAlerts: 2 })).toEqual({
      status: 'error_found',
      active: true,
      openAlerts: 2,
    });
  });
});

describe('summarizePatchSecurityStatus', () => {
  it('counts active, clean, and error states per source', () => {
    expect(summarizePatchSecurityStatus([
      {
        securityStatus: {
          wazuh: { active: true, status: 'clean', openAlerts: 0 },
          openscap: { active: true, status: 'error_found', openAlerts: 1 },
          clamav: { active: false, status: 'inactive', openAlerts: 0 },
        },
      },
      {
        securityStatus: {
          wazuh: { active: true, status: 'error_found', openAlerts: 2 },
          openscap: { active: true, status: 'clean', openAlerts: 0 },
          clamav: { active: true, status: 'clean', openAlerts: 0 },
        },
      },
    ])).toEqual([
      { key: 'wazuh', label: 'Wazuh', activeCount: 2, errorCount: 1, cleanCount: 1 },
      { key: 'openscap', label: 'OpenSCAP', activeCount: 2, errorCount: 1, cleanCount: 1 },
      { key: 'clamav', label: 'ClamScan', activeCount: 1, errorCount: 0, cleanCount: 1 },
    ]);
  });
});