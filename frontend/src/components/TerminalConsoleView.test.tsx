import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stateQueue: unknown[] = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: () => {},
    useMemo: <T,>(factory: () => T) => factory(),
    useRef: () => ({ current: null }),
    useState: <T,>(initialValue: T) => {
      const value = stateQueue.length > 0 ? stateQueue.shift() as T : initialValue;
      return [value, vi.fn()] as const;
    },
  };
});

vi.mock('./PatchRunReportModal', () => ({
  default: () => null,
}));

import TerminalConsoleView from './TerminalConsoleView';

function queueTerminalState(overrides: {
  target?: unknown;
  loading?: boolean;
  running?: boolean;
  command?: string;
  entries?: unknown[];
  history?: string[];
  historyIndex?: number;
  error?: string;
  patchReport?: unknown;
  targetReloadNonce?: number;
} = {}) {
  stateQueue.splice(0, stateQueue.length, ...[
    overrides.target ?? null,
    overrides.loading ?? true,
    overrides.running ?? false,
    overrides.command ?? '',
    overrides.entries ?? [],
    overrides.history ?? [],
    overrides.historyIndex ?? -1,
    overrides.error ?? '',
    overrides.patchReport ?? null,
    overrides.targetReloadNonce ?? 0,
  ]);
}

describe('TerminalConsoleView', () => {
  beforeEach(() => {
    stateQueue.splice(0, stateQueue.length);
  });

  it('renders the disconnected target warnings, policy details, and recent history', () => {
    queueTerminalState({
      target: {
        assetId: 'asset-1',
        assetName: 'Ops Workstation',
        hostname: 'ops-minion-01',
        assetTag: 'AST-001',
        departmentName: 'IT Operations',
        locationName: 'Bangalore HQ',
        minionId: 'minion-01',
        connected: false,
        policy: {
          allowedCommands: ['hostname', 'uptime'],
          presetCommands: ['hostname'],
          presetGroups: [{ label: 'System', commands: ['hostname'] }],
          blockedExamples: ['rm -rf /tmp/demo'],
          restrictions: ['Only approved read-only diagnostic commands are allowed.'],
        },
      },
      loading: false,
      history: ['uptime', 'hostname'],
    });

    const markup = renderToStaticMarkup(<TerminalConsoleView minionId="minion-01" />);

    expect(markup).toContain('Terminal Console');
    expect(markup).toContain('Ops Workstation');
    expect(markup).toContain('ops-minion-01');
    expect(markup).toContain('Asset ID asset-1');
    expect(markup).toContain('Department');
    expect(markup).toContain('IT Operations');
    expect(markup).toContain('Location');
    expect(markup).toContain('Bangalore HQ');
    expect(markup).toContain('Disconnected');
    expect(markup).toContain('Salt target offline. Execution is disabled until the minion reconnects to the master.');
    expect(markup).toContain('Allowed Tools');
    expect(markup).toContain('hostname, uptime');
    expect(markup).toContain('Blocked Examples');
    expect(markup).toContain('rm -rf /tmp/demo');
    expect(markup).toContain('Recent Commands');
    expect(markup).toContain('Target is not connected');
  });

  it('renders command output entries and actionable error hints for blocked commands', () => {
    queueTerminalState({
      target: {
        assetId: 'asset-2',
        assetName: 'Ops Laptop',
        hostname: 'ops-minion-02',
        assetTag: 'AST-002',
        departmentName: 'Security',
        locationName: 'Chennai Office',
        minionId: 'minion-02',
        connected: true,
        policy: {
          allowedCommands: [],
          presetCommands: [],
          restrictions: [],
        },
      },
      loading: false,
      command: 'systemctl restart salt-minion',
      entries: [
        {
          id: 'entry-1',
          createdAt: '2026-05-08T10:00:00Z',
          command: 'hostname',
          stdout: 'ops-minion-02',
          stderr: '',
          retcode: 0,
        },
      ],
      error: 'only read-only systemctl commands are allowed',
    });

    const markup = renderToStaticMarkup(<TerminalConsoleView minionId="minion-02" embedded />);

    expect(markup).toContain('Connected');
  expect(markup).toContain('Asset ID asset-2');
  expect(markup).toContain('Security');
    expect(markup).toContain('ops-minion-02$ hostname');
    expect(markup).toContain('ops-minion-02');
    expect(markup).toContain('exit code: 0');
    expect(markup).toContain('only read-only systemctl commands are allowed');
    expect(markup).toContain('Use systemctl status, show, list-units, or list-unit-files. Restart, stop, enable, and other mutating actions are blocked.');
    expect(markup).toContain('Enter a command');
    expect(markup).toContain('Run');
  });
});