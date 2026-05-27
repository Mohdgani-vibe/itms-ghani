import { isProbeLikeUser } from '../../lib/userVisibility';

const VALID_PATCH_RINGS = new Set(['pilot', 'standard', 'broad', 'critical']);
const PRIVILEGED_REQUEST_WORKFLOW_ROLES = new Set(['admin', 'it_team', 'super_admin']);

export interface InstallAgentConfig {
  publicServerUrl: string;
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

export interface WorkflowRoute {
  match: string;
  assigneeId: string;
}

export interface PatchDepartmentRing {
  match: string;
  ring: string;
}

export interface WorkflowSettings {
  requestAutoAssignEnabled: boolean;
  chatAutoCreateEnabled: boolean;
  chatAutoRouteEnabled: boolean;
  requestFallbackAssigneeId: string | null;
  chatFallbackAssigneeId: string | null;
  ticketAssigneeIds: string[];
  chatMemberIds: string[];
  requestTypeRoutes: WorkflowRoute[];
  requestSubjectRoutes: WorkflowRoute[];
  chatSubjectRoutes: WorkflowRoute[];
  patchWindowEnabled: boolean;
  patchWindowStart: string;
  patchWindowEnd: string;
  patchAllowedRings: string[];
  patchDepartmentRings: PatchDepartmentRing[];
  updatedAt?: string;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeCode?: string;
}

export interface ApiDirectoryUser {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  role: string;
  emp_id?: string;
}

export function normalizeDirectoryUsers(items: ApiDirectoryUser[]) {
  return items.map((user) => ({
    id: user.id,
    fullName: user.fullName || user.full_name || user.email || user.id,
    email: user.email,
    role: user.role,
    employeeCode: user.emp_id,
  }));
}

export function isProbeWorkflowUser(user: DirectoryUser) {
  return isProbeLikeUser(user);
}

export function filterRequestWorkflowUsers(users: DirectoryUser[]) {
  if (users.some((user) => user.role === 'employee')) {
    return users;
  }
  return users.filter((user) => PRIVILEGED_REQUEST_WORKFLOW_ROLES.has(user.role));
}

function normalizeWorkflowId(value: string | null | undefined) {
  return value?.trim() || '';
}

function normalizeWorkflowIds(values: string[] | null | undefined) {
  return Array.from(new Set((values || []).map((value) => normalizeWorkflowId(value)).filter(Boolean)));
}

function normalizeWorkflowRoute(route: WorkflowRoute) {
  return {
    match: normalizePatchDepartmentName(route.match),
    assigneeId: normalizeWorkflowId(route.assigneeId),
  };
}

function normalizeWorkflowRoutes(routes: WorkflowRoute[] | null | undefined) {
  return (routes || []).map((route) => normalizeWorkflowRoute(route)).filter((route) => route.match && route.assigneeId);
}

export function resolveWorkflowMemberUsers(users: DirectoryUser[], selectedIds: string[] | null | undefined) {
  const normalizedIds = normalizeWorkflowIds(selectedIds);
  if (normalizedIds.length === 0) {
    return {
      selectedUsers: [] as DirectoryUser[],
      effectiveUsers: users,
    };
  }

  const selectedUsers = users.filter((user) => normalizedIds.includes(user.id));
  return {
    selectedUsers,
    effectiveUsers: selectedUsers,
  };
}

export function pruneWorkflowSettingsForEligibleUsers(
  settings: WorkflowSettings,
  requestEligibleUserIds: string[],
  chatEligibleUserIds: string[],
  requestSubjectRoutes = settings.requestSubjectRoutes,
  chatSubjectRoutes = settings.chatSubjectRoutes,
): WorkflowSettings {
  const requestEligibleSet = new Set(normalizeWorkflowIds(requestEligibleUserIds));
  const chatEligibleSet = new Set(normalizeWorkflowIds(chatEligibleUserIds));

  return {
    ...settings,
    requestFallbackAssigneeId: requestEligibleSet.has(normalizeWorkflowId(settings.requestFallbackAssigneeId))
      ? normalizeWorkflowId(settings.requestFallbackAssigneeId)
      : null,
    chatFallbackAssigneeId: chatEligibleSet.has(normalizeWorkflowId(settings.chatFallbackAssigneeId))
      ? normalizeWorkflowId(settings.chatFallbackAssigneeId)
      : null,
    requestTypeRoutes: normalizeWorkflowRoutes(settings.requestTypeRoutes).filter((route) => requestEligibleSet.has(route.assigneeId)),
    requestSubjectRoutes: normalizeWorkflowRoutes(requestSubjectRoutes).filter((route) => requestEligibleSet.has(route.assigneeId)),
    chatSubjectRoutes: normalizeWorkflowRoutes(chatSubjectRoutes).filter((route) => chatEligibleSet.has(route.assigneeId)),
  };
}

export function normalizeWorkflowSettings(settings: WorkflowSettings): WorkflowSettings {
  return {
    ...settings,
    requestFallbackAssigneeId: normalizeWorkflowId(settings.requestFallbackAssigneeId) || null,
    chatFallbackAssigneeId: normalizeWorkflowId(settings.chatFallbackAssigneeId) || null,
    ticketAssigneeIds: normalizeWorkflowIds(settings.ticketAssigneeIds),
    chatMemberIds: normalizeWorkflowIds(settings.chatMemberIds),
    requestTypeRoutes: normalizeWorkflowRoutes(settings.requestTypeRoutes),
    requestSubjectRoutes: normalizeWorkflowRoutes(settings.requestSubjectRoutes),
    chatSubjectRoutes: normalizeWorkflowRoutes(settings.chatSubjectRoutes),
    patchWindowEnabled: settings.patchWindowEnabled === true,
    patchWindowStart: normalizePatchWindowTime(settings.patchWindowStart) || '22:00',
    patchWindowEnd: normalizePatchWindowTime(settings.patchWindowEnd) || '06:00',
    patchAllowedRings: Array.from(new Set((settings.patchAllowedRings || []).map((ring) => normalizePatchRing(ring)).filter(Boolean))),
    patchDepartmentRings: (settings.patchDepartmentRings || []).map((route) => ({
      ...route,
      match: normalizePatchDepartmentName(route.match),
      ring: normalizePatchRing(route.ring),
    })).filter((route) => route.match && route.ring && route.ring !== 'standard'),
  };
}

export function serializeWorkflowSettings(settings: WorkflowSettings) {
  return {
    ...settings,
    requestFallbackAssigneeId: settings.requestFallbackAssigneeId ?? '',
    chatFallbackAssigneeId: settings.chatFallbackAssigneeId ?? '',
  };
}

export function normalizePatchDepartmentName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizePatchRing(value: string) {
  const normalized = value.trim().toLowerCase();
  return VALID_PATCH_RINGS.has(normalized) ? normalized : '';
}

export function normalizePatchWindowTime(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return '';
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function routesToEditorText(routes: WorkflowRoute[]) {
  return routes.map((route) => `${route.match} => ${route.assigneeId}`).join('\n');
}

export function parseEditorTextToRoutes(value: string) {
  const routes: WorkflowRoute[] = [];
  const invalidLines: string[] = [];

  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const arrowIndex = line.indexOf('=>');
      const equalsIndex = arrowIndex >= 0 ? -1 : line.indexOf('=');
      const separatorIndex = arrowIndex >= 0 ? arrowIndex : equalsIndex;
      const separatorLength = arrowIndex >= 0 ? 2 : equalsIndex >= 0 ? 1 : 0;

      if (separatorIndex < 0) {
        invalidLines.push(line);
        return;
      }

      const match = line.slice(0, separatorIndex).trim();
      const assigneeId = line.slice(separatorIndex + separatorLength).trim();

      if (!match || !assigneeId) {
        invalidLines.push(line);
        return;
      }

      routes.push({ match, assigneeId });
    });

  return { routes, invalidLines };
}

export function workflowTypeAssignee(settings: WorkflowSettings | null, type: string) {
  const route = settings?.requestTypeRoutes.find((item) => item.match.toLowerCase() === type.toLowerCase());
  return route?.assigneeId || '';
}

export function quoteShell(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, `''`)}'`;
}

export function formatPowerShellArgument(value: string) {
  if (/^\$(true|false)$/i.test(value)) {
    return value;
  }
  return quotePowerShell(value);
}

export function buildLinuxArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `--${key} ${quoteShell(value)}`).join(' ');
}

export function buildWindowsArgumentString(args: Array<[string, string]>) {
  return args.map(([key, value]) => `-${key.replace(/(^|-)([a-z])/g, (_, prefix: string, chr: string) => `${prefix === '-' ? '' : ''}${chr.toUpperCase()}`)} ${formatPowerShellArgument(value)}`).join(' ');
}

export function buildSettingsLinuxBootstrapCommand(config?: InstallAgentConfig | null, includeHardinfoFallback = true) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.linuxInstallerUrl || `${serverUrl}/installers/install-itms-agent.sh`;
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['category', 'auto'],
    ['assigned-to-name', '<EMPLOYEE_NAME>'],
    ['assigned-to-email', '<EMPLOYEE_EMAIL>'],
    ['employee-code', '<EMPLOYEE_ID>'],
    ['department-name', '<DEPARTMENT>'],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', 'Installed by ITMS bootstrap'],
  ];
  const commandParts = ['--prompt-token', buildLinuxArgumentString(installArgs)];
  if (includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  return `curl -fsSL ${quoteShell(installerUrl)} -o /tmp/install-itms-agent.sh && sudo bash /tmp/install-itms-agent.sh ${commandParts.join(' ')}`;
}

export function buildSettingsWindowsBootstrapCommand(config?: InstallAgentConfig | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const installerUrl = config?.windowsInstallerUrl || `${serverUrl}/installers/install-itms-agent.ps1`;
  const saltMaster = config?.saltMasterHost || '<SALT_MASTER>';
  const wazuhManager = config?.wazuhManagerHost || '<WAZUH_MANAGER>';
  const installArgs: Array<[string, string]> = [
    ['server-url', serverUrl],
    ['category', 'auto'],
    ['use-detailed-hardware-inventory', '$true'],
    ['assigned-to-name', '<EMPLOYEE_NAME>'],
    ['assigned-to-email', '<EMPLOYEE_EMAIL>'],
    ['employee-code', '<EMPLOYEE_ID>'],
    ['department-name', '<DEPARTMENT>'],
    ['salt-master', saltMaster],
    ['wazuh-manager', wazuhManager],
    ['notes', 'Installed by ITMS bootstrap'],
  ];
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$scriptPath = Join-Path $env:TEMP 'install-itms-agent.ps1'; Invoke-WebRequest ${quotePowerShell(installerUrl)} -OutFile $scriptPath; & $scriptPath -PromptToken ${buildWindowsArgumentString(installArgs)}"`;
}

export function buildSettingsLinuxSyncCommand(config?: InstallAgentConfig | null, includeHardinfoFallback = true) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  const commandParts = [
    `sudo /usr/bin/python3 /opt/itms/push-system-inventory.py --server-url ${quoteShell(serverUrl)} --category 'auto'`,
  ];
  if (includeHardinfoFallback) {
    commandParts.push('--use-hardinfo-fallback');
  }
  return commandParts.join(' ');
}

export function buildSettingsWindowsSyncCommand(config?: InstallAgentConfig | null) {
  const serverUrl = config?.publicServerUrl || '<ITMS_SERVER_URL>';
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\ProgramData\\ITMS\\push-system-inventory.ps1" -ServerUrl ${quotePowerShell(serverUrl)} -Category 'auto' -UseDetailedHardwareInventory $true`;
}

export function formatDateTime(value?: string) {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}