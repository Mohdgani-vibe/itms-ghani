import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import MyAssetsPage from './MyAssetsPage';

describe('MyAssetsPage', () => {
  it('renders the employee assets workspace hero and overview shell', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/assets']}>
        <MyAssetsPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Employee Workspace');
    expect(markup).toContain('My Assets');
    expect(markup).toContain('Total Assets');
    expect(markup).toContain('Warranty Watch');
    expect(markup).toContain('Overview');
    expect(markup).toContain('Assigned Devices');
    expect(markup).toContain('Inventory Items');
  });
});