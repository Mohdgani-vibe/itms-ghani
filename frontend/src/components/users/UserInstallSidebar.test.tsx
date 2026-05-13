import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserInstallSidebar from './UserInstallSidebar';

describe('UserInstallSidebar', () => {
  it('renders filters, user list, and pagination', () => {
    const markup = renderToStaticMarkup(
      <UserInstallSidebar
        searchQuery="chris"
        userRoleFilter="employee"
        userEntityFilter="entity-1"
        userBranchFilter="branch-1"
        userStatusFilter="active"
        availableRoleOptions={[{ id: 'role-1', name: 'employee' }]}
        activeEntityOptions={[{ id: 'entity-1', short_code: 'ZPL', full_name: 'Zerodha Pvt Ltd' }]}
        branchOptions={[{ id: 'branch-1', name: 'HQ' }]}
        installUsers={[{ id: 'user-1', fullName: 'Chris Employee', employeeCode: 'EMP-101', email: 'chris@example.com' }]}
        selectedUserId="user-1"
        installPage={1}
        installTotal={12}
        pageSize={10}
        formatRoleNameLabel={(value) => value === 'employee' ? 'Employee' : value}
        onSearchQueryChange={vi.fn()}
        onUserRoleFilterChange={vi.fn()}
        onUserEntityFilterChange={vi.fn()}
        onUserBranchFilterChange={vi.fn()}
        onUserStatusFilterChange={vi.fn()}
        onSelectUser={vi.fn()}
        onInstallPageChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Select a user and run the full endpoint install from this single page.');
    expect(markup).toContain('Search user, employee ID, email, or department');
    expect(markup).toContain('Employee');
    expect(markup).toContain('Zerodha Pvt Ltd (ZPL)');
    expect(markup).toContain('HQ');
    expect(markup).toContain('All Users');
    expect(markup).toContain('Active Users');
    expect(markup).toContain('Inactive Users');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('EMP-101 • chris@example.com');
    expect(markup).toContain('users');
  });
});