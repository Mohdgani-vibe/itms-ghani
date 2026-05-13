import { beforeEach, describe, expect, it, vi } from 'vitest';

const devicesLoaderMocks = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  apiRequest: devicesLoaderMocks.apiRequestMock,
}));

import { loadInventoryData, loadUnassignedDeviceCount } from './Devices';

describe('Devices loaders', () => {
  beforeEach(() => {
    devicesLoaderMocks.apiRequestMock.mockReset();
  });

  it('loads the unassigned device count from the devices endpoint', async () => {
    devicesLoaderMocks.apiRequestMock.mockResolvedValueOnce({
      items: [],
      total: 17,
      page: 1,
      pageSize: 1,
    });

    await expect(loadUnassignedDeviceCount()).resolves.toBe(17);
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenCalledWith(
      '/api/devices?paginate=1&page=1&page_size=1&assigned=unassigned',
    );
  });

  it('loads device data and sync status when requested', async () => {
    const deviceData = { items: [{ id: 'dev-1' }], total: 1, page: 2, pageSize: 50 };
    const statusData = {
      enabled: true,
      configured: true,
      sourceType: 'salt',
      interval: '15m',
      running: false,
    };

    devicesLoaderMocks.apiRequestMock
      .mockResolvedValueOnce(deviceData)
      .mockResolvedValueOnce(statusData);

    await expect(loadInventoryData(2, '  alex  ', 'assigned', true)).resolves.toEqual({
      deviceData,
      statusData,
    });
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/api/devices?paginate=1&page=2&page_size=50&search=alex&assigned=assigned',
    );
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenNthCalledWith(2, '/api/inventory-sync/status');
  });

  it('skips sync status when not requested', async () => {
    const deviceData = { items: [], total: 0, page: 1, pageSize: 50 };

    devicesLoaderMocks.apiRequestMock.mockResolvedValueOnce(deviceData);
    await expect(loadInventoryData(1, '', 'all', false)).resolves.toEqual({
      deviceData,
      statusData: null,
    });
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenCalledTimes(1);
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenCalledWith(
      '/api/devices?paginate=1&page=1&page_size=50',
    );
  });

  it('tolerates sync lookup failures when sync status is requested', async () => {
    const deviceData = { items: [], total: 0, page: 1, pageSize: 50 };

    devicesLoaderMocks.apiRequestMock
      .mockResolvedValueOnce(deviceData)
      .mockRejectedValueOnce(new Error('status unavailable'));

    await expect(loadInventoryData(1, '', 'unassigned', true)).resolves.toEqual({
      deviceData,
      statusData: null,
    });
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/api/devices?paginate=1&page=1&page_size=50&assigned=unassigned',
    );
    expect(devicesLoaderMocks.apiRequestMock).toHaveBeenNthCalledWith(2, '/api/inventory-sync/status');
  });
});