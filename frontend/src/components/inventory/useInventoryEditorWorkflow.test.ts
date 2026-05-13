import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  updateInventoryItemMock: vi.fn(),
  createInventoryItemMock: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useState: <T,>(initialValue: T) => {
      const value = hookState.stateQueue.length > 0 ? hookState.stateQueue.shift() as T : initialValue;
      const setter = hookState.setterQueue.length > 0 ? hookState.setterQueue.shift()! : vi.fn();
      return [value, setter] as const;
    },
  };
});

vi.mock('../../lib/inventoryApi', () => ({
  updateInventoryItem: hookState.updateInventoryItemMock,
  createInventoryItem: hookState.createInventoryItemMock,
}));

import { useInventoryEditorWorkflow } from './useInventoryEditorWorkflow';

function queueHookState(overrides: {
  editingItem?: unknown;
  editorMode?: 'edit' | 'create';
  saving?: boolean;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.editingItem ?? null,
    overrides.editorMode ?? 'edit',
    overrides.saving ?? false,
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useInventoryEditorWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.updateInventoryItemMock.mockReset();
    hookState.createInventoryItemMock.mockReset();
  });

  it('opens and closes the editor while clearing feedback messages', () => {
    const setEditingItem = vi.fn();
    const setEditorMode = vi.fn();
    const setSaving = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({ setters: [setEditingItem, setEditorMode, setSaving] });

    const workflow = useInventoryEditorWorkflow({ setError, setSuccessMessage });
    workflow.openEditor({ id: 'item-1' }, 'create');
    workflow.closeEditor();

    expect(setEditingItem).toHaveBeenNthCalledWith(1, { id: 'item-1' });
    expect(setEditorMode).toHaveBeenNthCalledWith(1, 'create');
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(setEditingItem).toHaveBeenLastCalledWith(null);
    expect(setEditorMode).toHaveBeenLastCalledWith('edit');
  });

  it('saves edited inventory items and triggers reload with success feedback', async () => {
    const setEditingItem = vi.fn();
    const setEditorMode = vi.fn();
    const setSaving = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    const triggerInventoryReload = vi.fn();
    queueHookState({
      editingItem: { id: 'item-2', name: 'Laptop' },
      editorMode: 'edit',
      setters: [setEditingItem, setEditorMode, setSaving],
    });
    hookState.updateInventoryItemMock.mockResolvedValue(undefined);

    const workflow = useInventoryEditorWorkflow({ triggerInventoryReload, setError, setSuccessMessage });
    await workflow.handleSave();

    expect(setSaving).toHaveBeenNthCalledWith(1, true);
    expect(setError).toHaveBeenCalledWith('');
    expect(setSuccessMessage).toHaveBeenCalledWith('');
    expect(hookState.updateInventoryItemMock).toHaveBeenCalledWith('item-2', { id: 'item-2', name: 'Laptop' });
    expect(setEditingItem).toHaveBeenCalledWith(null);
    expect(setEditorMode).toHaveBeenCalledWith('edit');
    expect(triggerInventoryReload).toHaveBeenCalled();
    expect(setSuccessMessage).toHaveBeenLastCalledWith('Inventory item saved successfully.');
    expect(setSaving).toHaveBeenLastCalledWith(false);
  });

  it('reports save failures when an edit is missing its item id', async () => {
    const setEditingItem = vi.fn();
    const setEditorMode = vi.fn();
    const setSaving = vi.fn();
    const setError = vi.fn();
    const setSuccessMessage = vi.fn();
    queueHookState({
      editingItem: { name: 'Laptop' },
      editorMode: 'edit',
      setters: [setEditingItem, setEditorMode, setSaving],
    });

    const workflow = useInventoryEditorWorkflow({ setError, setSuccessMessage });
    await workflow.handleSave();

    expect(setError).toHaveBeenLastCalledWith('Inventory item ID is required for updates');
    expect(hookState.updateInventoryItemMock).not.toHaveBeenCalled();
    expect(setSaving).toHaveBeenLastCalledWith(false);
  });
});