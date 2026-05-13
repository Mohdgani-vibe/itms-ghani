import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserEditorDialog from './UserEditorDialog';

describe('UserEditorDialog', () => {
  it('renders the edit mode form and save action', () => {
    const markup = renderToStaticMarkup(
      <UserEditorDialog
        editingUser={{
          id: 'user-1',
          fullName: 'Chris Employee',
          email: 'chris@example.com',
          employeeCode: 'EMP-101',
          entityId: 'entity-1',
          departmentId: 'dept-1',
          branchId: 'branch-1',
          role: 'employee',
          status: 'active',
          nextPassword: '',
        }}
        userEditorMode="edit"
        savingEditedUser={false}
        availableRoleOptions={[{ id: 'role-1', name: 'employee' }]}
        activeEntityOptions={[{ id: 'entity-1', short_code: 'ZPL', full_name: 'Zerodha Pvt Ltd' }]}
        departmentOptions={[{ id: 'dept-1', name: 'IT' }]}
        branchOptions={[{ id: 'branch-1', name: 'HQ' }]}
        formatRoleNameLabel={(value) => value === 'employee' ? 'Employee' : value}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onFieldChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Edit User');
    expect(markup).toContain('Update the user record directly from the Users page.');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('chris@example.com');
    expect(markup).toContain('EMP-101');
    expect(markup).toContain('Employee');
    expect(markup).toContain('Zerodha Pvt Ltd (ZPL)');
    expect(markup).toContain('IT');
    expect(markup).toContain('HQ');
    expect(markup).toContain('Password Reset');
    expect(markup).toContain('Save User');
  });

  it('renders reset-password mode and disables save without a new password', () => {
    const markup = renderToStaticMarkup(
      <UserEditorDialog
        editingUser={{
          id: 'user-1',
          fullName: 'Chris Employee',
          email: 'chris@example.com',
          employeeCode: '',
          entityId: '',
          departmentId: '',
          branchId: '',
          role: 'employee',
          status: 'active',
          nextPassword: '',
        }}
        userEditorMode="reset-password"
        savingEditedUser={false}
        availableRoleOptions={[]}
        activeEntityOptions={[]}
        departmentOptions={[]}
        branchOptions={[]}
        formatRoleNameLabel={(value) => value}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onFieldChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Reset Password');
    expect(markup).toContain('Set a new temporary password for this user without leaving the directory.');
    expect(markup).toContain('Not set');
    expect(markup).toContain('Enter a new temporary password');
    expect(markup).toContain('disabled=""');
  });

  it('renders nothing without an editing user', () => {
    const markup = renderToStaticMarkup(
      <UserEditorDialog
        editingUser={null}
        userEditorMode="edit"
        savingEditedUser={false}
        availableRoleOptions={[]}
        activeEntityOptions={[]}
        departmentOptions={[]}
        branchOptions={[]}
        formatRoleNameLabel={(value) => value}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onFieldChange={vi.fn()}
      />,
    );

    expect(markup).toBe('');
  });
});