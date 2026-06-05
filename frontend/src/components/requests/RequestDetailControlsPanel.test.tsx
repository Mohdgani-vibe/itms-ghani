// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RequestDetailControlsPanel from './RequestDetailControlsPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderPanel() {
  const onAssigneeDraftChange = vi.fn();
  const onAssign = vi.fn();
  const onStatusDraftChange = vi.fn();
  const onNoteDraftChange = vi.fn();
  const onApplyNoteTemplate = vi.fn();
  const onUpdateRequest = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <RequestDetailControlsPanel
        assigneeDraft="user-1"
        statusDraft="in_progress"
        noteDraft="Investigating the enrollment payload."
        assigneeOptions={[{ value: 'user-1', label: 'Ava Admin' }, { value: 'user-2', label: 'Mia Manager' }]}
        statusOptions={[{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }]}
        saving={false}
        canEdit={true}
        statusLabel="Pending"
        onAssigneeDraftChange={onAssigneeDraftChange}
        onAssign={onAssign}
        onStatusDraftChange={onStatusDraftChange}
        onNoteDraftChange={onNoteDraftChange}
        onApplyNoteTemplate={onApplyNoteTemplate}
        onUpdateRequest={onUpdateRequest}
      />,
    );
  });
  await flushEffects();

  return {
    container,
    onAssigneeDraftChange,
    onAssign,
    onStatusDraftChange,
    onNoteDraftChange,
    onApplyNoteTemplate,
    onUpdateRequest,
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

async function changeSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
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

async function clickElement(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
  await flushEffects();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RequestDetailControlsPanel', () => {
  it('renders assignment, status, templates, and active save controls', () => {
    const markup = renderToStaticMarkup(
      createElement(RequestDetailControlsPanel as unknown as string, {
        assigneeDraft: 'user-1',
        statusDraft: 'in_progress',
        noteDraft: 'Investigating the enrollment payload.',
        assigneeOptions: [{ value: 'user-1', label: 'Ava Admin' }],
        statusOptions: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }],
        saving: false,
        canEdit: true,
        statusLabel: 'Pending',
        onAssigneeDraftChange: vi.fn(),
        onAssign: vi.fn(),
        onStatusDraftChange: vi.fn(),
        onNoteDraftChange: vi.fn(),
        onApplyNoteTemplate: vi.fn(),
        onUpdateRequest: vi.fn(),
      }),
    );

    expect(markup).toContain('Queue Controls');
    expect(markup).toContain('Assign an owner, move the request to the correct state');
    expect(markup).toContain('Select IT owner');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Assign');
    expect(markup).toContain('Pending');
    expect(markup).toContain('In Progress');
    expect(markup).toContain('Investigating the enrollment payload.');
    expect(markup).toContain('Add triage note');
    expect(markup).toContain('Mark waiting');
    expect(markup).toContain('Add resolution note');
    expect(markup).toContain('Update Request');
  });

  it('renders disabled actions and saving state when updates are in progress', () => {
    const markup = renderToStaticMarkup(
      createElement(RequestDetailControlsPanel as unknown as string, {
        assigneeDraft: '',
        statusDraft: 'pending',
        noteDraft: '',
        assigneeOptions: [],
        statusOptions: [{ value: 'pending', label: 'Pending' }],
        saving: true,
        canEdit: false,
        statusLabel: 'Pending',
        onAssigneeDraftChange: vi.fn(),
        onAssign: vi.fn(),
        onStatusDraftChange: vi.fn(),
        onNoteDraftChange: vi.fn(),
        onApplyNoteTemplate: vi.fn(),
        onUpdateRequest: vi.fn(),
      }),
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Saving...');
  });

  it('wires assignment, status, notes, templates, and save handlers', async () => {
    const view = await renderPanel();

    const selects = Array.from(view.container.querySelectorAll('select')) as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    await changeSelectValue(selects[0], 'user-2');
    await changeSelectValue(selects[1], 'resolved');

    const textarea = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    await setTextareaValue(textarea!, 'Resolved after verifying the asset metadata.');

    const buttons = Array.from(view.container.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Assign',
      'Add triage note',
      'Mark waiting',
      'Add resolution note',
      'Update Request',
    ]);

    await clickElement(buttons[0]);
    await clickElement(buttons[1]);
    await clickElement(buttons[2]);
    await clickElement(buttons[3]);
    await clickElement(buttons[4]);

    expect(view.onAssigneeDraftChange).toHaveBeenCalledWith('user-2');
    expect(view.onStatusDraftChange).toHaveBeenCalledWith('resolved');
    expect(view.onNoteDraftChange).toHaveBeenCalledWith('Resolved after verifying the asset metadata.');
    expect(view.onAssign).toHaveBeenCalledTimes(1);
    expect(view.onApplyNoteTemplate).toHaveBeenNthCalledWith(1, 'triage');
    expect(view.onApplyNoteTemplate).toHaveBeenNthCalledWith(2, 'waiting');
    expect(view.onApplyNoteTemplate).toHaveBeenNthCalledWith(3, 'resolved');
    expect(view.onUpdateRequest).toHaveBeenCalledTimes(1);

    await view.cleanup();
  });
});