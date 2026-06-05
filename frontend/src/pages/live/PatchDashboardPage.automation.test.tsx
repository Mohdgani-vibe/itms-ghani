// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
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

const automationPageMocks = vi.hoisted(() => ({
  getStoredSessionMock: vi.fn(),
  apiRequestMock: vi.fn<TestApiRequest>(() => new Promise(() => undefined)),
  loadAuthoredSaltTemplatesMock: vi.fn<() => TestSaltTemplate[]>(() => []),
  saveAuthoredSaltTemplatesMock: vi.fn<(templates: TestSaltTemplate[]) => void>(),
}));

vi.mock('../../lib/session', () => ({
  getStoredSession: automationPageMocks.getStoredSessionMock,
}));

vi.mock('../../lib/api', () => ({
  apiRequest: automationPageMocks.apiRequestMock,
}));

vi.mock('../../lib/saltTemplates', async () => {
  const actual = await vi.importActual<typeof import('../../lib/saltTemplates')>('../../lib/saltTemplates');
  return {
    ...actual,
    loadAuthoredSaltTemplates: automationPageMocks.loadAuthoredSaltTemplatesMock,
    saveAuthoredSaltTemplates: automationPageMocks.saveAuthoredSaltTemplatesMock,
  };
});

vi.mock('../../components/EmbeddedConsoleModal', () => ({
  default: () => null,
}));

vi.mock('../../components/PatchRunReportModal', () => ({
  default: () => null,
}));

import PatchDashboardPage from './PatchDashboardPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderAutomationWorkspace() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={['/admin/patch?view=automation']}>
        <PatchDashboardPage />
      </MemoryRouter>,
    );
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

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find((button) => (button.textContent || '').includes(label)) as HTMLButtonElement | undefined;
}

function findButtons(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).filter((button) => (button.textContent || '').includes(label)) as HTMLButtonElement[];
}

function findButtonByExactText(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find((button) => (button.textContent || '').trim() === label) as HTMLButtonElement | undefined;
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

async function setSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushEffects();
}

afterEach(() => {
  document.body.innerHTML = '';
  automationPageMocks.getStoredSessionMock.mockReset();
  automationPageMocks.apiRequestMock.mockReset();
  automationPageMocks.loadAuthoredSaltTemplatesMock.mockReset();
  automationPageMocks.saveAuthoredSaltTemplatesMock.mockReset();
});

describe('PatchDashboardPage automation templates', () => {
  it('creates a new automation template through the templates API', async () => {
    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    const descriptionInput = view.container.querySelector('input[placeholder="Short note for the operator"]') as HTMLInputElement | null;
    const stateNameInput = view.container.querySelector('input[placeholder="patch.run"]') as HTMLInputElement | null;
    const contentInput = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(nameInput).toBeTruthy();
    expect(descriptionInput).toBeTruthy();
    expect(stateNameInput).toBeTruthy();
    expect(contentInput).toBeTruthy();

    await setInputValue(nameInput!, 'Baseline patch');
    await setInputValue(descriptionInput!, 'Runs the baseline patch state');
    await setInputValue(stateNameInput!, 'patch.baseline');
    await setTextareaValue(contentInput!, 'patch.baseline:\n  test.nop: []');

    const saveButton = findButton(view.container, 'Save template');
    expect(saveButton).toBeTruthy();
    await clickButton(saveButton!);

    const createCall = automationPageMocks.apiRequestMock.mock.calls.find(([path, options]) => {
      if (path !== '/api/salt/workspace/templates' || options?.method !== 'PUT') {
        return false;
      }
      const templates = JSON.parse(options.body || '{"templates":[]}').templates || [];
      return templates.length === 1 && templates[0]?.name === 'Baseline patch' && templates[0]?.stateName === 'patch.baseline';
    });
    expect(createCall).toBeTruthy();
    expect(automationPageMocks.saveAuthoredSaltTemplatesMock).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Baseline patch', stateName: 'patch.baseline' }),
    ]);
    expect(view.container.textContent).toContain('.sls template saved.');
    expect(view.container.textContent).toContain('Baseline patch');
    expect(nameInput!.value).toBe('');
    expect(stateNameInput!.value).toBe('patch.run');

    await view.cleanup();
  });

  it('creates a shell automation template without persisting a state name', async () => {
    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const typeSelect = view.container.querySelector('select') as HTMLSelectElement | null;
    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    const descriptionInput = view.container.querySelector('input[placeholder="Short note for the operator"]') as HTMLInputElement | null;
    const contentInput = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(typeSelect).toBeTruthy();
    expect(nameInput).toBeTruthy();
    expect(descriptionInput).toBeTruthy();
    expect(contentInput).toBeTruthy();

    await setSelectValue(typeSelect!, 'shell');

    const shellNameInput = view.container.querySelector('input[placeholder="restart-salt-minion"]') as HTMLInputElement | null;
    const stateNameInput = view.container.querySelector('input[placeholder="patch.run"]') as HTMLInputElement | null;
    expect(shellNameInput).toBeTruthy();
    expect(stateNameInput).toBeNull();

    await setInputValue(shellNameInput!, 'restart-salt-minion');
    await setInputValue(descriptionInput!, 'Restarts the salt minion service');
    await setTextareaValue(contentInput!, 'systemctl restart salt-minion');

    const saveButton = findButton(view.container, 'Save template');
    expect(saveButton).toBeTruthy();
    await clickButton(saveButton!);

    const createCall = automationPageMocks.apiRequestMock.mock.calls.find(([path, options]) => {
      if (path !== '/api/salt/workspace/templates' || options?.method !== 'PUT') {
        return false;
      }
      const templates = JSON.parse(options.body || '{"templates":[]}').templates || [];
      return templates.length === 1
        && templates[0]?.kind === 'shell'
        && templates[0]?.name === 'restart-salt-minion'
        && templates[0]?.stateName === '';
    });
    expect(createCall).toBeTruthy();
    expect(automationPageMocks.saveAuthoredSaltTemplatesMock).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'shell', name: 'restart-salt-minion', stateName: '' }),
    ]);
    expect(view.container.textContent).toContain('.sh script saved.');
    expect(view.container.textContent).toContain('restart-salt-minion');
    expect((view.container.querySelector('select') as HTMLSelectElement | null)?.value).toBe('shell');
    expect((view.container.querySelector('input[placeholder="restart-salt-minion"]') as HTMLInputElement | null)?.value).toBe('');

    await view.cleanup();
  });

  it('updates and deletes a saved automation template through the templates API', async () => {
    const initialTemplate: TestSaltTemplate = {
      id: 'template-1',
      kind: 'sls',
      name: 'Patch rollout',
      description: 'Roll out updates',
      stateName: 'patch.run',
      content: 'patch.run:\n  test.nop: []',
      updatedAt: '2026-06-04T00:00:00Z',
    };

    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [initialTemplate] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    expect(view.container.textContent).toContain('Patch rollout');

    const editButton = findButton(view.container, 'Edit');
    expect(editButton).toBeTruthy();
    await clickButton(editButton!);

    expect(view.container.textContent).toContain('Edit saved automation template');
    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    await setInputValue(nameInput!, 'Patch rollout v2');

    const updateButton = findButton(view.container, 'Update template');
    expect(updateButton).toBeTruthy();
    await clickButton(updateButton!);

    const updateCall = automationPageMocks.apiRequestMock.mock.calls.find(([path, options]) => {
      if (path !== '/api/salt/workspace/templates' || options?.method !== 'PUT') {
        return false;
      }
      const templates = JSON.parse(options.body || '{"templates":[]}').templates || [];
      return templates[0]?.name === 'Patch rollout v2';
    });
    expect(updateCall).toBeTruthy();
    expect(automationPageMocks.saveAuthoredSaltTemplatesMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'template-1', name: 'Patch rollout v2' }),
    ]);
    expect(view.container.textContent).toContain('Template updated.');

    const deleteButton = findButton(view.container, 'Delete');
    expect(deleteButton).toBeTruthy();
    await clickButton(deleteButton!);

    expect(view.container.textContent).toContain('Delete automation template');
    expect(view.container.textContent).toContain('Remove Patch rollout v2 from saved Automation templates?');

    const confirmDeleteButton = findButton(view.container, 'Delete template');
    expect(confirmDeleteButton).toBeTruthy();
    await clickButton(confirmDeleteButton!);

    const deleteCall = automationPageMocks.apiRequestMock.mock.calls.find(([path, options]) => {
      if (path !== '/api/salt/workspace/templates' || options?.method !== 'PUT') {
        return false;
      }
      const templates = JSON.parse(options.body || '{"templates":[]}').templates || [];
      return Array.isArray(templates) && templates.length === 0;
    });
    expect(deleteCall).toBeTruthy();
    expect(automationPageMocks.saveAuthoredSaltTemplatesMock).toHaveBeenLastCalledWith([]);
    expect(view.container.textContent).toContain('Template deleted.');
    expect(view.container.textContent).toContain('No saved `.sls` or `.sh` templates yet.');

    await view.cleanup();
  });

  it('keeps an in-progress edit when deleting a different saved template', async () => {
    const templates: TestSaltTemplate[] = [
      {
        id: 'template-1',
        kind: 'sls',
        name: 'Patch rollout',
        description: 'Roll out updates',
        stateName: 'patch.run',
        content: 'patch.run:\n  test.nop: []',
        updatedAt: '2026-06-04T00:00:00Z',
      },
      {
        id: 'template-2',
        kind: 'shell',
        name: 'Cleanup script',
        description: 'Cleanup temp files',
        stateName: '',
        content: 'rm -rf /tmp/example',
        updatedAt: '2026-06-03T00:00:00Z',
      },
    ];

    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const editButtons = findButtons(view.container, 'Edit');
    expect(editButtons).toHaveLength(2);
    await clickButton(editButtons[0]!);

    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    await setInputValue(nameInput!, 'Patch rollout draft');

    const deleteButtons = findButtons(view.container, 'Delete');
    expect(deleteButtons).toHaveLength(2);
    await clickButton(deleteButtons[1]!);

    const confirmDeleteButton = findButton(view.container, 'Delete template');
    expect(confirmDeleteButton).toBeTruthy();
    await clickButton(confirmDeleteButton!);

    expect(view.container.textContent).toContain('Template deleted.');
    expect(view.container.textContent).toContain('Edit saved automation template');
    expect(nameInput!.value).toBe('Patch rollout draft');
    expect(view.container.textContent).toContain('Patch rollout');
    expect(view.container.textContent).not.toContain('Cleanup script');

    const deleteCall = automationPageMocks.apiRequestMock.mock.calls.findLast(([path, options]) => {
      if (path !== '/api/salt/workspace/templates' || options?.method !== 'PUT') {
        return false;
      }
      const persistedTemplates = JSON.parse(options.body || '{"templates":[]}').templates || [];
      return persistedTemplates.length === 1 && persistedTemplates[0]?.id === 'template-1';
    });
    expect(deleteCall).toBeTruthy();

    await view.cleanup();
  });

  it('resets the editor when deleting the template currently being edited', async () => {
    const template: TestSaltTemplate = {
      id: 'template-1',
      kind: 'sls',
      name: 'Patch rollout',
      description: 'Roll out updates',
      stateName: 'patch.run',
      content: 'patch.run:\n  test.nop: []',
      updatedAt: '2026-06-04T00:00:00Z',
    };

    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [template] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const editButton = findButton(view.container, 'Edit');
    expect(editButton).toBeTruthy();
    await clickButton(editButton!);

    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    const stateNameInput = view.container.querySelector('input[placeholder="patch.run"]') as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    expect(stateNameInput).toBeTruthy();
    await setInputValue(nameInput!, 'Patch rollout draft');

    const deleteButton = findButton(view.container, 'Delete');
    expect(deleteButton).toBeTruthy();
    await clickButton(deleteButton!);

    const confirmDeleteButton = findButton(view.container, 'Delete template');
    expect(confirmDeleteButton).toBeTruthy();
    await clickButton(confirmDeleteButton!);

    expect(view.container.textContent).toContain('Template deleted.');
    expect(view.container.textContent).not.toContain('Edit saved automation template');
    expect(nameInput!.value).toBe('');
    expect(stateNameInput!.value).toBe('patch.run');
    expect(view.container.textContent).toContain('No saved `.sls` or `.sh` templates yet.');

    await view.cleanup();
  });

  it('keeps the current edit intact when the delete dialog is cancelled', async () => {
    const template: TestSaltTemplate = {
      id: 'template-1',
      kind: 'sls',
      name: 'Patch rollout',
      description: 'Roll out updates',
      stateName: 'patch.run',
      content: 'patch.run:\n  test.nop: []',
      updatedAt: '2026-06-04T00:00:00Z',
    };

    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [template] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const editButton = findButton(view.container, 'Edit');
    expect(editButton).toBeTruthy();
    await clickButton(editButton!);

    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    await setInputValue(nameInput!, 'Patch rollout draft');

    const deleteButton = findButton(view.container, 'Delete');
    expect(deleteButton).toBeTruthy();
    await clickButton(deleteButton!);

    expect(view.container.textContent).toContain('Delete automation template');
    const cancelButton = findButtonByExactText(view.container, 'Cancel');
    expect(cancelButton).toBeTruthy();
    await clickButton(cancelButton!);

    expect(view.container.textContent).not.toContain('Delete automation template');
    expect(view.container.textContent).toContain('Edit saved automation template');
    expect(nameInput!.value).toBe('Patch rollout draft');
    expect(automationPageMocks.apiRequestMock.mock.calls.filter(([path, options]) => path === '/api/salt/workspace/templates' && options?.method === 'PUT')).toHaveLength(0);

    await view.cleanup();
  });

  it('cancels edit back to a fresh draft for the currently selected kind', async () => {
    const template: TestSaltTemplate = {
      id: 'template-1',
      kind: 'sls',
      name: 'Patch rollout',
      description: 'Roll out updates',
      stateName: 'patch.run',
      content: 'patch.run:\n  test.nop: []',
      updatedAt: '2026-06-04T00:00:00Z',
    };

    automationPageMocks.getStoredSessionMock.mockReturnValue({
      token: 'token',
      shortName: 'SA',
      user: {
        id: 'user-1',
        email: 'sa@example.com',
        fullName: 'System Admin',
        role: 'super_admin',
        defaultPortal: '/admin/dashboard',
        portals: ['super_admin'],
      },
    });
    automationPageMocks.loadAuthoredSaltTemplatesMock.mockReturnValue([]);
    automationPageMocks.apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/patch/devices') {
        return [];
      }
      if (path === '/api/users/meta/options') {
        return { departments: [] };
      }
      if (path.startsWith('/api/patch/reports?limit=')) {
        return [];
      }
      if (path.startsWith('/api/salt/workspace?limit=')) {
        return { jobHistory: [], recentExecutions: [], slsFiles: [] };
      }
      if (path === '/api/salt/workspace/templates' && (!options || !options.method)) {
        return { templates: [template] };
      }
      if (path === '/api/salt/workspace/templates' && options?.method === 'PUT') {
        return { templates: JSON.parse(options.body || '{"templates":[]}').templates || [] };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    const view = await renderAutomationWorkspace();

    const editButton = findButton(view.container, 'Edit');
    expect(editButton).toBeTruthy();
    await clickButton(editButton!);

    const typeSelect = view.container.querySelector('select') as HTMLSelectElement | null;
    const nameInput = view.container.querySelector('input[placeholder="patch-baseline"]') as HTMLInputElement | null;
    const contentInput = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(typeSelect).toBeTruthy();
    expect(nameInput).toBeTruthy();
    expect(contentInput).toBeTruthy();

    await setSelectValue(typeSelect!, 'shell');
    const shellNameInput = view.container.querySelector('input[placeholder="restart-salt-minion"]') as HTMLInputElement | null;
    expect(shellNameInput).toBeTruthy();
    await setInputValue(shellNameInput!, 'restart-salt-minion');
    await setTextareaValue(contentInput!, 'systemctl restart salt-minion');

    const cancelEditButton = findButton(view.container, 'Cancel edit');
    expect(cancelEditButton).toBeTruthy();
    await clickButton(cancelEditButton!);

    expect(view.container.textContent).not.toContain('Edit saved automation template');
    expect((view.container.querySelector('select') as HTMLSelectElement | null)?.value).toBe('shell');
    expect((view.container.querySelector('input[placeholder="restart-salt-minion"]') as HTMLInputElement | null)?.value).toBe('');
    expect((view.container.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('');
    expect(view.container.querySelector('input[placeholder="patch.run"]')).toBeNull();
    expect(automationPageMocks.apiRequestMock.mock.calls.filter(([path, options]) => path === '/api/salt/workspace/templates' && options?.method === 'PUT')).toHaveLength(0);

    await view.cleanup();
  });
});