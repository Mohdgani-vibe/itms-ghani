import type { UserRecord } from './userDirectoryUtils';

export interface InstallAgentConfig {
  publicServerUrl: string;
  inventoryIngestToken: string;
  saltMasterHost: string;
  saltApiBaseUrl?: string;
  wazuhManagerHost: string;
  saltApiConfigured: boolean;
  saltBootstrapReady?: boolean;
  sshConfigured?: boolean;
  sshAuthMode?: string;
  wazuhApiConfigured: boolean;
  portalInstallReady: boolean;
  linuxInstallerUrl?: string;
  windowsInstallerUrl?: string;
}

export interface InstallOverrides {
  assignedToName?: string;
  assignedToEmail?: string;
  employeeCode?: string;
  departmentName?: string;
  includeHardinfoFallback?: boolean;
}

function buildEndpointCategory(user?: UserRecord | null) {
  void user;
  return 'auto';
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

export function buildLinuxBootstrapCommand(config?: InstallAgentConfig | null, user?: UserRecord | null, overrides?: InstallOverrides) {
  const category = buildEndpointCategory(user);
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.linuxInstallerUrl || `${serverUrl}/installers/install-itms-agent.sh`;
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const notes = 'Installed by ITMS bootstrap';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['category', category],
    ['assigned-to-name', overrides?.assignedToName || ''],
    ['assigned-to-email', overrides?.assignedToEmail || ''],
    ['employee-code', overrides?.employeeCode || ''],
    ['department-name', overrides?.departmentName || ''],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', notes],
  ];
  const commandParts = ['--prompt-token', buildLinuxArgumentString(installArgs.filter(([, value]) => value.trim().length > 0))];
  if (overrides?.includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  const commandArgs = commandParts.filter((value) => value.trim().length > 0).join(' ');
  return `curl -fsSL ${quoteShell(installerUrl)} -o /tmp/install-itms-agent.sh && sudo bash /tmp/install-itms-agent.sh ${commandArgs}`;
}

export function buildWindowsBootstrapCommand(config?: InstallAgentConfig | null, user?: UserRecord | null, overrides?: InstallOverrides) {
  const category = buildEndpointCategory(user);
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.windowsInstallerUrl || `${serverUrl}/installers/install-itms-agent.ps1`;
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const notes = 'Installed by ITMS bootstrap';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['category', category],
    ['use-detailed-hardware-inventory', '$true'],
    ['assigned-to-name', overrides?.assignedToName || ''],
    ['assigned-to-email', overrides?.assignedToEmail || ''],
    ['employee-code', overrides?.employeeCode || ''],
    ['department-name', overrides?.departmentName || ''],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', notes],
  ];
  const commandArgs = buildWindowsArgumentString(installArgs.filter(([, value]) => value.trim().length > 0));
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$scriptPath = Join-Path $env:TEMP 'install-itms-agent.ps1'; Invoke-WebRequest ${quotePowerShell(installerUrl)} -OutFile $scriptPath; & $scriptPath -PromptToken ${commandArgs}"`;
}

export function buildLinuxSyncCommand(config?: InstallAgentConfig | null, user?: UserRecord | null, includeHardinfoFallback = true) {
  const category = buildEndpointCategory(user);
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const commandParts = [
    `sudo /usr/bin/python3 /opt/itms/push-system-inventory.py --server-url ${quoteShell(serverUrl)} --category ${quoteShell(category)}`,
  ];
  if (includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  return commandParts.join(' ');
}

export function buildWindowsSyncCommand(config?: InstallAgentConfig | null, user?: UserRecord | null) {
  const category = buildEndpointCategory(user);
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\ProgramData\\ITMS\\push-system-inventory.ps1" -ServerUrl ${quotePowerShell(serverUrl)} -Category ${quotePowerShell(category)} -UseDetailedHardwareInventory $true`;
}
