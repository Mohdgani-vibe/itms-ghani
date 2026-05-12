import { describe, expect, it } from 'vitest';

import type { AlertsListRecord } from './types';

import { alertsDetailAssetActionsReadOnly, resolveAlertConsoleNavigation } from './useAlertsDetailWorkflow';

const alertRecord: AlertsListRecord = {
  id: 'alert-1',
  assetId: 'asset-1',
  assetTag: 'AST-1',
  assetName: 'Laptop 1',
  hostname: 'host-1',
  deviceId: 'device-1',
  userId: 'user-1',
  userName: 'Ops User',
  userEmail: 'ops@example.com',
  department: 'IT',
  source: 'openscap',
  severity: 'medium',
  title: 'OpenSCAP hardening findings',
  detail: 'Detail',
  acknowledged: false,
  resolved: false,
  createdAt: '2026-05-12T10:00:00Z',
};

describe('alertsDetailAssetActionsReadOnly', () => {
  it('fails closed for retired assets', () => {
    expect(alertsDetailAssetActionsReadOnly('retired')).toBe(true);
  });

  it('keeps active assets actionable', () => {
    expect(alertsDetailAssetActionsReadOnly('in_use')).toBe(false);
  });
});

describe('resolveAlertConsoleNavigation', () => {
  it('uses the provided queue when the selected alert is present', () => {
    const nextAlert = { ...alertRecord, id: 'alert-2', createdAt: '2026-05-12T09:00:00Z' };

    expect(resolveAlertConsoleNavigation(nextAlert, [alertRecord, nextAlert])).toEqual({
      items: [alertRecord, nextAlert],
      index: 1,
    });
  });

  it('falls back to same-asset alerts when the selected alert is missing from the queue', () => {
    const selectedAlert = { ...alertRecord, id: 'selected-alert' };
    const sameAssetAlert = { ...alertRecord, id: 'related-alert', createdAt: '2026-05-12T09:00:00Z' };
    const otherAssetAlert = { ...alertRecord, id: 'other-alert', assetId: 'asset-2', deviceId: 'device-2', hostname: 'host-2', assetTag: 'AST-2' };

    expect(resolveAlertConsoleNavigation(selectedAlert, [otherAssetAlert, sameAssetAlert])).toEqual({
      items: [selectedAlert, sameAssetAlert],
      index: 0,
    });
  });
});