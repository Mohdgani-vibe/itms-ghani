import { useState, useCallback } from 'react';
import { updateInventoryItem, createInventoryItem } from '../../lib/inventoryApi';
import type { InventoryItem } from './types';

type InventoryEditorMode = 'edit' | 'create';

interface InventoryEditorWorkflowOptions {
  triggerInventoryReload?: () => void;
  setError?: (value: string) => void;
  setSuccessMessage?: (value: string) => void;
}

export function useInventoryEditorWorkflow({ triggerInventoryReload, setError, setSuccessMessage }: InventoryEditorWorkflowOptions) {
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [editorMode, setEditorMode] = useState<InventoryEditorMode>('edit');
  const [saving, setSaving] = useState(false);

  const closeEditor = useCallback(() => {
    setEditingItem(null);
    setEditorMode('edit');
  }, []);

  const openEditor = useCallback((item: Partial<InventoryItem>, mode: InventoryEditorMode = 'edit') => {
    setEditingItem(item);
    setEditorMode(mode);
    setError && setError('');
    setSuccessMessage && setSuccessMessage('');
  }, [setError, setSuccessMessage]);

  const updateEditingField = useCallback((field: keyof InventoryItem, value: InventoryItem[keyof InventoryItem]) => {
    setEditingItem((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingItem) return;
    try {
      setSaving(true);
      setError && setError('');
      setSuccessMessage && setSuccessMessage('');
      if (editorMode === 'edit') {
        if (!editingItem.id) {
          throw new Error('Inventory item ID is required for updates');
        }
        await updateInventoryItem(editingItem.id, editingItem);
      } else {
        await createInventoryItem(editingItem);
      }
      closeEditor();
      triggerInventoryReload && triggerInventoryReload();
      setSuccessMessage && setSuccessMessage('Inventory item saved successfully.');
    } catch (e) {
      setError && setError(e instanceof Error ? e.message : 'Failed to save inventory item');
    } finally {
      setSaving(false);
    }
  }, [editingItem, editorMode, closeEditor, triggerInventoryReload, setError, setSuccessMessage]);

  return {
    editingItem,
    editorMode,
    saving,
    closeEditor,
    openEditor,
    updateEditingField,
    handleSave,
  };
}
