import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RequestsQueueHero from './RequestsQueueHero';

describe('RequestsQueueHero', () => {
  it('renders queue workspace summary metrics', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueHero
        totalRequests={48}
        pendingCount={12}
        inProgressCount={20}
        resolvedCount={16}
        pendingEnrollmentCount={5}
        enrollmentCount={9}
      />,
    );

    expect(markup).toContain('Queue Workspace');
    expect(markup).toContain('Requests');
    expect(markup).toContain('48');
    expect(markup).toContain('Pending');
    expect(markup).toContain('In Progress');
    expect(markup).toContain('5');
    expect(markup).toContain('/ 9 total');
  });
});