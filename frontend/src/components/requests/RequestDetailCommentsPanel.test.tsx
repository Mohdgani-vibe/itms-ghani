import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RequestDetailCommentsPanel from './RequestDetailCommentsPanel';

describe('RequestDetailCommentsPanel', () => {
  it('renders the empty comments state', () => {
    const markup = renderToStaticMarkup(<RequestDetailCommentsPanel comments={[]} />);

    expect(markup).toContain('No comments have been added to this request yet.');
  });

  it('renders each comment author and note', () => {
    const markup = renderToStaticMarkup(
      <RequestDetailCommentsPanel
        comments={[
          { id: 'comment-1', author: 'Ava Admin', note: 'Waiting for device ownership confirmation.' },
          { id: 'comment-2', author: 'Ian IT', note: 'Enrollment approved after serial number review.' },
        ]}
      />,
    );

    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Waiting for device ownership confirmation.');
    expect(markup).toContain('Ian IT');
    expect(markup).toContain('Enrollment approved after serial number review.');
  });
});