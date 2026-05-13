import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import MyRequestsPage from './MyRequestsPage';

describe('MyRequestsPage', () => {
  it('renders the employee requests workspace shell', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/emp/requests']}>
        <MyRequestsPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Employee Workspace');
    expect(markup).toContain('My Requests');
    expect(markup).toContain('Create A Request');
    expect(markup).toContain('Request Type');
    expect(markup).toContain('Request History');
    expect(markup).toContain('Loading requests...');
  });
});