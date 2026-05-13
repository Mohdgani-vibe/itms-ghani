import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchRecentReportsPanel from './PatchRecentReportsPanel';

describe('PatchRecentReportsPanel', () => {
  it('renders report filters, summary, and actions for saved reports', () => {
    const markup = renderToStaticMarkup(
      <PatchRecentReportsPanel
        reportDepartmentFilter="Finance"
        reportDepartmentOptions={['all', 'Finance', 'IT Operations']}
        reportDateRange="30d"
        reportSearchQuery="wave"
        reportSort="most-failures"
        filteredReportCount={6}
        showAllReports={false}
        visibleRecentReports={[
          {
            id: 'report-1',
            scopeLabel: 'Finance patch wave',
            failedCount: 2,
            completedAt: '2026-05-08T10:00:00Z',
            successCount: 8,
            rowCount: 10,
            departments: ['Finance'],
            requestedBy: 'IT Owner',
          },
        ]}
        openingReportId=""
        downloadingReportId=""
        onReportDepartmentFilterChange={() => {}}
        onReportDateRangeChange={() => {}}
        onReportSearchQueryChange={() => {}}
        onReportSortChange={() => {}}
        onResetFilters={() => {}}
        onToggleShowAllReports={() => {}}
        onOpenReport={() => {}}
        onDownloadReport={() => {}}
      />,
    );

    expect(markup).toContain('Recent Reports');
    expect(markup).toContain('Saved patch runs');
    expect(markup).toContain('Last 30 days');
    expect(markup).toContain('Most failures');
    expect(markup).toContain('Search scope, department, requester');
    expect(markup).toContain('6 report(s) match the current filters.');
    expect(markup).toContain('Reset Filters');
    expect(markup).toContain('Show All (6)');
    expect(markup).toContain('Finance patch wave');
    expect(markup).toContain('2 failed');
    expect(markup).toContain('8/10 succeeded');
    expect(markup).toContain('Finance • IT Owner');
    expect(markup).toContain('Open report');
    expect(markup).toContain('Download CSV');
  });

  it('renders the empty saved-report state when no reports match', () => {
    const markup = renderToStaticMarkup(
      <PatchRecentReportsPanel
        reportDepartmentFilter="all"
        reportDepartmentOptions={['all']}
        reportDateRange="all"
        reportSearchQuery=""
        reportSort="newest"
        filteredReportCount={0}
        showAllReports={false}
        visibleRecentReports={[]}
        openingReportId=""
        downloadingReportId=""
        onReportDepartmentFilterChange={() => {}}
        onReportDateRangeChange={() => {}}
        onReportSearchQueryChange={() => {}}
        onReportSortChange={() => {}}
        onResetFilters={() => {}}
        onToggleShowAllReports={() => {}}
        onOpenReport={() => {}}
        onDownloadReport={() => {}}
      />,
    );

    expect(markup).toContain('No saved patch reports yet.');
  });
});