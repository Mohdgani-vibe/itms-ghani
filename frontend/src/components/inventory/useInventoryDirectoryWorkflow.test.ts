import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  fetchInventoryMock: vi.fn(),
  createInventoryItemMock: vi.fn(),
  updateInventoryItemMock: vi.fn(),
  deleteInventoryItemMock: vi.fn(),
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
  fetchInventory: hookState.fetchInventoryMock,
  createInventoryItem: hookState.createInventoryItemMock,
  updateInventoryItem: hookState.updateInventoryItemMock,
  deleteInventoryItem: hookState.deleteInventoryItemMock,
}));

import { useInventoryDirectoryWorkflow } from './useInventoryDirectoryWorkflow';

function queueHookState(overrides: {
  items?: unknown[];
  loading?: boolean;
  error?: string;
  setters?: Array<ReturnType<typeof vi.fn>>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.items ?? [],
    overrides.loading ?? false,
    overrides.error ?? '',
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...(
    overrides.setters ?? [vi.fn(), vi.fn(), vi.fn()]
  ));
}

describe('useInventoryDirectoryWorkflow', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.fetchInventoryMock.mockReset();
    hookState.createInventoryItemMock.mockReset();
    hookState.updateInventoryItemMock.mockReset();
    hookState.deleteInventoryItemMock.mockReset();
  });

  it('loads inventory and updates items on success', async () => {
    const setItems = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    queueHookState({ setters: [setItems, setLoading, setError] });
    hookState.fetchInventoryMock.mockResolvedValue([{ id: 'item-1' }]);

    const workflow = useInventoryDirectoryWorkflow();
    await workflow.loadInventory();

    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setError).toHaveBeenCalledWith('');
    expect(hookState.fetchInventoryMock).toHaveBeenCalledTimes(1);
    expect(setItems).toHaveBeenCalledWith([{ id: 'item-1' }]);
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('creates an item and reloads inventory on success', async () => {
    const setItems = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    queueHookState({ setters: [setItems, setLoading, setError] });
    hookState.createInventoryItemMock.mockResolvedValue(undefined);
    hookState.fetchInventoryMock.mockResolvedValue([{ id: 'item-2' }]);

    const workflow = useInventoryDirectoryWorkflow();
    await workflow.handleCreate({ name: 'Laptop' });

    expect(hookState.createInventoryItemMock).toHaveBeenCalledWith({ name: 'Laptop' });
    expect(hookState.fetchInventoryMock).toHaveBeenCalledTimes(1);
    expect(setItems).toHaveBeenCalledWith([{ id: 'item-2' }]);
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('reports delete failures through the error setter', async () => {
    const setItems = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    queueHookState({ setters: [setItems, setLoading, setError] });
    hookState.deleteInventoryItemMock.mockRejectedValue(new Error('Delete failed'));

    const workflow = useInventoryDirectoryWorkflow();
    await workflow.handleDelete('item-3');

    expect(hookState.deleteInventoryItemMock).toHaveBeenCalledWith('item-3');
    expect(setError).toHaveBeenCalledWith('Delete failed');
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(hookState.fetchInventoryMock).not.toHaveBeenCalled();
  });
});