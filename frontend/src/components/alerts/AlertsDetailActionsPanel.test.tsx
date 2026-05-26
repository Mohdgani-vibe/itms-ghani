import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsDetailActionsPanel } from './AlertsDetailActionsPanel';
import type { AlertsListRecord } from './types';

const alertRecord: AlertsListRecord = {
  id: 'alert-1',
  assetId: 'asset-1',
  assetTag: 'IT-001',
  assetName: 'Laptop',
  hostname: 'host-01',
  deviceId: 'asset-1',
  source: 'wazuh',
  severity: 'high',
  title: 'Wazuh finding',
  detail: 'A test finding',
  acknowledged: false,
  resolved: false,
  createdAt: '2026-04-25T12:00:00Z',
};

describe('AlertsDetailActionsPanel', () => {
  it('renders terminal blocked reason when SSH access is unavailable', () => {
    const markup = renderToStaticMarkup(
      <AlertsDetailActionsPanel
        selectedAlert={alertRecord}
        selectedAlertSource="wazuh"
        canAcknowledge={true}
        canResolve={true}
        detailActionLoading=""
        detailMessage={null}
        selectedAssetCanStartTerminal={false}
        selectedAssetCanOpenPatchConsole={false}
        selectedAssetCanRunPatch={false}
        terminalBlockedReason="SSH terminal sessions are unavailable until the server SSH username and private key are configured."
        patchBlockedReason="Salt console is unavailable until this asset reports a Salt minion ID."
        selectedSaltAction="system-update"
        customSaltInput=""
        selectedPatchActionLabel="Run Salt Action"
        onOpenAsset={() => {}}
        onStartTerminal={() => {}}
        onOpenSaltConsole={() => {}}
        onAcknowledge={() => {}}
        onResolve={() => {}}
        onRunPatch={() => {}}
        onSelectedSaltActionChange={() => {}}
        onCustomSaltInputChange={() => {}}
      />,
    );

    expect(markup).toContain('Terminal session unavailable');
    expect(markup).toContain('disabled');
    expect(markup).toContain('SSH terminal sessions are unavailable until the server SSH username and private key are configured.');
  });

  it('hides response actions for resolved alerts', () => {
    const markup = renderToStaticMarkup(
      <AlertsDetailActionsPanel
        selectedAlert={{
          ...alertRecord,
          acknowledged: true,
          resolved: true,
        }}
        selectedAlertSource="openscap"
        canAcknowledge={true}
        canResolve={true}
        detailActionLoading=""
        detailMessage={null}
        selectedAssetCanStartTerminal={true}
        selectedAssetCanOpenPatchConsole={true}
        selectedAssetCanRunPatch={true}
        terminalBlockedReason=""
        patchBlockedReason=""
        selectedSaltAction="system-update"
        customSaltInput=""
        selectedPatchActionLabel="Run Salt Action"
        onOpenAsset={() => {}}
        onStartTerminal={() => {}}
        onOpenSaltConsole={() => {}}
        onAcknowledge={() => {}}
        onResolve={() => {}}
        onRunPatch={() => {}}
        onSelectedSaltActionChange={() => {}}
        onCustomSaltInputChange={() => {}}
      />,
    );

    expect(markup).toContain('This alert is resolved. Response actions are read-only for closed findings.');
    expect(markup).not.toContain('Open SSH Terminal');
    expect(markup).not.toContain('Open Salt Console');
    expect(markup).not.toContain('Mark Resolved');
    expect(markup).not.toContain('Run Salt Action');
  });

  it('renders retired asset patch blocked reason', () => {
    const markup = renderToStaticMarkup(
      <AlertsDetailActionsPanel
        selectedAlert={{
          ...alertRecord,
          source: 'openscap',
        }}
        selectedAlertSource="openscap"
        canAcknowledge={true}
        canResolve={true}
        detailActionLoading=""
        detailMessage={null}
        selectedAssetCanStartTerminal={false}
        selectedAssetCanOpenPatchConsole={false}
        selectedAssetCanRunPatch={false}
        terminalBlockedReason="This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state."
        patchBlockedReason="This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state."
        selectedSaltAction="system-update"
        customSaltInput=""
        selectedPatchActionLabel="Run Salt Action"
        onOpenAsset={() => {}}
        onStartTerminal={() => {}}
        onOpenSaltConsole={() => {}}
        onAcknowledge={() => {}}
        onResolve={() => {}}
        onRunPatch={() => {}}
        onSelectedSaltActionChange={() => {}}
        onCustomSaltInputChange={() => {}}
      />,
    );

    expect(markup).toContain('This asset is retired. Salt actions are read-only until the asset returns to an active lifecycle state.');
    expect(markup).toContain('This asset is retired. SSH terminal access is read-only until the asset returns to an active lifecycle state.');
  });
});