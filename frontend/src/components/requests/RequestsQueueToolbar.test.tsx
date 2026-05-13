import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestsQueueToolbar from './RequestsQueueToolbar';

describe('RequestsQueueToolbar', () => {
  it('renders search summary, counts, and filtered view state', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueToolbar
        searchQuery="portal"
        typeFilter="device_enrollment"
        statusFilter="pending"
        totalRequests={12}
        requestSummary={{ pending: 5, inProgress: 4, resolved: 3 }}
        typeCounts={{ all: 12, device_enrollment: 7, other: 5 }}
        activeTypeLabel="Enrollment reviews"
        activeStatusLabel="Pending"
        viewMode="table"
        unassignedCount={2}
        needsReviewCount={6}
        recentActivityCount={4}
        hasActiveFilters={true}
        onSearchChange={vi.fn()}
        onTypeFilterChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Search title, requester, assignee, request id');
    expect(markup).toContain('All request types 12');
    expect(markup).toContain('Enrollment reviews 7');
    expect(markup).toContain('Pending 5');
    expect(markup).toContain('Showing ');
    expect(markup).toContain('Enrollment reviews');
    expect(markup).toContain('Pending');
    expect(markup).toContain('portal');
    expect(markup).toContain('List View');
    expect(markup).toContain('Table View');
    expect(markup).toContain('>2<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('>6<');
    expect(markup).toContain('>1<');
    expect(markup).toContain('Custom filters are narrowing the queue.');
  });

  it('renders the default full-queue filter messaging', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueToolbar
        searchQuery=""
        typeFilter="all"
        statusFilter="all"
        totalRequests={0}
        requestSummary={{ pending: 0, inProgress: 0, resolved: 0 }}
        typeCounts={{ all: 0, device_enrollment: 0, other: 0 }}
        activeTypeLabel="All request types"
        activeStatusLabel="All"
        viewMode="list"
        unassignedCount={0}
        needsReviewCount={0}
        recentActivityCount={0}
        hasActiveFilters={false}
        onSearchChange={vi.fn()}
        onTypeFilterChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Viewing the full queue with default filters.');
  });
});