import { describe, expect, it } from 'vitest';

import { buildDeviceDetailViewData } from './deviceDetailViewData';

describe('buildDeviceDetailViewData', () => {
  it('builds compute-asset overview, remote status, and detail sections', () => {
    const result = buildDeviceDetailViewData({
      device: {
        hostname: 'workstation-01',
        status: 'active',
        assetId: 'asset-1',
        complianceScore: 92,
        manufacturer: 'Dell',
        model: 'Latitude 7440',
        deviceType: 'Laptop',
        network: {
          wired_ip: '10.0.0.10',
          wireless_ip: '10.0.0.11',
          netbird_ip: '100.64.0.1',
          gateway: '10.0.0.1',
          dns: '8.8.8.8',
        },
        toolStatus: {
          salt: { status: 'linked' },
          wazuh: { status: 'installed' },
          openscap: { status: 'missing' },
          clamav: { status: 'detected' },
        },
        volumes: [{ encrypted: true }, { encrypted: false }],
        patchStatus: 'needs_attention',
        alertStatus: 'monitoring',
        osName: 'Ubuntu',
      },
      computeAsset: true,
      installedAppCount: 24,
      sshTerminalReady: true,
      formatDate: (value) => `DATE:${value ?? ''}`,
      formatDetailValue: (value, fallback = 'Not reported') => value || fallback,
    });

    expect(result.encryptedVolumeCount).toBe(1);
    expect(result.hardwareDetails).toContainEqual({ label: 'Manufacturer', value: 'Dell' });
    expect(result.operatingSystemDetails).toContainEqual({ label: 'Platform', value: 'Linux' });
    expect(result.operatingSystemDetails).toContainEqual({ label: 'Installed Software', value: '24' });
    expect(result.remoteIdentifierDetails).toContainEqual({ label: 'SSH Target', value: '100.64.0.1' });
    expect(result.remoteToolStatuses).toContainEqual({
      label: 'SSH',
      status: { status: 'installed', detail: 'SSH terminal can use 100.64.0.1' },
    });
    expect(result.networkSummaryItems).toContainEqual({ label: 'Gateway', value: '10.0.0.1' });
    expect(result.overviewCards.map((card) => [card.label, card.value])).toEqual([
      ['Status', 'active'],
      ['Patch Status', 'needs attention'],
      ['Alert Status', 'monitoring'],
      ['Compliance', '92%'],
    ]);
  });

  it('builds non-compute overview fallbacks and missing ssh details', () => {
    const result = buildDeviceDetailViewData({
      device: {
        hostname: 'printer-01',
        status: 'inventory',
        assetId: 'asset-2',
        complianceScore: 0,
        deviceType: 'Printer',
        user: { fullName: 'Alex Kumar' },
      },
      computeAsset: false,
      installedAppCount: 0,
      sshTerminalReady: false,
      formatDate: (value) => `DATE:${value ?? ''}`,
      formatDetailValue: (value, fallback = 'Not reported') => value || fallback,
    });

    expect(result.remoteToolStatuses).toContainEqual({
      label: 'SSH',
      status: { status: 'missing', detail: 'SSH server integration is not configured' },
    });
    expect(result.overviewCards.map((card) => [card.label, card.value])).toEqual([
      ['Status', 'inventory'],
      ['Asset Type', 'Printer'],
      ['Assigned To', 'Alex Kumar'],
      ['Warranty', 'DATE:'],
    ]);
  });
});