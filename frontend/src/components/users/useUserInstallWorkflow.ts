import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLinuxBootstrapCommand, buildLinuxSyncCommand, buildWindowsBootstrapCommand, buildWindowsSyncCommand, type InstallAgentConfig, type InstallOverrides } from './userInstallCommandUtils';
import type { UserRecord } from './userDirectoryUtils';

const LINUX_HARDINFO_PREFERENCE_KEY = 'itms_install_linux_hardinfo_fallback';
const INSTALL_PLACEHOLDERS = {
  assignedToName: '<EMPLOYEE_NAME>',
  assignedToEmail: '<EMPLOYEE_EMAIL>',
  employeeCode: '<EMPLOYEE_ID>',
  departmentName: '<DEPARTMENT>',
} as const;

type CopyStatus = 'ubuntu' | 'debian' | 'fedora' | 'centos' | 'redhat' | 'windows' | 'linux-sync' | 'windows-sync' | '';

interface UseUserInstallWorkflowOptions {
  selectedUser: UserRecord | null;
  installConfig: InstallAgentConfig | null;
  setError: (value: string) => void;
  setSuccessMessage: (value: string) => void;
}

interface InstallFormState {
  userId: string;
  assignedToName: string;
  assignedToEmail: string;
  employeeCode: string;
  departmentName: string;
}

export function useUserInstallWorkflow({
  selectedUser,
  installConfig,
  setError,
  setSuccessMessage,
}: UseUserInstallWorkflowOptions) {
  const selectedUserId = selectedUser?.id || '';
  const selectedUserDefaults = useMemo<InstallFormState>(() => ({
    userId: selectedUserId,
    assignedToName: selectedUser?.fullName || '',
    assignedToEmail: selectedUser?.email || '',
    employeeCode: selectedUser?.employeeCode || '',
    departmentName: selectedUser?.department?.name || selectedUser?.branch?.name || '',
  }), [selectedUser?.branch?.name, selectedUser?.department?.name, selectedUser?.email, selectedUser?.employeeCode, selectedUser?.fullName, selectedUserId]);
  const [installFormState, setInstallFormState] = useState<InstallFormState>(selectedUserDefaults);
  const [includeLinuxHardinfoFallback, setIncludeLinuxHardinfoFallback] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.localStorage.getItem(LINUX_HARDINFO_PREFERENCE_KEY) !== 'false';
  });
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('');
  const copyStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LINUX_HARDINFO_PREFERENCE_KEY, includeLinuxHardinfoFallback ? 'true' : 'false');
  }, [includeLinuxHardinfoFallback]);

  const activeInstallForm = installFormState.userId === selectedUserId ? installFormState : selectedUserDefaults;
  const installAssignedToName = activeInstallForm.assignedToName;
  const installAssignedToEmail = activeInstallForm.assignedToEmail;
  const installEmployeeCode = activeInstallForm.employeeCode;
  const installDepartmentName = activeInstallForm.departmentName;

  const updateInstallForm = useCallback((updates: Partial<Omit<InstallFormState, 'userId'>>) => {
    setInstallFormState((current) => ({
      ...(current.userId === selectedUserId ? current : selectedUserDefaults),
      userId: selectedUserId,
      ...updates,
    }));
  }, [selectedUserDefaults, selectedUserId]);

  const setInstallAssignedToName = useCallback((value: string) => {
    updateInstallForm({ assignedToName: value });
  }, [updateInstallForm]);

  const setInstallAssignedToEmail = useCallback((value: string) => {
    updateInstallForm({ assignedToEmail: value });
  }, [updateInstallForm]);

  const setInstallEmployeeCode = useCallback((value: string) => {
    updateInstallForm({ employeeCode: value });
  }, [updateInstallForm]);

  const setInstallDepartmentName = useCallback((value: string) => {
    updateInstallForm({ departmentName: value });
  }, [updateInstallForm]);

  const installOverrides = useMemo<InstallOverrides>(() => ({
    assignedToName: installAssignedToName.trim() || INSTALL_PLACEHOLDERS.assignedToName,
    assignedToEmail: installAssignedToEmail.trim() || INSTALL_PLACEHOLDERS.assignedToEmail,
    employeeCode: installEmployeeCode.trim() || INSTALL_PLACEHOLDERS.employeeCode,
    departmentName: installDepartmentName.trim() || INSTALL_PLACEHOLDERS.departmentName,
    includeHardinfoFallback: includeLinuxHardinfoFallback,
  }), [includeLinuxHardinfoFallback, installAssignedToEmail, installAssignedToName, installDepartmentName, installEmployeeCode]);

  const installEmailValid = useMemo(
    () => /.+@zerodha\.com$/i.test(installAssignedToEmail.trim()),
    [installAssignedToEmail],
  );

  const installFieldsComplete = useMemo(() => (
    installAssignedToName.trim().length > 0
      && installEmailValid
      && installEmployeeCode.trim().length > 0
      && installDepartmentName.trim().length > 0
  ), [installAssignedToName, installDepartmentName, installEmailValid, installEmployeeCode]);

  const linuxInstallCommand = useMemo(
    () => buildLinuxBootstrapCommand(installConfig, selectedUser, installOverrides),
    [installConfig, installOverrides, selectedUser],
  );

  const windowsInstallCommand = useMemo(
    () => buildWindowsBootstrapCommand(installConfig, selectedUser, installOverrides),
    [installConfig, installOverrides, selectedUser],
  );

  const linuxSyncCommand = useMemo(
    () => buildLinuxSyncCommand(installConfig, selectedUser, includeLinuxHardinfoFallback),
    [includeLinuxHardinfoFallback, installConfig, selectedUser],
  );

  const windowsSyncCommand = useMemo(
    () => buildWindowsSyncCommand(installConfig, selectedUser),
    [installConfig, selectedUser],
  );

  const handleCopyCommand = useCallback(async (kind: Exclude<CopyStatus, ''>, command: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = command;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyStatus(kind);
      const copyLabelMap: Record<Exclude<CopyStatus, ''>, string> = {
        ubuntu: 'Ubuntu install',
        debian: 'Debian install',
        fedora: 'Fedora install status',
        centos: 'CentOS install status',
        redhat: 'Red Hat install status',
        windows: 'Windows install',
        'linux-sync': 'Linux sync',
        'windows-sync': 'Windows sync',
      };
      setSuccessMessage(`${copyLabelMap[kind]} copied.`);
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current);
      }
      copyStatusTimeoutRef.current = window.setTimeout(() => setCopyStatus((current) => (current === kind ? '' : current)), 1500);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy command');
    }
  }, [setError, setSuccessMessage]);

  return {
    installAssignedToName,
    installAssignedToEmail,
    installEmployeeCode,
    installDepartmentName,
    includeLinuxHardinfoFallback,
    copyStatus,
    installEmailValid,
    installFieldsComplete,
    linuxInstallCommand,
    linuxSyncCommand,
    windowsInstallCommand,
    windowsSyncCommand,
    setInstallAssignedToName,
    setInstallAssignedToEmail,
    setInstallEmployeeCode,
    setInstallDepartmentName,
    setIncludeLinuxHardinfoFallback,
    handleCopyCommand,
  };
}