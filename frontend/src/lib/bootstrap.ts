interface BootstrapUserLike {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  employeeCode?: string | null;
}

interface BootstrapDepartmentLike {
  name?: string | null;
}

interface BootstrapToolStatusLike {
  salt?: {
    identifier?: string | null;
    connected?: boolean;
  };
}

export interface BootstrapDeviceLike {
  assetId?: string | null;
  hostname?: string | null;
  deviceType?: string | null;
  osName?: string | null;
  saltMinionId?: string | null;
  user?: BootstrapUserLike | null;
  department?: BootstrapDepartmentLike | null;
  toolStatus?: BootstrapToolStatusLike;
}

function hasAssignedUser(device?: BootstrapDeviceLike | null) {
  return Boolean(
    device?.user?.id?.trim()
      || device?.user?.email?.trim()
      || device?.user?.fullName?.trim(),
  );
}

export function resolveSaltTarget(device?: BootstrapDeviceLike | null) {
  const linkedIdentifier = device?.toolStatus?.salt?.identifier?.trim() || device?.saltMinionId?.trim() || '';
  if (linkedIdentifier) {
    return linkedIdentifier;
  }

  if (!hasAssignedUser(device)) {
    return '';
  }

  return device?.hostname?.trim() || device?.assetId?.trim() || '';
}

interface InstallAgentConfigLike {
  saltApiConfigured: boolean;
  saltBootstrapReady?: boolean;
  portalInstallReady: boolean;
  sshConfigured?: boolean;
  publicServerUrl?: string;
  inventoryIngestToken?: string;
  saltMasterHost?: string;
  wazuhManagerHost?: string;
  linuxInstallerUrl?: string;
  windowsInstallerUrl?: string;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, `''`)}'`;
}

function formatPowerShellArgument(value: string) {
  if (/^\$(true|false)$/i.test(value)) {
    return value;
  }
  return quotePowerShell(value);
}

function buildLinuxArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `--${key} ${quoteShell(value)}`).join(' ');
}

function buildWindowsArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `-${key.replace(/(^|-)([a-z])/g, (_, prefix: string, chr: string) => `${prefix === '-' ? '' : ''}${chr.toUpperCase()}`)} ${formatPowerShellArgument(value)}`).join(' ');
}

export function inferBootstrapPlatform(osName?: string | null) {
  const normalized = (osName || '').toLowerCase();
  if (normalized.includes('windows')) {
    return 'Windows';
  }
  if (normalized.includes('ubuntu') || normalized.includes('linux')) {
    return 'Linux';
  }
  if (normalized.includes('mac')) {
    return 'macOS';
  }
  return 'Unknown platform';
}

function buildDeviceCategory(device?: BootstrapDeviceLike | null) {
  const normalized = (device?.deviceType || '').trim().toLowerCase();
  if (['laptop', 'desktop', 'workstation', 'server'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
}

export function hasSaltTarget(device?: BootstrapDeviceLike | null) {
  return Boolean(resolveSaltTarget(device));
}

export function saltTargetConnected(device?: BootstrapDeviceLike | null) {
  return device?.toolStatus?.salt?.connected !== false;
}

export function buildDeviceLinuxBootstrapCommand(device?: BootstrapDeviceLike | null, config?: InstallAgentConfigLike | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.linuxInstallerUrl || `${serverUrl}/installers/install-itms-agent.sh`;
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['token', ingestToken],
    ['category', buildDeviceCategory(device)],
    ['asset-tag', device?.assetId || ''],
    ['name', device?.hostname || ''],
    ['assigned-to-name', device?.user?.fullName || ''],
    ['assigned-to-email', device?.user?.email || ''],
    ['employee-code', device?.user?.employeeCode || ''],
    ['department-name', device?.department?.name || ''],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', `Installed by ITMS bootstrap for ${device?.hostname || 'endpoint'}`],
  ];
  return `curl -fsSL ${quoteShell(installerUrl)} -o /tmp/install-itms-agent.sh && sudo bash /tmp/install-itms-agent.sh ${buildLinuxArgumentString(installArgs.filter(([, value]) => value.trim().length > 0))}`;
}

export function buildDeviceWindowsBootstrapCommand(device?: BootstrapDeviceLike | null, config?: InstallAgentConfigLike | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.windowsInstallerUrl || `${serverUrl}/installers/install-itms-agent.ps1`;
  const ingestToken = config?.inventoryIngestToken || '<INVENTORY_INGEST_TOKEN>';
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['token', ingestToken],
    ['category', buildDeviceCategory(device)],
    ['use-detailed-hardware-inventory', '$true'],
    ['asset-tag', device?.assetId || ''],
    ['name', device?.hostname || ''],
    ['assigned-to-name', device?.user?.fullName || ''],
    ['assigned-to-email', device?.user?.email || ''],
    ['employee-code', device?.user?.employeeCode || ''],
    ['department-name', device?.department?.name || ''],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', `Installed by ITMS bootstrap for ${device?.hostname || 'endpoint'}`],
  ];
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$scriptPath = Join-Path $env:TEMP 'install-itms-agent.ps1'; Invoke-WebRequest ${quotePowerShell(installerUrl)} -OutFile $scriptPath; & $scriptPath ${buildWindowsArgumentString(installArgs.filter(([, value]) => value.trim().length > 0))}"`;
}