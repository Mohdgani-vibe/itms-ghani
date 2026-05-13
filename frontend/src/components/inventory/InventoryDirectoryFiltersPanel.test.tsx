import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryDirectoryFiltersPanel from './InventoryDirectoryFiltersPanel';

describe('InventoryDirectoryFiltersPanel', () => {
  it('renders search and department filter options', () => {
    const markup = renderToStaticMarkup(
      <InventoryDirectoryFiltersPanel
        searchQuery="laptop"
        setSearchQuery={vi.fn()}
        departmentFilter="IT"
        setDepartmentFilter={vi.fn()}
        departments={[
          { name: 'IT', count: 4 },
          { name: 'Finance', count: 2 },
        ]}
      />,
    );

    expect(markup).toContain('Search inventory...');
    expect(markup).toContain('All Departments');
    expect(markup).toContain('IT (4)');
    expect(markup).toContain('Finance (2)');
  });
});