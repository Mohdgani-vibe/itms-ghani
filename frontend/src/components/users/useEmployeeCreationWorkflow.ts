import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

interface EntityOptionLike {
  id: string;
  full_name: string;
}

interface SelectedUserLike {
  entityId?: string | null;
}

export interface EmployeeFormState {
  fullName: string;
  email: string;
  employeeCode: string;
  departmentId: string;
  branchId: string;
  role: string;
  initialPassword: string;
}

interface UseEmployeeCreationWorkflowOptions {
  activeEntityOptions: EntityOptionLike[];
  selectedUser?: SelectedUserLike | null;
  triggerUsersReload: () => void;
  setDirectoryPage: (value: number) => void;
  setActiveTab: (value: 'directory') => void;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
}

const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  fullName: '',
  email: '',
  employeeCode: '',
  departmentId: '',
  branchId: '',
  role: 'employee',
  initialPassword: '',
};

export function useEmployeeCreationWorkflow({
  activeEntityOptions,
  selectedUser,
  triggerUsersReload,
  setDirectoryPage,
  setActiveTab,
  setError,
  setSuccessMessage,
}: UseEmployeeCreationWorkflowOptions) {
  const [selectedEmployeeEntityId, setSelectedEmployeeEntityId] = useState('');
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM);

  const defaultEntityId = selectedEmployeeEntityId || selectedUser?.entityId || activeEntityOptions[0]?.id || '';
  const defaultEntityLabel = useMemo(
    () => activeEntityOptions.find((entity) => entity.id === defaultEntityId)?.full_name || defaultEntityId,
    [activeEntityOptions, defaultEntityId],
  );

  useEffect(() => {
    if (!activeEntityOptions.length) {
      setSelectedEmployeeEntityId('');
      return;
    }

    setSelectedEmployeeEntityId((current) => {
      if (current && activeEntityOptions.some((entity) => entity.id === current)) {
        return current;
      }
      if (selectedUser?.entityId && activeEntityOptions.some((entity) => entity.id === selectedUser.entityId)) {
        return selectedUser.entityId;
      }
      return activeEntityOptions[0]?.id || '';
    });
  }, [activeEntityOptions, selectedUser]);

  const updateEmployeeFormField = useCallback((field: keyof EmployeeFormState, value: string) => {
    setEmployeeForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleCreateEmployee = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!defaultEntityId) {
      setError('No entity is available yet. Create an entity first or select an active entity.');
      return;
    }

    try {
      setCreatingEmployee(true);
      setError('');
      setSuccessMessage('');
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: employeeForm.fullName.trim(),
          email: employeeForm.email.trim(),
          emp_id: employeeForm.employeeCode.trim(),
          entity_id: defaultEntityId,
          dept_id: employeeForm.departmentId,
          location_id: employeeForm.branchId,
          role: employeeForm.role,
          initial_password: employeeForm.initialPassword,
          is_active: true,
        }),
      });
      setEmployeeForm(EMPTY_EMPLOYEE_FORM);
      setSuccessMessage('Employee created successfully.');
      setDirectoryPage(1);
      setActiveTab('directory');
      triggerUsersReload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create employee');
    } finally {
      setCreatingEmployee(false);
    }
  }, [defaultEntityId, employeeForm, setActiveTab, setDirectoryPage, setError, setSuccessMessage, triggerUsersReload]);

  return {
    selectedEmployeeEntityId,
    setSelectedEmployeeEntityId,
    creatingEmployee,
    employeeForm,
    defaultEntityId,
    defaultEntityLabel,
    updateEmployeeFormField,
    handleCreateEmployee,
  };
}