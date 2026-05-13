import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Pagination from './Pagination';

describe('Pagination', () => {
  it('renders item summary, page buttons, and edge links for multi-page results', () => {
    const markup = renderToStaticMarkup(
      <Pagination
        currentPage={5}
        totalItems={120}
        pageSize={10}
        onPageChange={vi.fn()}
        itemLabel="users"
      />,
    );

    expect(markup).toContain('Showing');
    expect(markup).toContain('>41<');
    expect(markup).toContain('>50<');
    expect(markup).toContain('>120<');
    expect(markup).toContain('users');
    expect(markup).toContain('Previous');
    expect(markup).toContain('Next');
    expect(markup).toContain('>1<');
    expect(markup).toContain('>3<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('>5<');
    expect(markup).toContain('>6<');
    expect(markup).toContain('>7<');
    expect(markup).toContain('>12<');
    expect(markup).toContain('...');
  });

  it('renders nothing when all items fit on one page', () => {
    const markup = renderToStaticMarkup(
      <Pagination
        currentPage={1}
        totalItems={10}
        pageSize={10}
        onPageChange={vi.fn()}
        itemLabel="users"
      />,
    );

    expect(markup).toBe('');
  });
});