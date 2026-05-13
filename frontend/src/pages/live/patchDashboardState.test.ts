import { describe, expect, it } from 'vitest';

import { shouldResetOpeningReportId } from './patchDashboardState';

describe('shouldResetOpeningReportId', () => {
  it('resets when an opening report id exists, no report is loaded, and no requested report id is present', () => {
    expect(shouldResetOpeningReportId('report-1', null, '')).toBe(true);
    expect(shouldResetOpeningReportId('report-1', null, '   ')).toBe(true);
  });

  it('does not reset when the report is loaded or an explicit requested report id exists', () => {
    expect(shouldResetOpeningReportId('report-1', { id: 'report-1' } as never, '')).toBe(false);
    expect(shouldResetOpeningReportId('report-1', null, 'report-2')).toBe(false);
    expect(shouldResetOpeningReportId('', null, '')).toBe(false);
  });
});