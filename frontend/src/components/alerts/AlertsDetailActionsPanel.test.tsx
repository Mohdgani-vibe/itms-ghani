// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderPanel() {
  const onOpenAsset = vi.fn();
  const onStartTerminal = vi.fn();
  const onOpenSaltConsole = vi.fn();
  const onAcknowledge = vi.fn();
  const onResolve = vi.fn();
  const onRunPatch = vi.fn();
  const onSelectedSaltActionChange = vi.fn();
  const onCustomSaltInputChange = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
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
        selectedAssetCanStartTerminal={true}
        selectedAssetCanOpenPatchConsole={true}
        selectedAssetCanRunPatch={true}
        terminalBlockedReason=""
        patchBlockedReason=""
        selectedSaltAction="custom-command"
        customSaltInput="openssl"
        selectedPatchActionLabel="Run Salt Action"
        onOpenAsset={onOpenAsset}
        onStartTerminal={onStartTerminal}
        onOpenSaltConsole={onOpenSaltConsole}
        onAcknowledge={onAcknowledge}
        onResolve={onResolve}
        onRunPatch={onRunPatch}
        onSelectedSaltActionChange={onSelectedSaltActionChange}
        onCustomSaltInputChange={onCustomSaltInputChange}
      />,
    );
  });
  await flushEffects();

  return {
    container,
    onOpenAsset,
    onStartTerminal,
    onOpenSaltConsole,
    onAcknowledge,
    onResolve,
    onRunPatch,
    onSelectedSaltActionChange,
    onCustomSaltInputChange,
    cleanup: async () => {
      if (root) {
        await act(async () => {
          root!.unmount();
        });
      }
      container.remove();
    },
  };
}

async function clickElement(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
  await flushEffects();
}

async function changeSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

afterEach(() => {
  document.body.innerHTML = '';
});

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

  it('wires actionable openscap controls and Salt remediation inputs', async () => {
    const view = await renderPanel();

    const buttons = Array.from(view.container.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Open Asset',
      'Open SSH Terminal',
      'Open Salt Console',
      'Acknowledge',
      'Mark Resolved',
      'Run Salt Action',
    ]);

    await clickElement(buttons[0]);
    await clickElement(buttons[1]);
    await clickElement(buttons[2]);
    await clickElement(buttons[3]);
    await clickElement(buttons[4]);

    const selects = Array.from(view.container.querySelectorAll('select')) as HTMLSelectElement[];
    expect(selects).toHaveLength(1);
    await changeSelectValue(selects[0], 'custom-state');

    const input = view.container.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    await setInputValue(input!, 'patch.openscap');

    await clickElement(buttons[5]);

    expect(view.onOpenAsset).toHaveBeenCalledTimes(1);
    expect(view.onStartTerminal).toHaveBeenCalledTimes(1);
    expect(view.onOpenSaltConsole).toHaveBeenCalledTimes(1);
    expect(view.onAcknowledge).toHaveBeenCalledWith('alert-1');
    expect(view.onResolve).toHaveBeenCalledWith('alert-1');
    expect(view.onSelectedSaltActionChange).toHaveBeenCalledWith('custom-state');
    expect(view.onCustomSaltInputChange).toHaveBeenCalledWith('patch.openscap');
    expect(view.onRunPatch).toHaveBeenCalledTimes(1);

    await view.cleanup();
  });
});