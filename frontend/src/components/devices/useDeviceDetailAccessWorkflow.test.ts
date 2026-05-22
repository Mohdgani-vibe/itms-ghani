import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../EmbeddedConsoleModal', () => ({
  buildEmbeddedSaltConsoleState: ({
    title,
    systemLabel,
    assetId,
    minionId,
    departmentName,
    prefillCommand,
  }: {
    title: string;
    systemLabel: string;
    assetId: string;
    minionId: string;
    departmentName?: string | null;
    prefillCommand?: string;
  }) => ({
    kind: 'salt',
    title,
    subtitle: `${systemLabel} • ${departmentName?.trim() || 'Unassigned department'} • Asset ID ${assetId}`,
    assetId,
    departmentName: departmentName?.trim() || 'Unassigned department',
    minionId,
    prefillCommand,
  }),
}));

import { useDeviceDetailAccessWorkflow, deviceDetailAccessActionsReadOnly } from './useDeviceDetailAccessWorkflow';

let capturedWorkflow: { handleOpenMainSaltConsole: () => void } | null = null;

function WorkflowHarness() {
  capturedWorkflow = useDeviceDetailAccessWorkflow({
    device: {
      id: 'asset-9',
      hostname: 'ops-terminal-09',
      status: 'active',
      osName: 'Ubuntu 24.04',
      saltMinionId: 'minion-09',
      department: { name: 'IT Operations' },
    },
    computeAsset: true,
    canOperate: true,
    installConfig: { saltApiConfigured: true, sshConfigured: true },
    installConfigLoading: false,
    selectedSaltAction: 'system-update',
    customSaltInput: '',
    setError: vi.fn(),
    setSuccessMessage: vi.fn(),
    setRunningPatch: vi.fn(),
    setStartingTerminal: vi.fn(),
    setEmbeddedConsole: embeddedConsoleSetter,
    setPatchReport: vi.fn(),
    refreshSidebarData: vi.fn(async () => {}),
  });

  return null;
}

const embeddedConsoleSetter = vi.fn();

describe('deviceDetailAccessActionsReadOnly', () => {
  it('fails closed for retired assets', () => {
    expect(deviceDetailAccessActionsReadOnly('retired')).toBe(true);
  });

  it('keeps active in-use assets operable', () => {
    expect(deviceDetailAccessActionsReadOnly('in_use')).toBe(false);
  });
});

describe('useDeviceDetailAccessWorkflow', () => {
  it('opens the Salt console with shared asset and department context', () => {
    embeddedConsoleSetter.mockReset();
    capturedWorkflow = null;

    renderToStaticMarkup(createElement(WorkflowHarness));

    if (!capturedWorkflow) {
      throw new Error('workflow was not captured');
    }

    (capturedWorkflow as { handleOpenMainSaltConsole: () => void }).handleOpenMainSaltConsole();

    expect(embeddedConsoleSetter).toHaveBeenCalledWith({
      kind: 'salt',
      title: 'Salt Console',
      subtitle: 'ops-terminal-09 • IT Operations • Asset ID asset-9',
      assetId: 'asset-9',
      departmentName: 'IT Operations',
      minionId: 'minion-09',
      prefillCommand: 'state.apply patch.run',
    });
  });
});