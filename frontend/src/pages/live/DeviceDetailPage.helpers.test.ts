import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });
});

import {
  alertSourceLabel,
  buildLifecycleFormState,
  dedupeAssignableUsers,
  formatLifecycleCurrency,
  formatStatusLabel,
  isComputeAsset,
  isPatchJobForDevice,
  normalizeAssignableUsers,
  parseEnrollmentDetails,
  softwareSourceLabel,
  toDateInputValue,
  toolStatusTone,
} from './deviceDetailPageUtils';

describe('DeviceDetailPage helpers', () => {
  it('matches patch jobs against hostname, asset id, and salt identifier', () => {
    const device = {
      hostname: 'ops-laptop-01',
      assetId: 'AST-100',
      toolStatus: {
        salt: {
          identifier: 'minion-001',
        },
      },
    };

    const buildPatchJob = (scope: string) => ({
      id: `job-${scope}`,
      jid: `jid-${scope}`,
      status: 'completed',
      createdAt: '2026-05-09T12:00:00Z',
      scope,
    });

    expect(isPatchJobForDevice(buildPatchJob('ops-laptop-01'), device as never)).toBe(true);
    expect(isPatchJobForDevice(buildPatchJob(' ast-100 '), device as never)).toBe(true);
    expect(isPatchJobForDevice(buildPatchJob('MINION-001'), device as never)).toBe(true);
    expect(isPatchJobForDevice(buildPatchJob('other-device'), device as never)).toBe(false);
  });

  it('detects compute assets from device type or os name', () => {
    expect(isComputeAsset({ deviceType: 'Laptop', osName: '' } as never)).toBe(true);
    expect(isComputeAsset({ deviceType: 'Office Workstation', osName: '' } as never)).toBe(true);
    expect(isComputeAsset({ deviceType: 'Monitor', osName: 'Ubuntu 24.04' } as never)).toBe(true);
    expect(isComputeAsset({ deviceType: 'Monitor', osName: '' } as never)).toBe(false);
  });

  it('parses enrollment details from key value lines', () => {
    expect(
      parseEnrollmentDetails([
        'Minion ID: minion-001',
        ' Manager : salt-master-1 ',
        'No separator line',
        'Empty Value:',
      ].join('\n')),
    ).toEqual({
      'minion id': 'minion-001',
      manager: 'salt-master-1',
    });
  });

  it('formats lifecycle metadata and source labels', () => {
    expect(formatStatusLabel('retired_asset')).toBe('retired asset');
    expect(formatStatusLabel('   ')).toBe('Unknown');
    expect(formatLifecycleCurrency()).toBe('Cost not tracked');
    expect(formatLifecycleCurrency('abc')).toBe('abc');
    expect(formatLifecycleCurrency('1200')).toContain('1,200');
    expect(alertSourceLabel('openscap')).toBe('OpenSCAP Hardening');
    expect(alertSourceLabel('clamav')).toBe('ClamScan');
    expect(alertSourceLabel('')).toBe('Unknown source');
    expect(softwareSourceLabel('registry')).toBe('Registry');
    expect(softwareSourceLabel('snapd')).toBe('snapd');
    expect(softwareSourceLabel(undefined)).toBe('Unknown source');
    expect(toolStatusTone('linked')).toBe('bg-emerald-100 text-emerald-700');
    expect(toolStatusTone('missing' as never)).toBe('bg-zinc-100 text-zinc-700');
    expect(toDateInputValue('2026-05-09T12:00:00Z')).toBe('2026-05-09');
    expect(toDateInputValue()).toBe('');
  });

  it('normalizes assignable users, dedupes by id, and builds lifecycle form state', () => {
    expect(normalizeAssignableUsers([
      {
        id: 'user-1',
        full_name: 'Alex Kumar',
        email: 'alex@example.com',
        emp_id: 'EMP-1',
        status: 'active',
        role: 'it_team',
      },
      {
        id: 'user-2',
        full_name: 'Admin User',
        email: 'admin@example.com',
        emp_id: 'ADM-1',
        status: 'active',
        role: 'super_admin',
      },
    ] as never)).toEqual([
      {
        id: 'user-1',
        fullName: 'Alex Kumar',
        email: 'alex@example.com',
        employeeCode: 'EMP-1',
        status: 'active',
      },
    ]);

    expect(dedupeAssignableUsers([
      { id: 'user-1', fullName: 'Alex Kumar' },
      { id: 'user-1', fullName: 'Duplicate' },
      { id: 'user-2', fullName: 'Priya Nair' },
    ] as never)).toEqual([
      { id: 'user-1', fullName: 'Alex Kumar' },
      { id: 'user-2', fullName: 'Priya Nair' },
    ]);

    expect(buildLifecycleFormState({
      asset_tag: 'AST-100',
      category: 'Laptop',
      model: 'ThinkPad',
      purchase_date: '2026-01-10T00:00:00Z',
      warranty_until: '2028-01-10T00:00:00Z',
      cost: '1200',
      notes: 'Assigned to IT',
    } as never)).toEqual({
      assetTag: 'AST-100',
      category: 'Laptop',
      model: 'ThinkPad',
      purchaseDate: '2026-01-10',
      warrantyUntil: '2028-01-10',
      cost: '1200',
      notes: 'Assigned to IT',
    });
  });
});
