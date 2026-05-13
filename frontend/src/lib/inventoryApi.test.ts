import { afterEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

vi.mock('./api', () => ({
  apiRequest: apiRequestMock,
}));

import {
  createInventoryBranch,
  createInventoryMainItem,
  createInventoryModuleAsset,
  deleteInventorySupplier,
  downloadInventoryModuleTemplate,
  exportInventoryModuleCsv,
  fetchInventoryModuleAssets,
  fetchInventoryModuleAudit,
  importInventoryModuleCsv,
  runInventoryStockOperation,
  updateInventorySubItem,
} from './inventoryApi';

describe('inventoryApi', () => {
  afterEach(() => {
    apiRequestMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds inventory module asset and audit query strings from provided params only', async () => {
    apiRequestMock.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [] });

    await fetchInventoryModuleAssets({
      search: 'laptop',
      mainItemId: 'main-1',
      subItemId: '',
      branchId: 'branch-1',
      assetType: 'critical',
      page: 3,
    });
    await fetchInventoryModuleAudit();

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/api/inventory/module/assets?search=laptop&main_item_id=main-1&branch_id=branch-1&asset_type=critical&page=3',
    );
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/api/inventory/module/audit?scope=inventory');
  });

  it('delegates create, update, delete, and stock operation payloads through apiRequest', async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await createInventoryMainItem('Laptop');
    await createInventoryModuleAsset({ assetTag: 'AST-1' } as never);
    await updateInventorySubItem('sub-1', {
      itemId: 'main-1',
      name: 'Latitude',
      itemCode: 'LAT-1',
      companyName: 'Zerodha',
      operatingSystem: 'Ubuntu',
      assetType: 'critical',
      remarks: 'Ready',
    });
    await createInventoryBranch({ name: 'HQ', location: 'Bangalore', locationCode: 'BLR' });
    await deleteInventorySupplier('supplier-1');
    await runInventoryStockOperation({ operation: 'allocate' } as never);

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/api/inventory/module/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Laptop' }),
    });
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/api/inventory/module/assets', {
      method: 'POST',
      body: JSON.stringify({ assetTag: 'AST-1' }),
    });
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/api/inventory/module/sub-items/sub-1', {
      method: 'PATCH',
      body: JSON.stringify({
        itemId: 'main-1',
        name: 'Latitude',
        itemCode: 'LAT-1',
        companyName: 'Zerodha',
        operatingSystem: 'Ubuntu',
        assetType: 'critical',
        remarks: 'Ready',
      }),
    });
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/api/inventory/module/branches', {
      method: 'POST',
      body: JSON.stringify({ name: 'HQ', location: 'Bangalore', locationCode: 'BLR' }),
    });
    expect(apiRequestMock).toHaveBeenNthCalledWith(5, '/api/inventory/module/suppliers/supplier-1', { method: 'DELETE' });
    expect(apiRequestMock).toHaveBeenNthCalledWith(6, '/api/inventory/module/stock-operations', {
      method: 'POST',
      body: JSON.stringify({ operation: 'allocate' }),
    });
  });

  it('downloads template and export csv blobs with the expected fetch options', async () => {
    const templateBlob = new Blob(['template']);
    const exportBlob = new Blob(['export']);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(templateBlob, { status: 200 }))
      .mockResolvedValueOnce(new Response(exportBlob, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const downloadedTemplate = await downloadInventoryModuleTemplate();
    const downloadedExport = await exportInventoryModuleCsv();

    await expect(downloadedTemplate.text()).resolves.toBe('template');
    await expect(downloadedExport.text()).resolves.toBe('export');
    expect(downloadedTemplate.size).toBe(templateBlob.size);
    expect(downloadedExport.size).toBe(exportBlob.size);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/inventory/module/template.csv', {
      credentials: 'include',
      headers: { Accept: 'text/csv,application/octet-stream,*/*' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/inventory/module/export.csv', {
      credentials: 'include',
      headers: { Accept: 'text/csv,application/octet-stream,*/*' },
    });
  });

  it('uploads inventory csv imports as FormData', async () => {
    const file = new File(['csv,data'], 'inventory.csv', { type: 'text/csv' });
    apiRequestMock.mockResolvedValue({ imported: 1 });

    await importInventoryModuleCsv(file);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/inventory/module/import');
    expect(apiRequestMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(apiRequestMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    const formData = apiRequestMock.mock.calls[0][1]?.body as FormData;
    expect(formData.get('file')).toBe(file);
  });
});