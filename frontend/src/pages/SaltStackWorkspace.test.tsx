// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type TestApiRequest = (path: string, options?: { method?: string; body?: string }) => Promise<unknown>;
type TestSaltTemplate = {
  id: string;
  kind: 'sls' | 'shell';
  name: string;
  description: string;
  stateName: string;
  content: string;
  updatedAt: string;
};

const saltWorkspaceMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  getStoredSessionMock: vi.fn(),
  apiRequestMock: vi.fn<TestApiRequest>(() => new Promise(() => undefined)),
  loadAuthoredSaltTemplatesMock: vi.fn<() => TestSaltTemplate[]>(() => []),
    saveAuthoredSaltTemplatesMock: vi.fn<(templates: TestSaltTemplate[]) => void>(),
  terminalConsoleViewMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: saltWorkspaceMocks.useLocationMock,
  };
});

vi.mock('../lib/api', () => ({
  apiRequest: saltWorkspaceMocks.apiRequestMock,
}));

vi.mock('../lib/session', () => ({
  getStoredSession: saltWorkspaceMocks.getStoredSessionMock,
}));

vi.mock('../lib/saltTemplates', () => ({
  loadAuthoredSaltTemplates: saltWorkspaceMocks.loadAuthoredSaltTemplatesMock,
  saveAuthoredSaltTemplates: saltWorkspaceMocks.saveAuthoredSaltTemplatesMock,
}));

vi.mock('../components/TerminalConsoleView', () => ({
  default: (props: unknown) => {
    saltWorkspaceMocks.terminalConsoleViewMock(props);
    return <div>terminal-console-view</div>;
  },
}));

import SaltStackWorkspace from './SaltStackWorkspace';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderWorkspace() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(<SaltStackWorkspace />);
  });
  await flushEffects();

  return {
    container,
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

function findSelectByOption(container: HTMLElement, optionValue: string) {
  return Array.from(container.querySelectorAll('select')).find((select) => {
    return Array.from(select.options).some((option) => option.value === optionValue);
  }) as HTMLSelectElement | undefined;
}

function findSelectByPrompt(container: HTMLElement, prompt: string) {
  return Array.from(container.querySelectorAll('select')).find((select) => {
    return Array.from(select.options).some((option) => (option.textContent || '').includes(prompt));
  }) as HTMLSelectElement | undefined;
}

function findExecuteCall() {
  const executeCall = saltWorkspaceMocks.apiRequestMock.mock.calls.find(([path, options]) => {
    return path === '/api/salt/workspace/execute' && options?.method === 'POST';
  });
  expect(executeCall).toBeTruthy();
  return executeCall as [string, { method?: string; body?: string }];
}

async function changeSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

async function setCheckboxValue(input: HTMLInputElement, checked: boolean) {
  if (input.checked === checked) {
    return;
  }
  await act(async () => {
    input.click();
  });
  await flushEffects();
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await flushEffects();
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

afterEach(() => {
  document.body.innerHTML = '';
  saltWorkspaceMocks.useLocationMock.mockReset();
  saltWorkspaceMocks.getStoredSessionMock.mockReset();
  saltWorkspaceMocks.apiRequestMock.mockReset();
  saltWorkspaceMocks.loadAuthoredSaltTemplatesMock.mockReset();
  saltWorkspaceMocks.saveAuthoredSaltTemplatesMock.mockReset();
  saltWorkspaceMocks.terminalConsoleViewMock.mockReset();
});

describe('SaltStackWorkspace', () => {
  it('renders the operator shell with execution controls before workspace data resolves', () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });

    const markup = renderToStaticMarkup(<SaltStackWorkspace />);

    expect(markup).toContain('Operations control deck');
    expect(markup).toContain('Scope builder');
    expect(markup).toContain('Assemble one guarded Salt action');
    expect(markup).toContain('Run execution');
    expect(markup).toContain('test.ping -&gt; Selected system');
    expect(markup).toContain('The server Salt API is not configured.');
  });

  it('renders auditor access as read-only', () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'auditor' },
    });

    const markup = renderToStaticMarkup(<SaltStackWorkspace />);

    expect(markup).toContain('Auditor access is read-only. Command execution is disabled.');
    expect(markup).toContain('Run execution');
  });

  it('prefers backend-backed templates and mirrors them to local cache', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    saltWorkspaceMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([
      {
        id: 'local-shell-1',
        kind: 'shell',
        name: 'Local fallback',
        description: 'local only',
        stateName: '',
        content: 'hostname',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ]);
    saltWorkspaceMocks.apiRequestMock.mockImplementation(async (path: string) => {
      if (path === '/api/salt/workspace/templates') {
        return {
          templates: [
            {
              id: 'backend-shell-1',
              kind: 'shell',
              name: 'Backend template',
              description: 'from api',
              stateName: '',
              content: 'hostname',
              updatedAt: '2026-06-04T00:00:00Z',
            },
          ],
        };
      }
      return {
        assets: [
          {
            id: 'asset-1',
            hostname: 'workstation-01',
            saltMinionId: 'minion-1',
            departmentName: 'IT Operations',
            connected: true,
          },
        ],
        recentExecutions: [],
        summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 1, pendingActions: 0 },
        integrations: { saltApiConfigured: true },
      };
    });

    const view = await renderWorkspace();

    const functionSelect = findSelectByOption(view.container, 'cmd.script');
    expect(functionSelect).toBeTruthy();
    await changeSelectValue(functionSelect!, 'cmd.script');

    expect(view.container.textContent).toContain('Backend template');
    expect(saltWorkspaceMocks.saveAuthoredSaltTemplatesMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'backend-shell-1', name: 'Backend template' }),
    ]);

    await view.cleanup();
  });

  it('submits state.apply with the saved state name, department scope, and dry-run flag', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'super_admin' },
    });
    saltWorkspaceMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([
      {
        id: 'template-sls-1',
        kind: 'sls',
        name: 'Patch rollout',
        description: 'Roll out the patch state.',
        stateName: 'patch.run',
        content: 'patch.run:\n  test.nop: []',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ]);
    saltWorkspaceMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/salt/workspace/execute' && options?.method === 'POST') {
        return {
          scopeLabel: 'IT Operations',
          requestedAt: '2026-06-02T00:00:00Z',
          completedAt: '2026-06-02T00:00:05Z',
          successCount: 1,
          failedCount: 0,
          rows: [],
          logs: [],
          stdout: 'ok',
        };
      }
      return {
        assets: [
          {
            id: 'asset-1',
            hostname: 'workstation-01',
            saltMinionId: 'minion-1',
            departmentName: 'IT Operations',
            connected: true,
          },
        ],
        recentExecutions: [],
        summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 1, pendingActions: 0 },
        integrations: { saltApiConfigured: true },
      };
    });

    const view = await renderWorkspace();

    const functionSelect = findSelectByOption(view.container, 'state.apply');
    expect(functionSelect).toBeTruthy();
    await changeSelectValue(functionSelect!, 'state.apply');

    const targetModeSelect = findSelectByOption(view.container, 'department');
    expect(targetModeSelect).toBeTruthy();
    await changeSelectValue(targetModeSelect!, 'department');

    const departmentTargetSelect = findSelectByPrompt(view.container, 'Choose a department');
    expect(departmentTargetSelect).toBeTruthy();
    await changeSelectValue(departmentTargetSelect!, 'IT Operations');

    const dryRunToggle = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(dryRunToggle).toBeTruthy();
    await setCheckboxValue(dryRunToggle!, true);

    const runButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Run execution')) as HTMLButtonElement | undefined;
    expect(runButton).toBeTruthy();
    await clickButton(runButton!);

    const executeCall = findExecuteCall();
    const payload = JSON.parse(executeCall[1].body || '');
    expect(payload).toEqual({
      client: 'local',
      function: 'state.apply',
      arguments: ['patch.run'],
      targetMode: 'department',
      target: '',
      targets: [],
      departmentName: 'IT Operations',
      label: 'IT Operations',
      test: true,
    });

    await view.cleanup();
  });

  it('submits cmd.script with the saved shell body against the selected minion', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'it_team' },
    });
    saltWorkspaceMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([
      {
        id: 'template-shell-1',
        kind: 'shell',
        name: 'Hostname probe',
        description: 'Return the current hostname.',
        stateName: '',
        content: 'hostname',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ]);
    saltWorkspaceMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/salt/workspace/execute' && options?.method === 'POST') {
        return {
          scopeLabel: 'minion-1',
          requestedAt: '2026-06-02T00:00:00Z',
          completedAt: '2026-06-02T00:00:03Z',
          successCount: 1,
          failedCount: 0,
          rows: [],
          logs: [],
          stdout: 'workstation-01',
        };
      }
      return {
        assets: [
          {
            id: 'asset-1',
            hostname: 'workstation-01',
            saltMinionId: 'minion-1',
            departmentName: 'IT Operations',
            connected: true,
          },
        ],
        recentExecutions: [],
        summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 1, pendingActions: 0 },
        integrations: { saltApiConfigured: true },
      };
    });

    const view = await renderWorkspace();

    const functionSelect = findSelectByOption(view.container, 'cmd.script');
    expect(functionSelect).toBeTruthy();
    await changeSelectValue(functionSelect!, 'cmd.script');

    const runButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Run execution')) as HTMLButtonElement | undefined;
    expect(runButton).toBeTruthy();
    await clickButton(runButton!);

    const executeCall = findExecuteCall();
    const payload = JSON.parse(executeCall[1].body || '');
    expect(payload).toEqual({
      client: 'local',
      function: 'cmd.script',
      arguments: ['hostname'],
      targetMode: 'single',
      target: 'minion-1',
      targets: [],
      departmentName: '',
      label: 'minion-1',
      test: false,
    });

    await view.cleanup();
  });

  it('blocks cmd.script when the selected shell template contains a multi-line script body', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'it_team' },
    });
    saltWorkspaceMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([
      {
        id: 'template-shell-2',
        kind: 'shell',
        name: 'Bad script',
        description: 'Attempts to run multiple lines.',
        stateName: '',
        content: 'hostname\nuname -a',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ]);
    saltWorkspaceMocks.apiRequestMock.mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          hostname: 'workstation-01',
          saltMinionId: 'minion-1',
          departmentName: 'IT Operations',
          connected: true,
        },
      ],
      recentExecutions: [],
      summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 1, pendingActions: 0 },
      integrations: { saltApiConfigured: true },
      executionPolicy: { allowedCommands: ['hostname', 'uname'] },
    });

    const view = await renderWorkspace();

    const functionSelect = findSelectByOption(view.container, 'cmd.script');
    expect(functionSelect).toBeTruthy();
    await changeSelectValue(functionSelect!, 'cmd.script');

    expect(view.container.textContent).toContain('cmd.script only supports one guarded shell command. Multi-line scripts are blocked.');

    const runButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Run execution')) as HTMLButtonElement | undefined;
    expect(runButton).toBeTruthy();
    expect(runButton?.disabled).toBe(true);

    const executeCall = saltWorkspaceMocks.apiRequestMock.mock.calls.find(([path, options]) => path === '/api/salt/workspace/execute' && options?.method === 'POST');
    expect(executeCall).toBeFalsy();

    await view.cleanup();
  });

  it('submits multiple trimmed targets parsed from commas and new lines', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'it_team' },
    });
    saltWorkspaceMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/salt/workspace/execute' && options?.method === 'POST') {
        return {
          scopeLabel: '3 selected systems',
          requestedAt: '2026-06-02T00:00:00Z',
          completedAt: '2026-06-02T00:00:04Z',
          successCount: 3,
          failedCount: 0,
          rows: [],
          logs: [],
          stdout: 'ok',
        };
      }
      return {
        assets: [
          {
            id: 'asset-1',
            hostname: 'workstation-01',
            saltMinionId: 'minion-1',
            departmentName: 'IT Operations',
            connected: true,
          },
        ],
        recentExecutions: [],
        summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 1, pendingActions: 0 },
        integrations: { saltApiConfigured: true },
      };
    });

    const view = await renderWorkspace();

    const targetModeSelect = findSelectByOption(view.container, 'multiple');
    expect(targetModeSelect).toBeTruthy();
    await changeSelectValue(targetModeSelect!, 'multiple');

    const targetInput = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(targetInput).toBeTruthy();
    await setTextareaValue(targetInput!, ' minion-1, host-2\n\n asset-3 ');

    const runButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Run execution')) as HTMLButtonElement | undefined;
    expect(runButton).toBeTruthy();
    await clickButton(runButton!);

    const executeCall = findExecuteCall();
    const payload = JSON.parse(executeCall[1].body || '');
    expect(payload).toEqual({
      client: 'local',
      function: 'test.ping',
      arguments: [],
      targetMode: 'multiple',
      target: '',
      targets: ['minion-1', 'host-2', 'asset-3'],
      departmentName: '',
      label: '3 selected systems',
      test: false,
    });

    await view.cleanup();
  });

  it('submits the hostname when the selected asset has no linked minion id', async () => {
    saltWorkspaceMocks.useLocationMock.mockReturnValue({ pathname: '/admin/salt', search: '', hash: '' });
    saltWorkspaceMocks.getStoredSessionMock.mockReturnValue({
      user: { role: 'it_team' },
    });
    saltWorkspaceMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/salt/workspace/execute' && options?.method === 'POST') {
        return {
          scopeLabel: 'workstation-01',
          requestedAt: '2026-06-02T00:00:00Z',
          completedAt: '2026-06-02T00:00:02Z',
          successCount: 1,
          failedCount: 0,
          rows: [],
          logs: [],
          stdout: 'ok',
        };
      }
      return {
        assets: [
          {
            id: 'asset-1',
            hostname: 'workstation-01',
            saltMinionId: null,
            departmentName: 'IT Operations',
            connected: true,
          },
        ],
        recentExecutions: [],
        summary: { totalAssets: 1, connectedTargets: 1, linkedTargets: 0, pendingActions: 0 },
        integrations: { saltApiConfigured: true },
      };
    });

    const view = await renderWorkspace();

    const runButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Run execution')) as HTMLButtonElement | undefined;
    expect(runButton).toBeTruthy();
    await clickButton(runButton!);

    const executeCall = findExecuteCall();
    const payload = JSON.parse(executeCall[1].body || '');
    expect(payload).toEqual({
      client: 'local',
      function: 'test.ping',
      arguments: [],
      targetMode: 'single',
      target: 'workstation-01',
      targets: [],
      departmentName: '',
      label: 'workstation-01',
      test: false,
    });

    await view.cleanup();
  });
});