import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserAccessToolbar from './UserAccessToolbar';

describe('UserAccessToolbar', () => {
  it('renders filters, status chips, and enabled bulk actions', () => {
    const markup = renderToStaticMarkup(
      <UserAccessToolbar
        userRoleFilter="employee"
        userEntityFilter="entity-1"
        userBranchFilter="branch-1"
        userStatusFilter="active"
        availableRoleOptions={[{ id: 'role-1', name: 'employee' }]}
        activeEntityOptions={[{ id: 'entity-1', short_code: 'ZPL', full_name: 'Zerodha Pvt Ltd' }]}
        branchOptions={[{ id: 'branch-1', name: 'HQ' }]}
        allVisibleBulkUsersSelected={true}
        bulkSelectableUsersCount={4}
        selectedBulkUsersCount={2}
        formatRoleNameLabel={(value) => value === 'employee' ? 'Employee' : value}
        onUserRoleFilterChange={vi.fn()}
        onUserEntityFilterChange={vi.fn()}
        onUserBranchFilterChange={vi.fn()}
        onUserStatusFilterChange={vi.fn()}
        onToggleSelectAllVisibleUsers={vi.fn()}
        onDeactivateSelected={vi.fn()}
        onReactivateSelected={vi.fn()}
      />,
    );

    expect(markup).toContain('All roles');
    expect(markup).toContain('Employee');
    expect(markup).toContain('Zerodha Pvt Ltd (ZPL)');
    expect(markup).toContain('HQ');
    expect(markup).toContain('All Users');
    expect(markup).toContain('Active Users');
    expect(markup).toContain('Inactive Users');
    expect(markup).toContain('Select all users on this page');
    expect(markup).toContain('Deactivate Selected');
    expect(markup).toContain('Reactivate Selected');
    expect(markup).toContain('checked=""');
  });

  it('disables bulk actions when there is no selectable user', () => {
    const markup = renderToStaticMarkup(
      <UserAccessToolbar
        userRoleFilter="all"
        userEntityFilter="all"
        userBranchFilter="all"
        userStatusFilter="all"
        availableRoleOptions={[]}
        activeEntityOptions={[]}
        branchOptions={[]}
        allVisibleBulkUsersSelected={false}
        bulkSelectableUsersCount={0}
        selectedBulkUsersCount={0}
        formatRoleNameLabel={(value) => value}
        onUserRoleFilterChange={vi.fn()}
        onUserEntityFilterChange={vi.fn()}
        onUserBranchFilterChange={vi.fn()}
        onUserStatusFilterChange={vi.fn()}
        onToggleSelectAllVisibleUsers={vi.fn()}
        onDeactivateSelected={vi.fn()}
        onReactivateSelected={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
  });
});