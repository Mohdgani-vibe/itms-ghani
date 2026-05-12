import { useCallback } from 'react';

import { apiRequest } from '../../lib/api';
import type { EmbeddedConsoleState } from '../EmbeddedConsoleModal';
import { buildSaltActionConsolePrefill, buildSaltActionRequest, isPatchReportableSaltAction, saltActionInputError, saltActionSuccessMessage, type SaltActionValue } from '../../lib/salt';
import { createPatchRunProgressReport, createPatchRunReport, createPatchRunReportEntry, createPatchRunRunningEntry, type PatchRunExecutionResponse, type PatchRunReport } from '../../lib/patchReports';
import { hasSaltTarget, resolveSaltTarget, saltTargetConnected, type BootstrapDeviceLike } from '../../lib/bootstrap';
import type { AlertsListRecord, EmbeddedConsoleNavigationState, InstallAgentConfig } from './types';

interface AlertDeviceRecord extends BootstrapDeviceLike {
  id: string;
  status?: string | null;
}

function normalizeAlertSourceKey(value?: string | null) {
  const source = (value || '').trim().toLowerCase();
  if (source === 'open_scap' || source === 'hardening') {
    return 'openscap';
  }
  if (source === 'clam' || source === 'clamwin' || source === 'clamscan') {
    return 'clamav';
  }
  if (source === 'salt' || source === 'salt_patch' || source === 'patch') {
    return 'patch';
  }
  if (source === 'terminal_session') {
    return 'terminal';
  }
  return source;
}

export function alertsDetailAssetActionsReadOnly(deviceStatus?: string | null) {
  return (deviceStatus || '').trim().toLowerCase() === 'retired';
}

function alertsShareAsset(left: AlertsListRecord, right: AlertsListRecord) {
  if (left.assetId && right.assetId) {
    return left.assetId === right.assetId;
  }
  if (left.deviceId && right.deviceId) {
    return left.deviceId === right.deviceId;
  }
  if (left.hostname && right.hostname) {
    return left.hostname === right.hostname;
  }
  if (left.assetTag && right.assetTag) {
    return left.assetTag === right.assetTag;
  }
  return false;
}

export function resolveAlertConsoleNavigation(alert: AlertsListRecord, navigableAlerts: AlertsListRecord[]) {
  const currentIndex = navigableAlerts.findIndex((item) => item.id === alert.id);
  if (currentIndex >= 0) {
    return {
      items: navigableAlerts,
      index: currentIndex,
    };
  }

  const relatedAlerts = navigableAlerts.filter((item) => alertsShareAsset(item, alert));
  if (!relatedAlerts.length) {
    return null;
  }

  const relatedIndex = relatedAlerts.findIndex((item) => item.id === alert.id);
  if (relatedIndex >= 0) {
    return {
      items: relatedAlerts,
      index: relatedIndex,
    };
  }

  return {
    items: [alert, ...relatedAlerts.filter((item) => item.id !== alert.id)],
    index: 0,
  };
}

interface AlertsDetailWorkflowParams {
  canResolve: boolean;
  basePath: string;
  selectedAlert: AlertsListRecord | null;
  selectedDevice: AlertDeviceRecord | null;
  selectedDeviceLoading: boolean;
  selectedSaltAction: SaltActionValue;
  customSaltInput: string;
  navigableAlerts: AlertsListRecord[];
  installConfig: InstallAgentConfig | null;
  installConfigLoading: boolean;
  embeddedConsoleNavigation: EmbeddedConsoleNavigationState | null;
  setSelectedAlert: React.Dispatch<React.SetStateAction<AlertsListRecord | null>>;
  setSelectedDevice: React.Dispatch<React.SetStateAction<AlertDeviceRecord | null>>;
  setEmbeddedConsole: React.Dispatch<React.SetStateAction<EmbeddedConsoleState | null>>;
  setEmbeddedConsoleNavigation: React.Dispatch<React.SetStateAction<EmbeddedConsoleNavigationState | null>>;
  setDetailMessage: React.Dispatch<React.SetStateAction<{ tone: 'success' | 'error'; text: string } | null>>;
  setDetailActionLoading: React.Dispatch<React.SetStateAction<string>>;
  setPatchReport: React.Dispatch<React.SetStateAction<PatchRunReport | null>>;
  navigate: (to: string) => void;
  renderSystemName: (alert: AlertsListRecord) => string;
}

export function useAlertsDetailWorkflow({
  canResolve,
  basePath,
  selectedAlert,
  selectedDevice,
  selectedDeviceLoading,
  selectedSaltAction,
  customSaltInput,
  navigableAlerts,
  installConfig,
  installConfigLoading,
  embeddedConsoleNavigation,
  setSelectedAlert,
  setSelectedDevice,
  setEmbeddedConsole,
  setEmbeddedConsoleNavigation,
  setDetailMessage,
  setDetailActionLoading,
  setPatchReport,
  navigate,
  renderSystemName,
}: AlertsDetailWorkflowParams) {
  const selectedAlertSource = normalizeAlertSourceKey(selectedAlert?.source);
  const actionsReadOnly = alertsDetailAssetActionsReadOnly(selectedDevice?.status);
  const selectedAssetHasSaltTarget = hasSaltTarget(selectedDevice);
  const selectedAssetSaltConnected = saltTargetConnected(selectedDevice);
  const selectedAssetCanStartTerminal = canResolve && Boolean(selectedAlert?.assetId) && !installConfigLoading && Boolean(installConfig?.sshConfigured) && !actionsReadOnly;
  const selectedAssetCanOpenPatchConsole = canResolve && Boolean(selectedAlert?.assetId) && selectedAssetHasSaltTarget && !installConfigLoading && !actionsReadOnly;
  const selectedAssetCanRunPatch = canResolve && Boolean(selectedAlert?.assetId) && selectedAssetHasSaltTarget && selectedAssetSaltConnected && Boolean(installConfig?.saltApiConfigured) && !actionsReadOnly;

  const handleOpenAsset = useCallback(() => {
    if (!selectedAlert?.assetId) {
      return;
    }

    const sectionHash = selectedAlertSource === 'clamav'
      ? '#clamav'
      : selectedAlertSource === 'wazuh'
        ? '#security'
        : selectedAlertSource === 'openscap'
          ? (selectedAssetCanRunPatch ? '#updates-salt' : '#openscap')
          : '';

    navigate(`${basePath}/devices/${selectedAlert.assetId}${sectionHash}`);
  }, [basePath, navigate, selectedAlert, selectedAlertSource, selectedAssetCanRunPatch]);

  const loadDeviceForAlert = useCallback(async (alert: AlertsListRecord) => {
    if (!alert.assetId) {
      return null;
    }

    const data = await apiRequest<AlertDeviceRecord>(`/api/devices/${alert.assetId}`);
    return data;
  }, []);

  const openAlertSshConsole = useCallback(async (alert: AlertsListRecord, items?: AlertsListRecord[], index?: number) => {
    if (!alert.assetId || !canResolve) {
      return false;
    }

    if (actionsReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Remote actions are read-only until the asset returns to an active lifecycle state.' });
      return false;
    }

    await apiRequest<{ connection?: { url?: string } }>('/api/ssh/session', {
      method: 'POST',
      body: JSON.stringify({ deviceId: alert.assetId }),
    });

    setSelectedAlert(alert);
    setEmbeddedConsole({
      kind: 'ssh',
      title: 'SSH Terminal',
      subtitle: renderSystemName(alert),
      assetId: alert.assetId,
    });
    setEmbeddedConsoleNavigation(items && typeof index === 'number' ? { kind: 'ssh', items, index } : null);
    return true;
  }, [actionsReadOnly, canResolve, renderSystemName, setDetailMessage, setEmbeddedConsole, setEmbeddedConsoleNavigation, setSelectedAlert]);

  const openAlertSaltConsole = useCallback(async (alert: AlertsListRecord, items?: AlertsListRecord[], index?: number, prefilledCommand?: string) => {
    if (!alert.assetId || !canResolve) {
      return false;
    }

    if (actionsReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Remote actions are read-only until the asset returns to an active lifecycle state.' });
      return false;
    }

    const device = await loadDeviceForAlert(alert);
    if (!device) {
      return false;
    }

    const minionId = resolveSaltTarget(device);
    if (!minionId) {
      setDetailMessage({ tone: 'error', text: 'Salt console is unavailable until this asset reports a Salt minion ID.' });
      return false;
    }

    const effectivePrefill = prefilledCommand || buildSaltActionConsolePrefill(selectedSaltAction, customSaltInput, device.osName);
    setSelectedAlert(alert);
    setSelectedDevice(device);
    setEmbeddedConsole({
      kind: 'salt',
      title: 'Salt Console',
      subtitle: `${renderSystemName(alert)} • ${minionId}`,
      minionId,
      prefillCommand: effectivePrefill,
    });
    setEmbeddedConsoleNavigation(items && typeof index === 'number' ? { kind: 'salt', items, index, prefilledCommand: effectivePrefill } : null);
    return true;
  }, [actionsReadOnly, canResolve, customSaltInput, loadDeviceForAlert, renderSystemName, selectedSaltAction, setDetailMessage, setEmbeddedConsole, setEmbeddedConsoleNavigation, setSelectedAlert, setSelectedDevice]);

  const navigateEmbeddedConsole = useCallback(async (offset: number) => {
    if (!embeddedConsoleNavigation) {
      return;
    }

    const nextIndex = embeddedConsoleNavigation.index + offset;
    if (nextIndex < 0 || nextIndex >= embeddedConsoleNavigation.items.length) {
      return;
    }

    const nextAlert = embeddedConsoleNavigation.items[nextIndex];
    if (!nextAlert) {
      return;
    }

    try {
      setDetailMessage(null);
      if (embeddedConsoleNavigation.kind === 'ssh') {
        await openAlertSshConsole(nextAlert, embeddedConsoleNavigation.items, nextIndex);
        return;
      }

      await openAlertSaltConsole(nextAlert, embeddedConsoleNavigation.items, nextIndex, embeddedConsoleNavigation.prefilledCommand);
    } catch (requestError) {
      setDetailMessage({ tone: 'error', text: requestError instanceof Error ? requestError.message : 'Failed to move to the selected asset console' });
    }
  }, [embeddedConsoleNavigation, openAlertSaltConsole, openAlertSshConsole, setDetailMessage]);

  const handleStartTerminal = useCallback(async () => {
    if (!selectedAlert?.assetId || !canResolve) {
      return;
    }
    if (actionsReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Remote actions are read-only until the asset returns to an active lifecycle state.' });
      return;
    }
    if (installConfigLoading) {
      setDetailMessage({ tone: 'error', text: 'Checking SSH terminal availability...' });
      return;
    }
    if (!installConfig?.sshConfigured) {
      setDetailMessage({ tone: 'error', text: 'SSH terminal sessions are unavailable until the server SSH username and private key are configured.' });
      return;
    }

    try {
      setDetailActionLoading('terminal');
      setDetailMessage(null);
      const navigation = resolveAlertConsoleNavigation(selectedAlert, navigableAlerts);
      await openAlertSshConsole(selectedAlert, navigation?.items, navigation?.index);
      setDetailMessage({ tone: 'success', text: `SSH terminal session started for ${renderSystemName(selectedAlert)}.` });
    } catch (requestError) {
      setDetailMessage({ tone: 'error', text: requestError instanceof Error ? requestError.message : 'Failed to start terminal session' });
    } finally {
      setDetailActionLoading('');
    }
  }, [actionsReadOnly, canResolve, installConfig?.sshConfigured, installConfigLoading, navigableAlerts, openAlertSshConsole, renderSystemName, selectedAlert, setDetailActionLoading, setDetailMessage]);

  const openSaltConsole = useCallback(async () => {
    if (!selectedAlert?.assetId || !canResolve) {
      return false;
    }

    const navigation = resolveAlertConsoleNavigation(selectedAlert, navigableAlerts);
    return openAlertSaltConsole(
      selectedAlert,
      navigation?.items,
      navigation?.index,
      buildSaltActionConsolePrefill(selectedSaltAction, customSaltInput, selectedDevice?.osName),
    );
  }, [canResolve, customSaltInput, navigableAlerts, openAlertSaltConsole, selectedAlert, selectedDevice?.osName, selectedSaltAction]);

  const handleRunPatch = useCallback(async () => {
    if (!selectedAlert?.assetId || !canResolve) {
      return;
    }
    if (actionsReadOnly) {
      setDetailMessage({ tone: 'error', text: 'This asset is retired. Remote actions are read-only until the asset returns to an active lifecycle state.' });
      return;
    }
    if (installConfigLoading) {
      setDetailMessage({ tone: 'error', text: 'Checking Salt API availability...' });
      return;
    }
    const validationError = saltActionInputError(selectedSaltAction, customSaltInput);
    if (validationError) {
      setDetailMessage({ tone: 'error', text: validationError });
      return;
    }
    const minionId = resolveSaltTarget(selectedDevice);

    if (!minionId) {
      setDetailMessage({ tone: 'error', text: 'Salt console is unavailable until this asset reports a Salt minion ID.' });
      return;
    }

    if (!selectedAssetSaltConnected) {
      await openSaltConsole();
      setDetailMessage({ tone: 'error', text: 'The linked Salt minion is not currently connected to the master. The Salt console is open, but commands will stay disabled until it reconnects.' });
      return;
    }

    if (!installConfig?.saltApiConfigured) {
      await openSaltConsole();
      setDetailMessage({ tone: 'error', text: 'The server Salt API is not reachable. The Salt console is open, but actions will stay disabled until the API is restored.' });
      return;
    }

    try {
      setDetailActionLoading('patch');
      setDetailMessage(null);
      const isSystemUpdate = isPatchReportableSaltAction(selectedSaltAction, customSaltInput);
      const reportDevice = {
        id: selectedAlert.assetId,
        hostname: renderSystemName(selectedAlert),
        department: selectedDevice?.department?.name ? { name: selectedDevice.department.name } : null,
      };
      const requestedAt = new Date().toISOString();
      if (isSystemUpdate) {
        setPatchReport({
          ...createPatchRunProgressReport(renderSystemName(selectedAlert), requestedAt, 1),
          rows: [createPatchRunRunningEntry(reportDevice)],
        });
      }
      const result = await apiRequest<PatchRunExecutionResponse>(`/api/assets/${selectedAlert.assetId}/patch`, {
        method: 'POST',
        body: JSON.stringify(buildSaltActionRequest(selectedSaltAction, customSaltInput)),
      });
      if (isSystemUpdate) {
        const row = createPatchRunReportEntry(reportDevice, result);
        setPatchReport(createPatchRunReport(renderSystemName(selectedAlert), requestedAt, [row]));
      }
      setDetailMessage({ tone: 'success', text: saltActionSuccessMessage(selectedSaltAction, result.status, renderSystemName(selectedAlert), false) });
    } catch (requestError) {
      if (isPatchReportableSaltAction(selectedSaltAction, customSaltInput) && selectedAlert?.assetId) {
        const row = createPatchRunReportEntry({
          id: selectedAlert.assetId,
          hostname: renderSystemName(selectedAlert),
          department: selectedDevice?.department?.name ? { name: selectedDevice.department.name } : null,
        }, undefined, requestError);
        setPatchReport(createPatchRunReport(renderSystemName(selectedAlert), new Date().toISOString(), [row]));
      }
      setDetailMessage({ tone: 'error', text: requestError instanceof Error ? requestError.message : 'Failed to run patch' });
    } finally {
      setDetailActionLoading('');
    }
  }, [actionsReadOnly, canResolve, customSaltInput, installConfig?.saltApiConfigured, installConfigLoading, openSaltConsole, renderSystemName, selectedAlert, selectedAssetSaltConnected, selectedDevice, selectedSaltAction, setDetailActionLoading, setDetailMessage, setPatchReport]);

  const handleOpenAlertSaltConsole = useCallback(async () => {
    if (!await openSaltConsole()) {
      return;
    }
    setDetailMessage({ tone: 'success', text: `Salt console opened for ${selectedAlert ? renderSystemName(selectedAlert) : 'the selected asset'}.` });
  }, [openSaltConsole, renderSystemName, selectedAlert, setDetailMessage]);

  return {
    handleOpenAsset,
    navigateEmbeddedConsole,
    handleStartTerminal,
    handleRunPatch,
    handleOpenAlertSaltConsole,
    selectedAlertSource,
    selectedAssetCanStartTerminal,
    selectedAssetHasSaltTarget,
    selectedAssetSaltConnected,
    selectedAssetCanOpenPatchConsole,
    selectedAssetCanRunPatch,
    selectedPatchActionLabel: 'Run Salt Action',
    terminalBlockedReason: !canResolve || !selectedAlert?.assetId
      ? ''
      : actionsReadOnly
        ? 'This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.'
      : installConfigLoading
        ? 'Checking SSH terminal availability...'
        : !installConfig?.sshConfigured
          ? 'SSH terminal sessions are unavailable until the server SSH username and private key are configured.'
          : '',
    patchBlockedReason: !canResolve || !selectedAlert?.assetId
      ? ''
      : actionsReadOnly
        ? 'This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.'
        : selectedDeviceLoading || installConfigLoading
          ? 'Checking Salt availability for this asset...'
          : selectedAssetHasSaltTarget
            ? !selectedAssetSaltConnected
              ? 'The linked Salt minion is not currently connected to the master. You can still open the Salt console, but command execution will stay disabled until it reconnects.'
              : !installConfig?.saltApiConfigured
                ? 'The server Salt API is not reachable. You can still open the Salt console, but actions will stay disabled until the API is restored.'
                : ''
            : 'Salt console is unavailable until this asset reports a Salt minion ID.',
    setSelectedDevice,
    selectedDeviceLoading,
  };
}