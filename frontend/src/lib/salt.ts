import { inferBootstrapPlatform } from './bootstrap';

export type SaltActionValue = 'system-update' | 'chrome-update' | 'check-salt-minion' | 'restart-salt-minion' | 'custom-command' | 'custom-state';

export interface SaltActionOption {
  value: SaltActionValue;
  label: string;
  description: string;
  inputLabel?: string;
  inputPlaceholder?: string;
}

export const SALT_ACTION_OPTIONS: SaltActionOption[] = [
  {
    value: 'system-update',
    label: 'System Update',
    description: 'Run the default Salt patch state for the asset.',
  },
  {
    value: 'chrome-update',
    label: 'Chrome Update',
    description: 'Upgrade Google Chrome on supported Linux or Windows devices.',
  },
  {
    value: 'check-salt-minion',
    label: 'Check Salt Minion',
    description: 'Check whether the Salt minion service is active on the asset.',
  },
  {
    value: 'restart-salt-minion',
    label: 'Restart Salt Minion',
    description: 'Restart the Salt minion service and show its status output.',
  },
  {
    value: 'custom-command',
    label: 'Custom Shell Command',
    description: 'Run a shell command through Salt cmd.run_all.',
    inputLabel: 'Shell command',
    inputPlaceholder: 'apt-get update && apt-get install -y google-chrome-stable',
  },
  {
    value: 'custom-state',
    label: 'Custom Salt State',
    description: 'Run a specific Salt state.apply target.',
    inputLabel: 'Salt state',
    inputPlaceholder: 'patch.chrome',
  },
];

export function getSaltActionOption(value: string): SaltActionOption {
  return SALT_ACTION_OPTIONS.find((option) => option.value === value) || SALT_ACTION_OPTIONS[0];
}

export function buildSaltActionRequest(value: string, customInput: string) {
  const action = getSaltActionOption(value).value;
  const trimmedInput = customInput.trim();

  if (action === 'custom-command') {
    return { action, command: trimmedInput };
  }
  if (action === 'custom-state') {
    return { action, state: trimmedInput };
  }
  return { action };
}

export function isPatchReportableSaltAction(value: string, customInput: string) {
  const action = getSaltActionOption(value).value;
  const trimmedInput = customInput.trim().toLowerCase();

  if (action === 'system-update') {
    return true;
  }

  if (action === 'custom-state') {
    return trimmedInput === 'patch' || trimmedInput === 'patch.run' || trimmedInput.startsWith('patch.');
  }

  return false;
}

function isWindowsPlatform(osName?: string | null) {
  return inferBootstrapPlatform(osName) === 'Windows';
}

export function buildSaltActionConsolePrefill(value: string, customInput: string, osName?: string | null) {
  const action = getSaltActionOption(value).value;
  const trimmedInput = customInput.trim();
  const windows = isWindowsPlatform(osName);

  if (action === 'chrome-update') {
    if (windows) {
      return `powershell -NoProfile -Command "$chromeUpdate = Join-Path ${'$'}env:ProgramFiles(x86) 'Google\\Update\\GoogleUpdate.exe'; if (Test-Path ${'$'}chromeUpdate) { & ${'$'}chromeUpdate /ua /installsource scheduler } elseif (Get-Command winget -ErrorAction SilentlyContinue) { winget upgrade --id Google.Chrome --silent --accept-source-agreements --accept-package-agreements } else { throw 'Google Chrome updater not found' }"`;
    }
    return 'apt-get update && apt-get install --only-upgrade -y google-chrome-stable';
  }
  if (action === 'check-salt-minion') {
    if (windows) {
      return 'powershell -NoProfile -Command "Get-Service -Name salt-minion | Format-Table -Auto Name,Status,StartType"';
    }
    return 'systemctl status --no-pager salt-minion';
  }
  if (action === 'restart-salt-minion') {
    if (windows) {
      return 'powershell -NoProfile -Command "Restart-Service -Name salt-minion -Force; Get-Service -Name salt-minion | Format-Table -Auto Name,Status,StartType"';
    }
    return 'systemctl restart salt-minion && systemctl status --no-pager salt-minion';
  }
  if (action === 'custom-command' && trimmedInput) {
    return trimmedInput;
  }
  if (action === 'custom-state' && trimmedInput) {
    return `salt-call state.apply ${trimmedInput}`;
  }
  if (action === 'system-update') {
    return 'state.apply patch.run';
  }
  if (windows) {
    return 'powershell -NoProfile -Command "Get-Service -Name salt-minion | Format-Table -Auto Name,Status,StartType"';
  }
  return 'systemctl status salt-minion';
}

export function saltActionInputError(value: string, customInput: string) {
  const action = getSaltActionOption(value).value;
  if ((action === 'custom-command' || action === 'custom-state') && !customInput.trim()) {
    return action === 'custom-command' ? 'Shell command is required.' : 'Salt state is required.';
  }
  return '';
}

export function saltActionSuccessMessage(actionValue: string, status: string | undefined, targetLabel: string, consoleOpened: boolean) {
  const action = getSaltActionOption(actionValue);
  const suffix = consoleOpened ? ' Salt command console opened.' : '';
  if (status === 'completed') {
    return `${action.label} completed for ${targetLabel}.${suffix}`;
  }
  if (status === 'failed') {
    return `${action.label} failed for ${targetLabel}.${suffix}`;
  }
  return `${action.label} requested for ${targetLabel}.${suffix}`;
}