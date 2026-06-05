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
    title: 'Fedora install + first sync',
    description: 'RPM-based Linux bootstrap for Fedora endpoints using dnf-compatible install flow.',
    copyKind: 'fedora' as const,
    supported: true,
  },
  {
    key: 'centos' as const,
    label: 'CentOS',
    title: 'CentOS install + first sync',
    description: 'RPM-based Linux bootstrap for CentOS endpoints using yum or dnf install flow.',
    copyKind: 'centos' as const,
    supported: true,
  },
  {
    key: 'redhat' as const,
    label: 'Red Hat',
    title: 'Red Hat install + first sync',
    description: 'RPM-based Linux bootstrap for Red Hat Enterprise Linux endpoints using yum or dnf install flow.',
    copyKind: 'redhat' as const,
    supported: true,
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
  return {
    installCommand: selectedInstallVariant.commandType === 'windows'
      ? windowsInstallCommand
      : linuxInstallCommand,
    syncCommand: selectedInstallVariant.commandType === 'windows'
      ? windowsSyncCommand
      : linuxSyncCommand,
    syncCopyKind: selectedInstallVariant.commandType === 'windows'
      ? 'windows-sync'
      : 'linux-sync',
    syncTitle: selectedInstallVariant.commandType === 'windows'
      ? 'Windows Sync Code'
      : 'Linux Sync Code',
  };
}
