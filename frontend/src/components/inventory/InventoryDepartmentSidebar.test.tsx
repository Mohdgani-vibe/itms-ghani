import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import InventoryDepartmentSidebar from './InventoryDepartmentSidebar';

describe('InventoryDepartmentSidebar', () => {
  it('renders the all-branches total and per-branch counts', () => {
    const markup = renderToStaticMarkup(
      <InventoryDepartmentSidebar
        departments={[
          { name: 'HQ', count: 4 },
          { name: 'Branch South', count: 2 },
        ]}
        selected="HQ"
        onSelect={vi.fn()}
      />,
    );

    expect(markup).toContain('Branches');
    expect(markup).toContain('All (6)');
    expect(markup).toContain('HQ (4)');
    expect(markup).toContain('Branch South (2)');
  });
});