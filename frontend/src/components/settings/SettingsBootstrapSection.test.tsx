import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsBootstrapSection from './SettingsBootstrapSection';

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
    expect(markup).toContain('Ubuntu or Debian install + first sync');
    expect(markup).toContain('curl -fsSL https://portal.example.com/install.sh | bash');
    expect(markup).toContain('Linux Sync Code');
    expect(markup).toContain('itms-sync --linux');
    expect(markup).toContain('Windows Install Code');
    expect(markup).toContain('powershell -File install.ps1');
    expect(markup).toContain('Windows Sync Code');
    expect(markup).toContain('powershell -File sync.ps1');
    expect(markup).toContain('Copied');
  });
});