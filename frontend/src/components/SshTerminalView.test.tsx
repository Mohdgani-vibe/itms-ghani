import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  resolveWebSocketUrl: vi.fn((path: string) => path),
}));

vi.mock('../lib/session', () => ({
  getStoredSession: vi.fn(() => ({ token: 'token' })),
}));

vi.mock('xterm', () => ({
  Terminal: class {},
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {},
}));

import SshTerminalView from './SshTerminalView';

describe('SshTerminalView', () => {
  it('renders the standalone SSH terminal loading shell and session guidance', () => {
    const markup = renderToStaticMarkup(<SshTerminalView assetId="asset-1" onBack={vi.fn()} />);

    expect(markup).toContain('SSH Terminal');
    expect(markup).toContain('Asset pending');
    expect(markup).toContain('Connecting...');
    expect(markup).toContain('Reconnect');
    expect(markup).toContain('Back');
    expect(markup).toContain('SSH Session');
    expect(markup).toContain('Server-side SSH with shared key authentication.');
    expect(markup).toContain('Interactive PTY shell streamed over websocket.');
  });

  it('renders the embedded SSH terminal chrome without the standalone sidebar', () => {
    const markup = renderToStaticMarkup(<SshTerminalView assetId="asset-1" embedded />);

    expect(markup).toContain('SSH Terminal');
    expect(markup).toContain('Asset pending');
    expect(markup).toContain('Reconnect');
    expect(markup).not.toContain('SSH Session');
    expect(markup).not.toContain('Back');
  });
});