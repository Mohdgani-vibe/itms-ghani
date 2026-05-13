import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestsQueueEmptyState from './RequestsQueueEmptyState';

describe('RequestsQueueEmptyState', () => {
  it('renders reset and dashboard actions when filters are active', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueEmptyState
        hasActiveFilters={true}
        onResetFilters={vi.fn()}
        onOpenDashboard={vi.fn()}
      />,
    );

    expect(markup).toContain('Queue Empty');
    expect(markup).toContain('No requests match this view');
    expect(markup).toContain('Reset the filters to return to the full queue.');
    expect(markup).toContain('Reset Filters');
    expect(markup).toContain('Open Dashboard');
  });

  it('renders the no-requests message without reset action', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueEmptyState
        hasActiveFilters={false}
        onResetFilters={vi.fn()}
        onOpenDashboard={vi.fn()}
      />,
    );

    expect(markup).toContain('There are no requests in the queue yet.');
    expect(markup).not.toContain('Reset Filters');
  });
});