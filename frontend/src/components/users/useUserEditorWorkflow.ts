import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import type { UserRecord } from './userDirectoryUtils';

export type UserEditorMode = 'edit' | 'reset-password';

export interface UserEditFormState {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  entityId: string;
  departmentId: string;
  branchId: string;
  role: string;
  status: 'active' | 'inactive';
  nextPassword: string;
}

interface UseUserEditorWorkflowOptions {
  activeTab: string;
  isSuperAdmin: boolean;
  triggerUsersReload: () => void;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
}

export function useUserEditorWorkflow({
  activeTab,
  isSuperAdmin,
  triggerUsersReload,
  setError,
  setSuccessMessage,
}: UseUserEditorWorkflowOptions) {
  const [editingUser, setEditingUser] = useState<UserEditFormState | null>(null);
  const [userEditorMode, setUserEditorMode] = useState<UserEditorMode>('edit');
  const [savingEditedUser, setSavingEditedUser] = useState(false);

  const closeUserEditor = useCallback(() => {
    setEditingUser(null);
    setUserEditorMode('edit');
  }, []);

  useEffect(() => {
    closeUserEditor();
  }, [activeTab, closeUserEditor]);

  const openUserEditor = useCallback((user: UserRecord, mode: UserEditorMode = 'edit') => {
    setEditingUser({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      employeeCode: user.employeeCode,
      entityId: user.entityId || '',
      departmentId: user.departmentId || '',
      branchId: user.branchId || '',
      role: user.role?.name || 'employee',
      status: user.status === 'inactive' ? 'inactive' : 'active',
      nextPassword: '',
    });
    setUserEditorMode(mode);
    setError('');
    setSuccessMessage('');
  }, [setError, setSuccessMessage]);

  const updateEditingUserField = useCallback((field: keyof UserEditFormState, value: string) => {
    setEditingUser((current) => current ? { ...current, [field]: value } : current);
  }, []);

  const handleSaveEditedUser = useCallback(async () => {
    if (!editingUser || !isSuperAdmin) {
      return;
    }

    if (userEditorMode === 'reset-password' && !editingUser.nextPassword.trim()) {
      setError('Enter a strong temporary password before saving the reset.');
      return;
    }

    try {
      setSavingEditedUser(true);
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: editingUser.fullName.trim(),
          email: editingUser.email.trim(),
          emp_id: editingUser.employeeCode.trim(),
          entity_id: editingUser.entityId,
          dept_id: editingUser.departmentId,
          location_id: editingUser.branchId,
          role: editingUser.role,
          is_active: editingUser.status === 'active',
          initial_password: editingUser.nextPassword.trim(),
        }),
      });
      closeUserEditor();
      triggerUsersReload();
      setSuccessMessage(
        editingUser.nextPassword.trim()
          ? 'User updated and password reset successfully.'
          : 'User updated successfully.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update user');
    } finally {
      setSavingEditedUser(false);
    }
  }, [closeUserEditor, editingUser, isSuperAdmin, setError, setSuccessMessage, triggerUsersReload, userEditorMode]);

  return {
    editingUser,
    userEditorMode,
    savingEditedUser,
    closeUserEditor,
    openUserEditor,
    updateEditingUserField,
    handleSaveEditedUser,
  };
}