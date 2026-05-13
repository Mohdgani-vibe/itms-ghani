import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserDirectoryFiltersPanel from './UserDirectoryFiltersPanel';

describe('UserDirectoryFiltersPanel', () => {
  it('renders search, role/entity/branch/system filters, and status chips', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryFiltersPanel
        searchQuery="chris"
        userRoleFilter="employee"
        userEntityFilter="entity-1"
        userBranchFilter="branch-1"
        userStatusFilter="active"
        userSystemAssignmentFilter="assigned"
        availableRoleOptions={[{ id: 'role-1', name: 'employee' }]}
        activeEntityOptions={[{ id: 'entity-1', full_name: 'Zerodha Pvt Ltd', short_code: 'ZPL' }]}
        branchOptions={[{ id: 'branch-1', name: 'HQ' }]}
        formatRoleNameLabel={(role) => role === 'employee' ? 'Employee' : role}
        onSearchQueryChange={vi.fn()}
        onUserRoleFilterChange={vi.fn()}
        onUserEntityFilterChange={vi.fn()}
        onUserBranchFilterChange={vi.fn()}
        onUserStatusFilterChange={vi.fn()}
        onUserSystemAssignmentFilterChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Search by employee name, employee ID, email, role, or department');
    expect(markup).toContain('Role');
    expect(markup).toContain('All roles');
    expect(markup).toContain('Employee');
    expect(markup).toContain('Entity');
    expect(markup).toContain('Zerodha Pvt Ltd (ZPL)');
    expect(markup).toContain('Branch');
    expect(markup).toContain('HQ');
    expect(markup).toContain('System');
    expect(markup).toContain('Assigned systems');
    expect(markup).toContain('All Users');
    expect(markup).toContain('Active Users');
    expect(markup).toContain('Inactive Users');
  });

  it('hides the system assignment filter when requested', () => {
    const markup = renderToStaticMarkup(
      <UserDirectoryFiltersPanel
        searchQuery=""
        userRoleFilter="all"
        userEntityFilter="all"
        userBranchFilter="all"
        userStatusFilter="all"
        userSystemAssignmentFilter="all"
        hideUserSystemAssignmentFilter={true}
        availableRoleOptions={[]}
        activeEntityOptions={[]}
        branchOptions={[]}
        formatRoleNameLabel={(role) => role}
        onSearchQueryChange={vi.fn()}
        onUserRoleFilterChange={vi.fn()}
        onUserEntityFilterChange={vi.fn()}
        onUserBranchFilterChange={vi.fn()}
        onUserStatusFilterChange={vi.fn()}
        onUserSystemAssignmentFilterChange={vi.fn()}
      />,
    );

    expect(markup).not.toContain('Assigned systems');
    expect(markup).not.toContain('Unassigned systems');
  });
});