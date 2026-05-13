import { describe, expect, it } from 'vitest';

import { alertSourceRowsForCsv, sourceAlertsForSystem, summarizeAlertSourceDepartments, summarizeAlertSourceSystems } from './alertsWorkspace';

const baseAlert = {
  acknowledged: false,
  resolved: false,
  detail: 'detail',
  sourceLabel: 'Wazuh',
  sourceRaw: 'wazuh',
};

describe('alertsWorkspace', () => {
  const alerts = [
    {
      ...baseAlert,
      id: 'alert-1',
      assetId: 'asset-1',
      assetTag: 'LAP-001',
      assetName: 'Laptop 1',
      hostname: 'lap-001',
      deviceId: 'asset-1',
      userId: 'user-1',
      userName: 'Alex',
      userEmail: 'alex@example.com',
      department: 'Engineering',
      source: 'wazuh',
      severity: 'high',
      title: 'Rootcheck finding',
      createdAt: '2026-05-02T05:00:00Z',
    },
    {
      ...baseAlert,
      id: 'alert-2',
      assetId: 'asset-1',
      assetTag: 'LAP-001',
      assetName: 'Laptop 1',
      hostname: 'lap-001',
      deviceId: 'asset-1',
      userId: 'user-1',
      userName: 'Alex',
      userEmail: 'alex@example.com',
      department: 'Engineering',
      source: 'wazuh',
      severity: 'medium',
      title: 'Compliance finding',
      acknowledged: true,
      createdAt: '2026-05-02T04:00:00Z',
    },
    {
      ...baseAlert,
      id: 'alert-3',
      assetId: 'asset-2',
      assetTag: 'LAP-002',
      assetName: 'Laptop 2',
      hostname: 'lap-002',
      deviceId: 'asset-2',
      userId: 'user-2',
      userName: 'Jordan',
      userEmail: 'jordan@example.com',
      department: 'Finance',
      source: 'wazuh',
      severity: 'low',
      title: 'Resolved finding',
      resolved: true,
      createdAt: '2026-05-01T03:00:00Z',
    },
  ];

  it('summarizes departments with system counts', () => {
    expect(summarizeAlertSourceDepartments(alerts)).toEqual([
      {
        key: 'Engineering',
        name: 'Engineering',
        alertCount: 2,
        openCount: 2,
        resolvedCount: 0,
        systemCount: 1,
        latestCreatedAt: '2026-05-02T05:00:00Z',
      },
      {
        key: 'Finance',
        name: 'Finance',
        alertCount: 1,
        openCount: 0,
        resolvedCount: 1,
        systemCount: 1,
        latestCreatedAt: '2026-05-01T03:00:00Z',
      },
    ]);
  });

  it('summarizes systems for a selected department', () => {
    expect(summarizeAlertSourceSystems(alerts, 'Engineering')).toEqual([
      {
        key: 'asset-1',
        assetId: 'asset-1',
        deviceId: 'asset-1',
        department: 'Engineering',
        name: 'lap-001',
        assetTag: 'LAP-001',
        hostname: 'lap-001',
        userName: 'Alex',
        userEmail: 'alex@example.com',
        alertCount: 2,
        openCount: 2,
        criticalCount: 1,
        latestCreatedAt: '2026-05-02T05:00:00Z',
      },
    ]);
  });

  it('returns system alerts newest first', () => {
    expect(sourceAlertsForSystem(alerts, 'asset-1').map((alert) => alert.id)).toEqual(['alert-1', 'alert-2']);
  });

  it('builds CSV rows with normalized status', () => {
    expect(alertSourceRowsForCsv(alerts)[0]).toMatchObject({
      department: 'Engineering',
      system: 'lap-001',
      severity: 'high',
      status: 'Open',
      source: 'Wazuh',
    });
  });
});