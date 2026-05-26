import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EmbeddedConsoleModal from './EmbeddedConsoleModal';
import { buildEmbeddedSaltConsoleState } from './embeddedConsoleModalUtils';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock('./SshTerminalView', () => ({
  default: ({ assetId }: { assetId: string }) => <div>SSH view for {assetId}</div>,
}));

vi.mock('./TerminalConsoleView', () => ({
  default: ({ minionId, prefilledCommand }: { minionId: string; prefilledCommand?: string }) => (
    <div>
      Salt view for {minionId}
      {prefilledCommand ? ` with ${prefilledCommand}` : ''}
    </div>
  ),
}));

describe('EmbeddedConsoleModal', () => {
  afterEach(() => {
    // Keep the component on the same code path it expects when mounted in the browser.
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('renders nothing when no console state is present', () => {
    const markup = renderToStaticMarkup(
      <EmbeddedConsoleModal consoleState={null} titleId="embedded-console-title" onClose={vi.fn()} />,
    );

    expect(markup).toBe('');
  });

  it('builds Salt console state with a fallback department label', () => {
    expect(buildEmbeddedSaltConsoleState({
      title: 'Salt Console',
      systemLabel: 'ops-node-01',
      assetId: 'asset-7',
      minionId: 'minion-7',
    })).toEqual({
      kind: 'salt',
      title: 'Salt Console',
      subtitle: 'ops-node-01 • Unassigned department • Asset ID asset-7',
      assetId: 'asset-7',
      departmentName: 'Unassigned department',
      minionId: 'minion-7',
      prefillCommand: undefined,
    });
  });

  it('renders the SSH workspace shell', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <EmbeddedConsoleModal
        consoleState={{
          kind: 'ssh',
          title: 'Laptop SSH Session',
          subtitle: 'asset-001',
          assetId: 'asset-001',
        }}
        titleId="embedded-console-title"
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('SSH Terminal');
    expect(markup).toContain('Laptop SSH Session');
    expect(markup).toContain('Secure Device Access');
    expect(markup).toContain('SSH view for asset-001');
    expect(markup).toContain('Close');
  });

  it('renders the Salt workspace shell and navigation controls', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <EmbeddedConsoleModal
        consoleState={{
          kind: 'salt',
          title: 'Patch Console',
          subtitle: 'asset-22 • Finance • Asset ID asset-22',
          assetId: 'asset-22',
          departmentName: 'Finance',
          minionId: 'minion-22',
          prefillCommand: 'state.apply patch.run',
        }}
        titleId="embedded-console-title"
        navigation={{
          index: 1,
          total: 3,
          onPrevious: vi.fn(),
          onNext: vi.fn(),
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Salt Console');
    expect(markup).toContain('Patch Console');
    expect(markup).toContain('Live Salt Command Session');
    expect(markup).toContain('Asset ID asset-22');
    expect(markup).toContain('Department Finance');
    expect(markup).toContain('Salt Target minion-22');
    expect(markup).toContain('2 of 3');
    expect(markup).toContain('Alt+Shift+Left/Right');
    expect(markup).toContain('Salt view for minion-22 with state.apply patch.run');
    expect(markup).toContain('Prev');
    expect(markup).toContain('Next');
  });

  it('renders a loading shell while the next Salt target is being prepared', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <EmbeddedConsoleModal
        consoleState={{
          kind: 'salt-loading',
          title: 'Salt Console',
          subtitle: 'spare-ho • loading target',
        }}
        titleId="embedded-console-title"
        navigation={{
          index: 1,
          total: 4,
          onPrevious: vi.fn(),
          onNext: vi.fn(),
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Salt Console');
    expect(markup).toContain('Preparing Salt Target');
    expect(markup).toContain('Loading Salt Target');
    expect(markup).toContain('Preparing console session for the selected device.');
  });
});