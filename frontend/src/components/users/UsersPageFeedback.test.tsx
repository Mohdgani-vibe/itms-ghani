import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UsersPageFeedback from './UsersPageFeedback';

describe('UsersPageFeedback', () => {
  it('renders error and success messages together when both are present', () => {
    const markup = renderToStaticMarkup(
      <UsersPageFeedback
        error="Directory sync failed"
        successMessage="Imported 12 users successfully"
      />,
    );

    expect(markup).toContain('Directory sync failed');
    expect(markup).toContain('Imported 12 users successfully');
  });

  it('renders nothing when there is no feedback', () => {
    const markup = renderToStaticMarkup(<UsersPageFeedback error="" successMessage="" />);

    expect(markup).toBe('');
  });
});