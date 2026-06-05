// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SettingsBootstrapSection from './SettingsBootstrapSection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderSection(props?: Partial<React.ComponentProps<typeof SettingsBootstrapSection>>) {
  const onIncludeLinuxHardinfoFallbackChange = vi.fn();
  const onCopyCommand = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <SettingsBootstrapSection
        includeLinuxHardinfoFallback={true}
        copyStatus=""
        linuxBootstrapCommand="curl -fsSL https://portal.example.com/install.sh | bash"
        windowsBootstrapCommand="powershell -File install.ps1"
        linuxSyncCommand="itms-sync --linux"
        windowsSyncCommand="powershell -File sync.ps1"
        onIncludeLinuxHardinfoFallbackChange={onIncludeLinuxHardinfoFallbackChange}
        onCopyCommand={onCopyCommand}
        {...props}
      />,
    );
  });
  await flushEffects();

  return {
    container,
    onIncludeLinuxHardinfoFallbackChange,
    onCopyCommand,
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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SettingsBootstrapSection', () => {
  it('renders bootstrap commands, fallback toggle, and copy state labels', () => {
    const markup = renderToStaticMarkup(
      <SettingsBootstrapSection
        includeLinuxHardinfoFallback={true}
        copyStatus="linux"
        linuxBootstrapCommand="curl -fsSL https://portal.example.com/install.sh | bash"
        windowsBootstrapCommand="powershell -File install.ps1"
        linuxSyncCommand="itms-sync --linux"
        windowsSyncCommand="powershell -File sync.ps1"
        onIncludeLinuxHardinfoFallbackChange={vi.fn()}
        onCopyCommand={vi.fn()}
      />,
    );

    expect(markup).toContain('Bootstrap Commands');
    expect(markup).toContain('Endpoint setup commands built from the current platform configuration.');
    expect(markup).toContain('Include Linux hardinfo fallback');
    expect(markup).toContain('Controls whether the generic Linux install and sync commands include');
    expect(markup).toContain('Linux Install Code');
    expect(markup).toContain('Ubuntu, Debian, Fedora, CentOS, or RHEL install + first sync');
    expect(markup).toContain('supports both apt-based and dnf or yum-based Linux bootstrap flows');
    expect(markup).toContain('curl -fsSL https://portal.example.com/install.sh | bash');
    expect(markup).toContain('Linux Sync Code');
    expect(markup).toContain('itms-sync --linux');
    expect(markup).toContain('Windows Install Code');
    expect(markup).toContain('powershell -File install.ps1');
    expect(markup).toContain('Windows Sync Code');
    expect(markup).toContain('powershell -File sync.ps1');
    expect(markup).toContain('Copied');
  });

  it('wires the fallback toggle and copy buttons to the expected handlers', async () => {
    const view = await renderSection({ includeLinuxHardinfoFallback: true });

    const checkbox = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    await clickElement(checkbox!);

    expect(view.onIncludeLinuxHardinfoFallbackChange).toHaveBeenCalledWith(false);

    const buttons = Array.from(view.container.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(4);

    await clickElement(buttons[0]);
    await clickElement(buttons[1]);
    await clickElement(buttons[2]);
    await clickElement(buttons[3]);

    expect(view.onCopyCommand).toHaveBeenNthCalledWith(1, 'linux', 'curl -fsSL https://portal.example.com/install.sh | bash');
    expect(view.onCopyCommand).toHaveBeenNthCalledWith(2, 'linux-sync', 'itms-sync --linux');
    expect(view.onCopyCommand).toHaveBeenNthCalledWith(3, 'windows', 'powershell -File install.ps1');
    expect(view.onCopyCommand).toHaveBeenNthCalledWith(4, 'windows-sync', 'powershell -File sync.ps1');

    await view.cleanup();
  });
});