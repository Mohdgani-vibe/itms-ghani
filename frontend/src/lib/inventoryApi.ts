import { apiRequest } from './api';
import type {
  InventoryItem,
  InventoryEntityOption,
  InventoryModuleAsset,
  InventoryModuleAssetInput,
  InventoryModuleAssetsResponse,
  InventoryModuleAuditListResponse,
  InventoryModuleBranch,
  InventoryModuleMainItem,
  InventoryModuleOptionsResponse,
  InventoryModuleSubItem,
  InventoryModuleSupplier,
  InventoryModuleImportResult,
  InventoryStockOperationInput,
} from '../components/inventory/types';

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

async function downloadBlob(path: string) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      Accept: 'text/csv,application/octet-stream,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.blob();
}

export function fetchInventory() {
  return apiRequest<InventoryItem[]>('/api/inventory', { method: 'GET' });
}

export function createInventoryItem(data: unknown) {
  return apiRequest('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateInventoryItem(id: string, data: unknown) {
  return apiRequest(`/api/inventory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteInventoryItem(id: string) {
  return apiRequest(`/api/inventory/${id}`, { method: 'DELETE' });
}

export function fetchInventoryModuleOptions() {
  return apiRequest<InventoryModuleOptionsResponse>('/api/inventory/module/options');
}

export function fetchInventoryModuleAssets(params: {
  search?: string;
  mainItemId?: string;
  subItemId?: string;
  branchId?: string;
  assetType?: string;
  page?: number;
}) {
  return apiRequest<InventoryModuleAssetsResponse>(withQuery('/api/inventory/module/assets', {
    search: params.search,
    main_item_id: params.mainItemId,
    sub_item_id: params.subItemId,
    branch_id: params.branchId,
    asset_type: params.assetType,
    page: params.page,
  }));
}

export function createInventoryModuleAsset(payload: InventoryModuleAssetInput) {
  return apiRequest<InventoryModuleAsset>('/api/inventory/module/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateInventoryModuleAsset(id: string, payload: Partial<InventoryModuleAssetInput>) {
  return apiRequest<InventoryModuleAsset>(`/api/inventory/module/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryModuleAsset(id: string) {
  return apiRequest(`/api/inventory/module/assets/${id}`, { method: 'DELETE' });
}

export function fetchInventoryMainItems() {
  return apiRequest<InventoryModuleMainItem[]>('/api/inventory/module/items');
}

export function createInventoryMainItem(name: string) {
  return apiRequest<InventoryModuleMainItem>('/api/inventory/module/items', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateInventoryMainItem(id: string, name: string) {
  return apiRequest<InventoryModuleMainItem>(`/api/inventory/module/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteInventoryMainItem(id: string) {
  return apiRequest(`/api/inventory/module/items/${id}`, { method: 'DELETE' });
}

export function fetchInventorySubItems() {
  return apiRequest<InventoryModuleSubItem[]>('/api/inventory/module/sub-items');
}

export function createInventorySubItem(payload: {
  itemId: string;
  name: string;
  itemCode: string;
  companyName: string;
  supplierId?: string;
  operatingSystem: string;
  assetType: 'critical' | 'non_critical';
  remarks: string;
}) {
  return apiRequest<InventoryModuleSubItem>('/api/inventory/module/sub-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateInventorySubItem(id: string, payload: {
  itemId: string;
  name: string;
  itemCode: string;
  companyName: string;
  supplierId?: string;
  operatingSystem: string;
  assetType: 'critical' | 'non_critical';
  remarks: string;
}) {
  return apiRequest<InventoryModuleSubItem>(`/api/inventory/module/sub-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteInventorySubItem(id: string) {
  return apiRequest(`/api/inventory/module/sub-items/${id}`, { method: 'DELETE' });
}

export function fetchInventorySuppliers() {
  return apiRequest<InventoryModuleSupplier[]>('/api/inventory/module/suppliers');
}

export function createInventorySupplier(name: string, contactInfo: string) {
  return apiRequest<InventoryModuleSupplier>('/api/inventory/module/suppliers', {
    method: 'POST',
    body: JSON.stringify({ name, contactInfo }),
  });
}

export function updateInventorySupplier(id: string, name: string, contactInfo: string) {
  return apiRequest<InventoryModuleSupplier>(`/api/inventory/module/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, contactInfo }),
  });
}

export function deleteInventorySupplier(id: string) {
  return apiRequest(`/api/inventory/module/suppliers/${id}`, { method: 'DELETE' });
}

export function fetchInventoryModuleBranches() {
  return apiRequest<InventoryModuleBranch[]>('/api/inventory/module/branches');
}

export function createInventoryBranch(payload: { name: string; location: string; locationCode: string }) {
  return apiRequest<InventoryModuleBranch>('/api/inventory/module/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateInventoryBranch(id: string, payload: { name: string; location: string; locationCode: string; isActive: boolean }) {
  return apiRequest<InventoryModuleBranch>(`/api/inventory/module/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryBranch(id: string) {
  return apiRequest(`/api/inventory/module/branches/${id}`, { method: 'DELETE' });
}

export function fetchInventoryEntities() {
  return apiRequest<InventoryEntityOption[]>('/api/entities');
}

export function fetchInventoryModuleAudit(scope = 'inventory') {
  return apiRequest<InventoryModuleAuditListResponse>(withQuery('/api/audit', { module: scope }));
}

export function downloadInventoryModuleTemplate() {
  return downloadBlob('/api/inventory/module/template.csv');
}

export function exportInventoryModuleCsv() {
  return downloadBlob('/api/inventory/module/export.csv');
}

export async function importInventoryModuleCsv(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<InventoryModuleImportResult>('/api/inventory/module/import', {
    method: 'POST',
    body: formData,
  });
}

export function runInventoryStockOperation(payload: InventoryStockOperationInput) {
  return apiRequest('/api/inventory/module/stock-operations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
