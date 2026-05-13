import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserAccessCard from './UserAccessCard';

describe('UserAccessCard', () => {
  it('renders selected portals, portal choices, and save controls', () => {
    const markup = renderToStaticMarkup(
      <UserAccessCard
        user={{
          id: 'user-1',
          fullName: 'Chris Employee',
          employeeCode: 'EMP-101',
          email: 'chris@example.com',
          role: { name: 'employee' },
          department: { name: 'IT' },
        }}
        selectedPortals={['employee', 'inventory']}
        selectedForBulk={true}
        isCurrentSessionUser={false}
        isLockedUser={false}
        isSaving={false}
        saveDisabled={false}
        portalChoices={[
          { id: 'employee', label: 'Employee' },
          { id: 'inventory', label: 'Inventory' },
        ]}
        formatPortalLabel={(id) => id === 'employee' ? 'Employee' : 'Inventory'}
        onToggleBulkSelection={vi.fn()}
        onPortalToggle={vi.fn()}
        onSaveAccess={vi.fn()}
      />,
    );

    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('EMP-101 • chris@example.com');
    expect(markup).toContain('IT');
    expect(markup).toContain('Portal Access');
    expect(markup).toContain('Employee');
    expect(markup).toContain('Inventory');
    expect(markup).toContain('Select Portals');
    expect(markup).toContain('Save Access');
    expect(markup).toContain('Choose one or more portals, then save.');
    expect(markup).toContain('checked=""');
  });

  it('renders locked-user guidance and saving state', () => {
    const markup = renderToStaticMarkup(
      <UserAccessCard
        user={{
          id: 'user-2',
          fullName: 'Taylor Admin',
          employeeCode: 'EMP-202',
          email: 'taylor@example.com',
          role: { name: 'super_admin' },
          department: null,
        }}
        selectedPortals={['super_admin']}
        selectedForBulk={false}
        isCurrentSessionUser={true}
        isLockedUser={true}
        isSaving={true}
        saveDisabled={true}
        portalChoices={[{ id: 'super_admin', label: 'Super Admin' }]}
        formatPortalLabel={() => 'Super Admin'}
        onToggleBulkSelection={vi.fn()}
        onPortalToggle={vi.fn()}
        onSaveAccess={vi.fn()}
      />,
    );

    expect(markup).toContain('Protected Role');
    expect(markup).toContain('Department');
    expect(markup).toContain('Saving access...');
    expect(markup).toContain('Your own super admin access is kept read-only here');
    expect(markup).toContain('disabled=""');
  });
});