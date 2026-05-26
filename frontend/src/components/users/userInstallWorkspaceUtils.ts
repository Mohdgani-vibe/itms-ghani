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

export const INSTALL_VARIANTS = [
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

interface InstallVariantCommandState {
  installCommand: string;
  syncCommand: string;
  syncCopyKind: 'fedora' | 'centos' | 'redhat' | 'linux-sync' | 'windows-sync';
  syncTitle: string;
}

export function resolveInstallVariantCommandState(
  selectedInstallVariant: (typeof INSTALL_VARIANTS)[number],
  linuxInstallCommand: string,
  linuxSyncCommand: string,
  windowsInstallCommand: string,
  windowsSyncCommand: string,
): InstallVariantCommandState {
  const linuxVariantSupported = selectedInstallVariant.commandType !== 'linux' || selectedInstallVariant.supported;

  return {
    installCommand: selectedInstallVariant.commandType === 'windows'
      ? windowsInstallCommand
      : linuxVariantSupported
        ? linuxInstallCommand
        : RPM_INSTALLER_NOTICE,
    syncCommand: selectedInstallVariant.commandType === 'windows'
      ? windowsSyncCommand
      : linuxVariantSupported
        ? linuxSyncCommand
        : RPM_INSTALLER_NOTICE,
    syncCopyKind: selectedInstallVariant.commandType === 'windows'
      ? 'windows-sync'
      : linuxVariantSupported
        ? 'linux-sync'
        : selectedInstallVariant.copyKind,
    syncTitle: selectedInstallVariant.commandType === 'windows'
      ? 'Windows Sync Code'
      : linuxVariantSupported
        ? 'Linux Sync Code'
        : `${selectedInstallVariant.label} sync status`,
  };
}
