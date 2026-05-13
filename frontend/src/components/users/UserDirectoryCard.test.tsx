import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserDirectoryCard from './UserDirectoryCard';

describe('UserDirectoryCard', () => {
  it('renders profile metadata, portal chips, and super-admin actions', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryCard
        user={{
          id: 'user-1',
          fullName: 'Chris Employee',
          email: 'chris@example.com',
          employeeCode: 'EMP-101',
          status: 'active',
          department: { name: 'IT' },
          branch: { name: 'HQ' },
          _count: { assets: 2 },
        }}
        active={true}
        isSuperAdmin={true}
        isCurrentSessionUser={false}
        selectedForBulk={true}
        accessSummary="Portal + Inventory"
        portalLabels={['Portal', 'Inventory']}
        userActionLoading={false}
        onSelect={vi.fn()}
        onToggleBulkSelection={vi.fn()}
        onOpenProfile={vi.fn()}
        onQuickEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onManageAccess={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );

    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('EMP-101');
    expect(markup).toContain('chris@example.com');
    expect(markup).toContain('Assets');
    expect(markup).toContain('>2<');
    expect(markup).toContain('Department');
    expect(markup).toContain('IT');
    expect(markup).toContain('Location');
    expect(markup).toContain('HQ');
    expect(markup).toContain('Access');
    expect(markup).toContain('Portal + Inventory');
    expect(markup).toContain('Portal');
    expect(markup).toContain('Inventory');
    expect(markup).toContain('Open profile');
    expect(markup).toContain('Quick Edit');
    expect(markup).toContain('Reset Password');
    expect(markup).toContain('Manage Access');
    expect(markup).toContain('Deactivate User');
    expect(markup).toContain('checked=""');
  });

  it('renders non-admin fallbacks and loading status action label', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryCard
        user={{
          id: 'user-2',
          fullName: 'Taylor Admin',
          email: 'taylor@example.com',
          employeeCode: 'EMP-202',
          status: 'inactive',
          department: null,
          branch: null,
          _count: { assets: 0 },
        }}
        active={false}
        isSuperAdmin={true}
        isCurrentSessionUser={true}
        selectedForBulk={false}
        accessSummary="No access"
        portalLabels={[]}
        userActionLoading={true}
        onSelect={vi.fn()}
        onToggleBulkSelection={vi.fn()}
        onOpenProfile={vi.fn()}
        onQuickEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onManageAccess={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );

    expect(markup).toContain('Unassigned');
    expect(markup).toContain('No access');
    expect(markup).toContain('Updating...');
    expect(markup).toContain('disabled=""');
  });
});