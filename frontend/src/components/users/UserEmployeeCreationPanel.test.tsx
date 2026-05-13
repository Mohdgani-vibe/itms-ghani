import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserEmployeeCreationPanel from './UserEmployeeCreationPanel';

describe('UserEmployeeCreationPanel', () => {
  it('renders employee creation fields, entity summary, and active submit action', () => {
    const markup = renderToStaticMarkup(
      <UserEmployeeCreationPanel
        defaultEntityId="entity-1"
        defaultEntityLabel="Zerodha Pvt Ltd"
        creatingEmployee={false}
        activeEntityOptions={[{ id: 'entity-1', short_code: 'ZPL', full_name: 'Zerodha Pvt Ltd' }]}
        availableRoleOptions={[{ id: 'role-1', name: 'employee' }]}
        departmentOptions={[{ id: 'dept-1', name: 'IT' }]}
        branchOptions={[{ id: 'branch-1', name: 'HQ' }]}
        employeeForm={{
          fullName: 'Chris Employee',
          email: 'chris@example.com',
          employeeCode: 'EMP-101',
          departmentId: 'dept-1',
          branchId: 'branch-1',
          role: 'employee',
          initialPassword: 'TempPass123!',
        }}
        formatRoleNameLabel={(value) => value === 'employee' ? 'Employee' : value}
        onSubmit={vi.fn()}
        onSelectedEmployeeEntityChange={vi.fn()}
        onEmployeeFormFieldChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Add Employee');
    expect(markup).toContain('Create a new employee account');
    expect(markup).toContain('Zerodha Pvt Ltd (ZPL)');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('employee@zerodha.com');
    expect(markup).toContain('EMP-101');
    expect(markup).toContain('Employee');
    expect(markup).toContain('IT');
    expect(markup).toContain('HQ');
    expect(markup).toContain('Create Employee');
    expect(markup).toContain('Zerodha Pvt Ltd');
    expect(markup).toContain('Choose the target entity before creating the employee.');
  });

  it('renders disabled submit and fallback entity text when creating or no entity is selected', () => {
    const markup = renderToStaticMarkup(
      <UserEmployeeCreationPanel
        defaultEntityId=""
        defaultEntityLabel=""
        creatingEmployee={true}
        activeEntityOptions={[]}
        availableRoleOptions={[]}
        departmentOptions={[]}
        branchOptions={[]}
        employeeForm={{
          fullName: '',
          email: '',
          employeeCode: '',
          departmentId: '',
          branchId: '',
          role: '',
          initialPassword: '',
        }}
        formatRoleNameLabel={(value) => value}
        onSubmit={vi.fn()}
        onSelectedEmployeeEntityChange={vi.fn()}
        onEmployeeFormFieldChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Creating...');
    expect(markup).toContain('No entity available yet');
    expect(markup).toContain('disabled=""');
  });
});