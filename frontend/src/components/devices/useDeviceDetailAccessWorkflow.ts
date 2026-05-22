import { useCallback, useMemo } from 'react';

import { apiRequest } from '../../lib/api';
import { hasSaltTarget, resolveSaltTarget, saltTargetConnected } from '../../lib/bootstrap';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, createPatchRunRunningEntry, type PatchRunExecutionResponse, type PatchRunReport } from '../../lib/patchReports';
import { buildSaltActionConsolePrefill, buildSaltActionRequest, isPatchReportableSaltAction, saltActionInputError, saltActionSuccessMessage, type SaltActionValue } from '../../lib/salt';
import { buildEmbeddedSaltConsoleState, type EmbeddedConsoleState } from '../EmbeddedConsoleModal';

interface DeviceAccessWorkflowDevice {
  id: string;
  hostname: string;
  status?: string | null;
  osName?: string | null;
  saltMinionId?: string | null;
  network?: {
    netbird_ip?: string | null;
    wired_ip?: string | null;
    wireless_ip?: string | null;
  } | null;
  toolStatus?: {
    salt?: {
      identifier?: string | null;
      connected?: boolean;
    };
  };
  department?: { name: string } | null;
}

interface InstallAgentConfigLike {
  saltApiConfigured: boolean;
  sshConfigured?: boolean;
}

interface UseDeviceDetailAccessWorkflowParams {
  device: DeviceAccessWorkflowDevice | null;
  computeAsset: boolean;
  canOperate: boolean;
  installConfig: InstallAgentConfigLike | null;
  installConfigLoading: boolean;
  selectedSaltAction: SaltActionValue;
  customSaltInput: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string>>;
  setRunningPatch: React.Dispatch<React.SetStateAction<boolean>>;
  setStartingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
  setEmbeddedConsole: React.Dispatch<React.SetStateAction<EmbeddedConsoleState | null>>;
  setPatchReport: React.Dispatch<React.SetStateAction<PatchRunReport | null>>;
  refreshSidebarData: () => Promise<void>;
}

export function deviceDetailAccessActionsReadOnly(deviceStatus?: string | null) {
  return (deviceStatus || '').trim().toLowerCase() === 'retired';
}

export function useDeviceDetailAccessWorkflow({
  device,
  computeAsset,
  canOperate,
  installConfig,
  installConfigLoading,
  selectedSaltAction,
  customSaltInput,
  setError,
  setSuccessMessage,
  setRunningPatch,
  setStartingTerminal,
  setEmbeddedConsole,
  setPatchReport,
  refreshSidebarData,
}: UseDeviceDetailAccessWorkflowParams) {
  const actionsReadOnly = deviceDetailAccessActionsReadOnly(device?.status);
  const hasLinkedSaltTarget = hasSaltTarget(device);
  const saltLinkedAndConnected = saltTargetConnected(device);
  const saltApiReady = Boolean(installConfig?.saltApiConfigured);
  const sshTerminalReady = Boolean(installConfig?.sshConfigured);
  const sshTarget = device?.network?.netbird_ip || device?.network?.wired_ip || device?.network?.wireless_ip || device?.hostname || '';
  const canStartTerminal = canOperate && computeAsset && sshTerminalReady && !actionsReadOnly;
  const canOpenPatchConsole = canOperate && computeAsset && hasLinkedSaltTarget && !installConfigLoading && !actionsReadOnly;
  const canRunPatch = canOperate && computeAsset && hasLinkedSaltTarget && saltLinkedAndConnected && saltApiReady && !actionsReadOnly;

  const openSaltConsole = useCallback(() => {
    if (!device || !computeAsset) {
      return false;
    }

    if (actionsReadOnly) {
      setError('This asset is retired. Remote actions are read-only until it is returned to an active lifecycle state.');
      setSuccessMessage('');
      return false;
    }

    const minionId = resolveSaltTarget(device);
    if (!minionId) {
      setError('Salt console is unavailable until this asset reports a Salt minion ID.');
      setSuccessMessage('');
      return false;
    }

    setEmbeddedConsole(buildEmbeddedSaltConsoleState({
      title: 'Salt Console',
      systemLabel: device.hostname,
      assetId: device.id,
      minionId,
      departmentName: device.department?.name,
      prefillCommand: buildSaltActionConsolePrefill(selectedSaltAction, customSaltInput, device.osName),
    }));
    return true;
  }, [actionsReadOnly, computeAsset, customSaltInput, device, selectedSaltAction, setEmbeddedConsole, setError, setSuccessMessage]);

  const handleRunPatch = useCallback(async () => {
    if (!device || !computeAsset) {
      return;
    }

    if (actionsReadOnly) {
      setError('This asset is retired. Remote actions are read-only until it is returned to an active lifecycle state.');
      setSuccessMessage('');
      return;
    }

    if (installConfigLoading) {
      setError('Checking Salt API availability...');
      setSuccessMessage('');
      return;
    }

    const validationError = saltActionInputError(selectedSaltAction, customSaltInput);
    if (validationError) {
      setError(validationError);
      setSuccessMessage('');
      return;
    }

    const minionId = resolveSaltTarget(device);
    if (!minionId) {
      setError('Salt console is unavailable until this asset reports a Salt minion ID.');
      setSuccessMessage('');
      return;
    }

    if (!saltTargetConnected(device)) {
      openSaltConsole();
      setError('The linked Salt minion is not currently connected to the master. The Salt console is open, but commands will stay disabled until it reconnects.');
      setSuccessMessage('');
      return;
    }

    if (!installConfig?.saltApiConfigured) {
      openSaltConsole();
      setError('The server Salt API is not reachable. The Salt console is open, but actions will stay disabled until the API is restored.');
      setSuccessMessage('');
      return;
    }

    try {
      setRunningPatch(true);
      setError('');
      setSuccessMessage('');
      const isSystemUpdate = isPatchReportableSaltAction(selectedSaltAction, customSaltInput);
      const requestedAt = new Date().toISOString();
      if (isSystemUpdate) {
        setPatchReport({
          ...createPatchRunProgressReport(device.hostname, requestedAt, 1),
          rows: [createPatchRunRunningEntry({ id: device.id, hostname: device.hostname, department: device.department })],
        });
      }
      const result = await apiRequest<PatchRunExecutionResponse>(`/api/assets/${device.id}/patch`, {
        method: 'POST',
        body: JSON.stringify(buildSaltActionRequest(selectedSaltAction, customSaltInput)),
      });
      await refreshSidebarData();
      if (isSystemUpdate) {
        const row = createPatchRunReportEntry({ id: device.id, hostname: device.hostname, department: device.department }, result);
        setPatchReport(createPatchRunReport(device.hostname, requestedAt, [row]));
      }
      setSuccessMessage(saltActionSuccessMessage(selectedSaltAction, result.status, device.hostname, false));
    } catch (requestError) {
      if (isPatchReportableSaltAction(selectedSaltAction, customSaltInput)) {
        const row = createPatchRunReportEntry({ id: device.id, hostname: device.hostname, department: device.department }, undefined, requestError);
        setPatchReport(createPatchRunReport(device.hostname, new Date().toISOString(), [row]));
      }
      setError(requestError instanceof Error ? requestError.message : 'Failed to run patch');
    } finally {
      setRunningPatch(false);
    }
  }, [actionsReadOnly, computeAsset, customSaltInput, device, installConfig?.saltApiConfigured, installConfigLoading, openSaltConsole, refreshSidebarData, selectedSaltAction, setError, setPatchReport, setRunningPatch, setSuccessMessage]);

  const handleStartTerminal = useCallback(async () => {
    if (!device || !computeAsset) {
      return;
    }

    if (actionsReadOnly) {
      setError('This asset is retired. Remote actions are read-only until it is returned to an active lifecycle state.');
      setSuccessMessage('');
      return;
    }

    try {
      setStartingTerminal(true);
      setError('');
      setSuccessMessage('');
      await apiRequest<{ connection?: { url?: string } }>('/api/ssh/session', {
        method: 'POST',
        body: JSON.stringify({ deviceId: device.id }),
      });
      setEmbeddedConsole({
        kind: 'ssh',
        title: 'SSH Terminal',
        subtitle: `${device.hostname} • ${sshTarget}`,
        assetId: device.id,
      });
      await refreshSidebarData();
      setSuccessMessage(`SSH terminal session started for ${device.hostname}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to start terminal session');
    } finally {
      setStartingTerminal(false);
    }
  }, [actionsReadOnly, computeAsset, device, refreshSidebarData, setEmbeddedConsole, setError, setStartingTerminal, setSuccessMessage, sshTarget]);

  const handleOpenMainSaltConsole = useCallback(() => {
    if (!openSaltConsole()) {
      return;
    }
    setError('');
    setSuccessMessage(`Salt console opened for ${device?.hostname || 'this asset'}.`);
  }, [device?.hostname, openSaltConsole, setError, setSuccessMessage]);

  const terminalBlockedReason = useMemo(() => (!canOperate || !computeAsset
    ? ''
    : actionsReadOnly
      ? 'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.'
    : installConfigLoading
      ? 'Checking SSH terminal availability...'
      : !sshTerminalReady
        ? 'SSH terminal sessions are unavailable until the server SSH username and private key are configured.'
        : ''), [actionsReadOnly, canOperate, computeAsset, installConfigLoading, sshTerminalReady]);

  const patchBlockedReason = useMemo(() => (!canOperate || !computeAsset
    ? ''
    : actionsReadOnly
      ? 'This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.'
    : !hasLinkedSaltTarget
      ? 'Salt console is unavailable until this asset reports a Salt minion ID.'
      : !saltLinkedAndConnected
        ? 'The linked Salt minion is not currently connected to the master. You can still open the Salt console, but command execution will stay disabled until it reconnects.'
        : installConfigLoading
          ? 'Checking Salt API availability...'
          : !saltApiReady
            ? 'The server Salt API is not reachable. You can still open the Salt console, but actions will not execute until the API is restored.'
            : ''), [actionsReadOnly, canOperate, computeAsset, hasLinkedSaltTarget, installConfigLoading, saltApiReady, saltLinkedAndConnected]);

  return {
    sshTerminalReady,
    sshTarget,
    canStartTerminal,
    canOpenPatchConsole,
    canRunPatch,
    patchActionButtonLabel: canRunPatch ? 'Run Salt Action' : 'Open Salt Console',
    terminalBlockedReason,
    patchBlockedReason,
    handleRunPatch,
    handleStartTerminal,
    handleOpenMainSaltConsole,
  };
}