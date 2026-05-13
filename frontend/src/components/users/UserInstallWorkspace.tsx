import { useMemo, useState } from 'react';

interface SelectedUserSummary {
  id: string;
  fullName: string;
  employeeCode: string;
}

interface InstallAgentConfig {
  publicServerUrl: string;
  inventoryIngestToken: string;
  saltApiBaseUrl?: string;
  saltApiConfigured: boolean;
  sshConfigured?: boolean;
  sshAuthMode?: string;
  wazuhApiConfigured: boolean;
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserInstallWorkspaceProps {
  selectedUser: SelectedUserSummary | null;
  installConfig: InstallAgentConfig | null;
  installConfigLoading: boolean;
  installAssignedToName: string;
  installAssignedToEmail: string;
  installEmployeeCode: string;
  installDepartmentName: string;
  mergedDepartmentOptions: LookupOption[];
  includeLinuxHardinfoFallback: boolean;
  installEmailValid: boolean;
  installFieldsComplete: boolean;
  linuxInstallCommand: string;
  linuxSyncCommand: string;
  windowsInstallCommand: string;
  windowsSyncCommand: string;
  copyStatus: 'ubuntu' | 'debian' | 'fedora' | 'centos' | 'redhat' | 'windows' | 'linux-sync' | 'windows-sync' | '';
  onInstallAssignedToNameChange: (value: string) => void;
  onInstallAssignedToEmailChange: (value: string) => void;
  onInstallEmployeeCodeChange: (value: string) => void;
  onInstallDepartmentNameChange: (value: string) => void;
  onIncludeLinuxHardinfoFallbackChange: (checked: boolean) => void;
  onCopyCommand: (kind: 'ubuntu' | 'debian' | 'fedora' | 'centos' | 'redhat' | 'windows' | 'linux-sync' | 'windows-sync', command: string) => void;
}

const RPM_INSTALLER_NOTICE = [
  '# RPM-based ITMS bootstrap is not configured in this deployment yet.',
  '# Supported direct Linux bootstrap today: Ubuntu and Debian.',
  '# Contact ITMS admin if you need Fedora, CentOS, or Red Hat onboarding enabled.',
].join('\n');

const LINUX_INSTALL_VARIANTS = [
  {
    key: 'ubuntu' as const,
    label: 'Ubuntu',
    title: 'Ubuntu install + first sync',
    description: 'APT-based Linux bootstrap for Ubuntu endpoints.',
    copyKind: 'ubuntu' as const,
    supported: true,
  },
  {
    key: 'debian' as const,
    label: 'Debian',
    title: 'Debian install + first sync',
    description: 'APT-based Linux bootstrap for Debian endpoints.',
    copyKind: 'debian' as const,
    supported: true,
  },
  {
    key: 'fedora' as const,
    label: 'Fedora',
    title: 'Fedora install status',
    description: 'RPM-based bootstrap is not configured in this ITMS deployment yet.',
    copyKind: 'fedora' as const,
    supported: false,
  },
  {
    key: 'centos' as const,
    label: 'CentOS',
    title: 'CentOS install status',
    description: 'RPM-based bootstrap is not configured in this ITMS deployment yet.',
    copyKind: 'centos' as const,
    supported: false,
  },
  {
    key: 'redhat' as const,
    label: 'Red Hat',
    title: 'Red Hat install status',
    description: 'RPM-based bootstrap is not configured in this ITMS deployment yet.',
    copyKind: 'redhat' as const,
    supported: false,
  },
] as const;

const INSTALL_VARIANTS = [
  {
    key: 'windows' as const,
    label: 'Windows',
    title: 'Windows install + first sync',
    description: 'Run once in an elevated PowerShell session on the Windows endpoint. It installs the ITMS collector stack, keeps detailed hardware inventory enabled, and performs the first inventory sync automatically.',
    copyKind: 'windows' as const,
    commandType: 'windows' as const,
  },
  ...LINUX_INSTALL_VARIANTS.map((variant) => ({
    ...variant,
    commandType: 'linux' as const,
  })),
] as const;

export default function UserInstallWorkspace({
  selectedUser,
  installConfig,
  installConfigLoading,
  installAssignedToName,
  installAssignedToEmail,
  installEmployeeCode,
  installDepartmentName,
  mergedDepartmentOptions,
  includeLinuxHardinfoFallback,
  installEmailValid,
  installFieldsComplete,
  linuxInstallCommand,
  linuxSyncCommand,
  windowsInstallCommand,
  windowsSyncCommand,
  copyStatus,
  onInstallAssignedToNameChange,
  onInstallAssignedToEmailChange,
  onInstallEmployeeCodeChange,
  onInstallDepartmentNameChange,
  onIncludeLinuxHardinfoFallbackChange,
  onCopyCommand,
}: UserInstallWorkspaceProps) {
  const [selectedInstallVariantKey, setSelectedInstallVariantKey] = useState<(typeof INSTALL_VARIANTS)[number]['key']>('windows');
  const selectedInstallVariant = useMemo(
    () => INSTALL_VARIANTS.find((variant) => variant.key === selectedInstallVariantKey) || INSTALL_VARIANTS[0],
    [selectedInstallVariantKey],
  );
  const selectedInstallCommand = selectedInstallVariant.commandType === 'windows'
    ? windowsInstallCommand
    : selectedInstallVariant.supported
      ? linuxInstallCommand
      : RPM_INSTALLER_NOTICE;
  const selectedSyncCommand = selectedInstallVariant.commandType === 'windows'
    ? windowsSyncCommand
    : linuxSyncCommand;
  const selectedSyncCopyKind = selectedInstallVariant.commandType === 'windows' ? 'windows-sync' : 'linux-sync';
  const selectedSyncTitle = selectedInstallVariant.commandType === 'windows' ? 'Windows Sync Code' : 'Linux Sync Code';

  return <section className="space-y-4">
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Install Agents</div>
          <h2 className="mt-1 text-xl font-bold text-zinc-900">{selectedUser?.fullName || 'Select a user'}</h2>
          <p className="mt-1 text-sm text-zinc-500">Run these commands directly on the target system. The employee fields below are included in the generated command and can still be changed before you run it. Asset name and asset tag are fetched or generated automatically on the endpoint during installation. The sync commands can be used later to push inventory again.</p>
        </div>
        {selectedUser ? <div className="rounded-xl bg-zinc-50 px-4 py-3 text-right"><div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee</div><div className="mt-2 text-sm font-bold text-zinc-900">{selectedUser.employeeCode}</div><div className="mt-1 text-xs text-zinc-500">These values are prefilled from the selected user and can be edited below before generating the final command.</div></div> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Public server URL</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.publicServerUrl || (installConfigLoading ? 'Loading...' : 'Not configured')}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Salt API</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.saltApiConfigured ? 'Configured' : installConfigLoading ? 'Loading...' : 'Not configured'}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Salt API Base</div>
          <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{installConfig?.saltApiBaseUrl || (installConfigLoading ? 'Loading...' : 'Not configured')}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Wazuh API</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.wazuhApiConfigured ? 'Configured' : installConfigLoading ? 'Loading...' : 'Not configured'}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Inventory token</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.inventoryIngestToken ? 'Ready' : installConfigLoading ? 'Loading...' : 'Missing'}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 px-4 py-3 md:col-span-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">SSH Terminal Auth</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.sshAuthMode === 'certificate' ? 'Certificate-backed key' : installConfig?.sshAuthMode === 'key' ? 'Private key' : installConfigLoading ? 'Loading...' : 'Not configured'}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee Name</div>
          <input
            type="text"
            value={installAssignedToName}
            onChange={(event) => onInstallAssignedToNameChange(event.target.value)}
            placeholder="Employee name"
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee Email</div>
          <input
            type="email"
            value={installAssignedToEmail}
            onChange={(event) => onInstallAssignedToEmailChange(event.target.value)}
            placeholder="employee@zerodha.com"
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          {!installEmailValid && installAssignedToEmail.trim().length > 0 ? <div className="mt-2 text-xs text-rose-600">Use a valid @zerodha.com employee email.</div> : null}
        </label>
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee ID</div>
          <input
            type="text"
            value={installEmployeeCode}
            onChange={(event) => onInstallEmployeeCodeChange(event.target.value)}
            placeholder="Employee ID"
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
          <input
            type="text"
            list="install-department-options"
            value={installDepartmentName}
            onChange={(event) => onInstallDepartmentNameChange(event.target.value)}
            placeholder={mergedDepartmentOptions.length ? 'Select or type department' : 'Department'}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          <datalist id="install-department-options">
            {mergedDepartmentOptions.map((department) => (
              <option key={department.id} value={department.name} />
            ))}
          </datalist>
          <div className="mt-2 text-xs text-zinc-500">
            {mergedDepartmentOptions.length ? 'Choose one of the listed departments or type a new one manually.' : 'No department list is configured yet, so enter the department manually.'}
          </div>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={includeLinuxHardinfoFallback}
          onChange={(event) => onIncludeLinuxHardinfoFallbackChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="block font-semibold text-zinc-900">Include Linux hardinfo fallback</span>
          <span className="mt-1 block text-xs text-zinc-500">Adds --use-hardinfo-fallback to copied Linux install and sync commands. Turn it off if you want to keep Linux collection limited to the default structured probes.</span>
        </span>
      </label>
      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">Use the Windows or Linux install code below on the endpoint. Each one-liner includes the employee fields shown above when available and falls back to placeholders when the form is still incomplete, so the copy buttons stay usable. Salt and Wazuh improve remote control and security visibility when configured, but the core onboarding flow only requires the server URL and inventory ingest token.</div>
      {!installFieldsComplete ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Complete Employee name, Employee email, Employee ID, and Department to generate a runnable install command.</div> : null}
    </div>

    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:items-stretch">
          <label className="block">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Operating System</div>
            <select
              value={selectedInstallVariant.key}
              onChange={(event) => setSelectedInstallVariantKey(event.target.value as (typeof INSTALL_VARIANTS)[number]['key'])}
              className="mt-2 min-h-[3.25rem] w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400"
            >
              {INSTALL_VARIANTS.map((variant) => (
                <option key={variant.key} value={variant.key}>{variant.label}</option>
              ))}
            </select>
          </label>
          <div className="flex min-h-[4.75rem] flex-col justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <div className="font-semibold text-zinc-900">{selectedInstallVariant.title}</div>
            <div className="mt-1">{selectedInstallVariant.description}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{selectedInstallVariant.label} Install Code</div>
            <button
              type="button"
              onClick={() => onCopyCommand(selectedInstallVariant.copyKind, selectedInstallCommand)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              {copyStatus === selectedInstallVariant.copyKind ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 flex-1 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{selectedInstallCommand}</pre>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{selectedSyncTitle}</div>
            <button
              type="button"
              onClick={() => onCopyCommand(selectedSyncCopyKind, selectedSyncCommand)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              {copyStatus === selectedSyncCopyKind ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 flex-1 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{selectedSyncCommand}</pre>
        </div>
      </div>
    </div>
  </section>;
}
