import { useCallback, useRef, useState } from 'react';
import { apiRequest, resolveApiUrl } from '../../lib/api';

export type CsvActionLoading = 'template' | 'minimal-template' | 'export' | '';

interface UseUsersCsvWorkflowOptions {
  token?: string;
  activeTab: string;
  searchQuery: string;
  departmentFilter: string;
  userRoleFilter: string;
  userStatusFilter: string;
  userEntityFilter: string;
  userBranchFilter: string;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
  setDirectoryPage: (value: number) => void;
  setInstallPage: (value: number) => void;
  setAccessPage: (value: number) => void;
  setSelectedUserId: (value: string) => void;
  setActiveTab: (value: 'directory') => void;
  triggerUsersReload: () => void;
}

export function useUsersCsvWorkflow({
  token,
  activeTab,
  searchQuery,
  departmentFilter,
  userRoleFilter,
  userStatusFilter,
  userEntityFilter,
  userBranchFilter,
  setError,
  setSuccessMessage,
  setDirectoryPage,
  setInstallPage,
  setAccessPage,
  setSelectedUserId,
  setActiveTab,
  triggerUsersReload,
}: UseUsersCsvWorkflowOptions) {
  const userImportInputRef = useRef<HTMLInputElement | null>(null);
  const [csvActionLoading, setCsvActionLoading] = useState<CsvActionLoading>('');
  const [importingUsers, setImportingUsers] = useState(false);

  const openImportPicker = useCallback(() => {
    userImportInputRef.current?.click();
  }, []);

  const handleDownloadUsersCsv = useCallback(async (kind: Exclude<CsvActionLoading, ''>) => {
    if (!token) {
      setError('Sign in again before downloading CSV files.');
      return;
    }

    try {
      setCsvActionLoading(kind);
      setError('');
      setSuccessMessage('');

      const exportPath = (() => {
        if (kind !== 'export') {
          return kind === 'template' ? '/api/users/import-template' : '/api/users/import-template-minimal';
        }

        const params = new URLSearchParams();
        const includeDirectoryScopedFilters = activeTab === 'directory' || activeTab === 'install';

        if (includeDirectoryScopedFilters && searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }
        if (includeDirectoryScopedFilters && departmentFilter !== 'all') {
          params.set('department_label', departmentFilter);
        }
        if (includeDirectoryScopedFilters) {
          params.set('exclude_role', 'super_admin');
        }
        if (userRoleFilter !== 'all') {
          params.append('role', userRoleFilter);
        }
        if (userStatusFilter !== 'all') {
          params.set('status', userStatusFilter);
        }
        if (userEntityFilter !== 'all') {
          params.set('entity', userEntityFilter);
        }
        if (userBranchFilter !== 'all') {
          params.set('location', userBranchFilter);
        }

        const query = params.toString();
        return query ? `/api/users/export?${query}` : '/api/users/export';
      })();

      const response = await fetch(resolveApiUrl(exportPath), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Failed to download ${kind === 'export' ? 'export' : 'template'} CSV`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] || (kind === 'template'
        ? 'user-import-template.csv'
        : kind === 'minimal-template'
          ? 'user-import-minimal-template.csv'
          : 'users-export.csv');
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setSuccessMessage(
        kind === 'export'
          ? 'Current filtered users exported to CSV.'
          : kind === 'minimal-template'
            ? 'Minimal user import template downloaded.'
            : 'Extended user import template downloaded.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to download CSV file');
    } finally {
      setCsvActionLoading('');
    }
  }, [activeTab, departmentFilter, searchQuery, setError, setSuccessMessage, token, userBranchFilter, userEntityFilter, userRoleFilter, userStatusFilter]);

  const handleImportUsers = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setImportingUsers(true);
      setError('');
      setSuccessMessage('');

      const formData = new FormData();
      formData.append('file', file);
      const result = await apiRequest<{ created: number; updated: number; errors?: Array<{ row: number; message: string }> }>('/api/users/import', {
        method: 'POST',
        body: formData,
      });

      setDirectoryPage(1);
      setInstallPage(1);
      setAccessPage(1);
      setSelectedUserId('');
      setActiveTab('directory');
      triggerUsersReload();

      const failures = result.errors || [];
      setSuccessMessage(`CSV processed: ${result.created} created, ${result.updated} updated.${failures.length ? ` ${failures.length} row(s) need attention.` : ''}`);
      if (failures.length) {
        setError(failures.slice(0, 3).map((entry) => `Row ${entry.row}: ${entry.message}`).join(' | '));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to import users CSV');
    } finally {
      setImportingUsers(false);
    }
  }, [setAccessPage, setActiveTab, setDirectoryPage, setError, setInstallPage, setSelectedUserId, setSuccessMessage, triggerUsersReload]);

  return {
    userImportInputRef,
    csvActionLoading,
    importingUsers,
    openImportPicker,
    handleDownloadUsersCsv,
    handleImportUsers,
  };
}