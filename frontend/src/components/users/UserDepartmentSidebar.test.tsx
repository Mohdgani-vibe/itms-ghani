import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserDepartmentSidebar from './UserDepartmentSidebar';

describe('UserDepartmentSidebar', () => {
  it('renders the all-departments summary and per-team counts', () => {
    const markup = renderToStaticMarkup(
      <UserDepartmentSidebar
        departmentFilter="IT"
        directoryTotal={12}
        departmentCounts={[
          { name: 'IT', count: 4 },
          { name: 'Finance', count: 3 },
        ]}
        onDepartmentFilterChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Departments');
    expect(markup).toContain('Filter users by department and review count per team.');
    expect(markup).toContain('All Departments');
    expect(markup).toContain('>12<');
    expect(markup).toContain('IT');
    expect(markup).toContain('>4<');
    expect(markup).toContain('Finance');
    expect(markup).toContain('>3<');
  });
});