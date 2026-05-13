import { useState, useCallback } from 'react';
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../lib/inventoryApi';
import type { InventoryItem } from './types';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useInventoryDirectoryWorkflow() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchInventory();
      setItems(data);
    } catch (error) {
      setError(errorMessage(error, 'Failed to load inventory'));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = useCallback(async (item: unknown) => {
    setLoading(true);
    setError('');
    try {
      await createInventoryItem(item);
      await loadInventory();
    } catch (error) {
      setError(errorMessage(error, 'Failed to create item'));
    } finally {
      setLoading(false);
    }
  }, [loadInventory]);

  const handleUpdate = useCallback(async (id: string, item: unknown) => {
    setLoading(true);
    setError('');
    try {
      await updateInventoryItem(id, item);
      await loadInventory();
    } catch (error) {
      setError(errorMessage(error, 'Failed to update item'));
    } finally {
      setLoading(false);
    }
  }, [loadInventory]);

  const handleDelete = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      await deleteInventoryItem(id);
      await loadInventory();
    } catch (error) {
      setError(errorMessage(error, 'Failed to delete item'));
    } finally {
      setLoading(false);
    }
  }, [loadInventory]);

  return { items, loading, error, loadInventory, handleCreate, handleUpdate, handleDelete };
}
