import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UserDirectoryListPanel from './UserDirectoryListPanel';

describe('UserDirectoryListPanel', () => {
  it('renders loading state and pagination slot', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryListPanel
        loading={true}
        isEmpty={false}
        rows={<div>Directory rows</div>}
        pagination={<div>Page 1 of 4</div>}
      />,
    );

    expect(markup).toContain('Loading user directory...');
    expect(markup).toContain('Directory rows');
    expect(markup).toContain('Page 1 of 4');
  });

  it('renders the empty state when filters match no users', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryListPanel
        loading={false}
        isEmpty={true}
        rows={<div>Directory rows</div>}
        pagination={<div>Pagination</div>}
      />,
    );

    expect(markup).toContain('No users matched the current filters.');
  });
});