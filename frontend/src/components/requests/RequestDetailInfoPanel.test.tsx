import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestDetailInfoPanel from './RequestDetailInfoPanel';

describe('RequestDetailInfoPanel', () => {
  it('renders requester and assignee as openable actions when allowed', () => {
    const markup = renderToStaticMarkup(
      <RequestDetailInfoPanel
        requesterName="Chris Employee"
        assigneeName="Ava Admin"
        createdAtLabel="07 May 2026"
        updatedAtLabel="08 May 2026"
        canOpenRequester={true}
        canOpenAssignee={true}
        onOpenRequester={vi.fn()}
        onOpenAssignee={vi.fn()}
      />,
    );

    expect(markup).toContain('Requester');
    expect(markup).toContain('Assignee');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Created');
    expect(markup).toContain('07 May 2026');
    expect(markup).toContain('Updated 08 May 2026');
    expect(markup).toContain('text-sky-700');
  });

  it('renders static names when profile links are unavailable', () => {
    const markup = renderToStaticMarkup(
      <RequestDetailInfoPanel
        requesterName="Chris Employee"
        assigneeName="Unassigned"
        createdAtLabel="07 May 2026"
        updatedAtLabel="08 May 2026"
        canOpenRequester={false}
        canOpenAssignee={false}
        onOpenRequester={vi.fn()}
        onOpenAssignee={vi.fn()}
      />,
    );

    expect(markup).toContain('text-zinc-900');
    expect(markup).toContain('Unassigned');
  });
});