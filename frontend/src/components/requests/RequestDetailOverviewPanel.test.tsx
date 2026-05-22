import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RequestDetailOverviewPanel from './RequestDetailOverviewPanel';

describe('RequestDetailOverviewPanel', () => {
  it('renders request badges, summary text, and requester metadata', () => {
    const markup = renderToStaticMarkup(
      <RequestDetailOverviewPanel
        requestIdLabel="REQ-2048"
        typeLabel="Enrollment review"
        statusLabel="Pending"
        statusClassName="bg-amber-100 text-amber-700"
        freshnessLabel="Updated today"
        freshnessClassName="bg-emerald-100 text-emerald-700"
        commentsLabel="3 comments"
        title="Approve new laptop enrollment"
        description="Validate the asset metadata and confirm the employee assignment before provisioning." 
        requesterName="Chris Employee"
        assigneeName="Ava Admin"
        updatedAtLabel="08 May 2026, 10:30"
        createdAtLabel="07 May 2026, 15:00"
      />,
    );

    expect(markup).toContain('REQ-2048');
    expect(markup).toContain('Enrollment review');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Updated today');
    expect(markup).toContain('3 comments');
    expect(markup).toContain('Approve new laptop enrollment');
    expect(markup).toContain('Validate the asset metadata and confirm the employee assignment before provisioning.');
    expect(markup).toContain('Requester');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('Assignee');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Updated');
    expect(markup).toContain('08 May 2026, 10:30');
    expect(markup).toContain('Created 07 May 2026, 15:00');
  });
});