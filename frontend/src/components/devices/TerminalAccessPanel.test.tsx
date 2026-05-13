import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import TerminalAccessPanel from './TerminalAccessPanel';

describe('TerminalAccessPanel', () => {
  it('renders terminal actions, blocked reason, and session history', () => {
    const markup = renderToStaticMarkup(
      <TerminalAccessPanel
        canOperate={true}
        canStartTerminal={false}
        startingTerminal={false}
        terminalBlockedReason="SSH terminal sessions are unavailable until the server SSH username and private key are configured."
        sidebarLoading={false}
        terminalSessions={[
          { id: 'session-1', status: 'completed', createdAt: '2026-05-08T09:00:00Z', requestedBy: 'IT Owner' },
        ]}
        onStartTerminal={() => {}}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('SSH Terminal');
    expect(markup).toContain('Open an SSH terminal for this asset and review recent session history.');
    expect(markup).toContain('Open SSH Terminal');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('SSH terminal sessions are unavailable until the server SSH username and private key are configured.');
    expect(markup).toContain('completed');
    expect(markup).toContain('IT Owner • 08 May 2026');
  });

  it('renders loading and empty history states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <TerminalAccessPanel
        canOperate={false}
        canStartTerminal={false}
        startingTerminal={false}
        terminalBlockedReason={null}
        sidebarLoading={true}
        terminalSessions={[]}
        onStartTerminal={() => {}}
        formatDate={() => '08 May 2026'}
      />,
    );

    const emptyMarkup = renderToStaticMarkup(
      <TerminalAccessPanel
        canOperate={false}
        canStartTerminal={false}
        startingTerminal={false}
        terminalBlockedReason={null}
        sidebarLoading={false}
        terminalSessions={[]}
        onStartTerminal={() => {}}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(loadingMarkup).toContain('Loading sessions...');
    expect(emptyMarkup).toContain('No terminal sessions recorded for this asset.');
  });
});