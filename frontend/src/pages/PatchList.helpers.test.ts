import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });
});

import { buildPatchBatchDevicesUrl, buildPatchDevicesUrl, countActionablePatchDevices, derivePatchPermissions, formatPatchDepartmentConsoleTitle, formatPatchDepartmentSystemsLabel, formatPatchDevicesTotalLabel, formatPatchRunSuccessMessage, formatPatchScopeLabel, normalizePatchDepartmentOptions, selectActionablePatchDevices, selectDepartmentSystems, selectVisiblePatchReports, summarizePatchRunRows } from './PatchList';

describe('PatchList helpers', () => {
  it('builds the default patch devices query', () => {
    expect(buildPatchDevicesUrl(3, '', 'all')).toBe('/api/patch/devices?paginate=1&page=3&page_size=20');
  });

  it('trims search text and appends the department filter', () => {
    expect(buildPatchDevicesUrl(2, '  laptop  ', 'Operations')).toBe(
      '/api/patch/devices?paginate=1&page=2&page_size=20&search=laptop&department=Operations',
    );
  });

  it('formats the loading and search labels', () => {
    expect(formatPatchDevicesTotalLabel(true, '', 'all', 0)).toBe('Loading devices');
    expect(formatPatchDevicesTotalLabel(false, ' surface ', 'all', 8)).toBe('8 devices match this search');
  });

  it('formats the department and default totals', () => {
    expect(formatPatchDevicesTotalLabel(false, '', 'Infrastructure', 5)).toBe('5 managed devices in Infrastructure');
    expect(formatPatchDevicesTotalLabel(false, '', 'all', 12)).toBe('12 managed devices');
  });

  it('formats the department systems label', () => {
    expect(formatPatchDepartmentSystemsLabel('all')).toBe('Current Systems');
    expect(formatPatchDepartmentSystemsLabel('Infrastructure')).toBe('Infrastructure Systems');
  });

  it('counts only actionable patch devices', () => {
    expect(countActionablePatchDevices([
      { id: 'dev-1', hostname: 'host-1', patchStatus: 'pending', status: 'active' },
      { id: 'dev-2', hostname: 'host-2', patchStatus: 'pending', status: ' retired ' },
      { id: 'dev-3', hostname: 'host-3', patchStatus: 'done', status: null },
    ])).toBe(2);
  });

  it('selects only actionable patch devices', () => {
    expect(selectActionablePatchDevices([
      { id: 'dev-1', hostname: 'host-1', patchStatus: 'pending', status: 'active' },
      { id: 'dev-2', hostname: 'host-2', patchStatus: 'pending', status: ' retired ' },
      { id: 'dev-3', hostname: 'host-3', patchStatus: 'done', status: null },
    ])).toEqual([
      { id: 'dev-1', hostname: 'host-1', patchStatus: 'pending', status: 'active' },
      { id: 'dev-3', hostname: 'host-3', patchStatus: 'done', status: null },
    ]);
  });

  it('formats the patch scope label', () => {
    expect(formatPatchScopeLabel('all')).toBe('All departments');
    expect(formatPatchScopeLabel('Infrastructure')).toBe('Infrastructure department');
  });

  it('builds the batch patch devices url', () => {
    expect(buildPatchBatchDevicesUrl('all')).toBe('/api/patch/devices');
    expect(buildPatchBatchDevicesUrl('Infrastructure')).toBe('/api/patch/devices?department=Infrastructure');
  });

  it('normalizes patch department options', () => {
    expect(normalizePatchDepartmentOptions()).toEqual(['all']);
    expect(normalizePatchDepartmentOptions([
      { id: '2', name: 'Operations' },
      { id: '1', name: 'Infrastructure' },
      { id: '3', name: 'Operations' },
      { id: '4', name: '' },
    ])).toEqual(['all', 'Infrastructure', 'Operations']);
  });

  it('derives patch permissions from the signed-in role', () => {
    expect(derivePatchPermissions('super_admin')).toEqual({ canOperate: true, canViewReports: true });
    expect(derivePatchPermissions('IT_TEAM')).toEqual({ canOperate: true, canViewReports: true });
    expect(derivePatchPermissions('auditor')).toEqual({ canOperate: false, canViewReports: false });
    expect(derivePatchPermissions(undefined)).toEqual({ canOperate: false, canViewReports: false });
  });

  it('formats the department console picker title', () => {
    expect(formatPatchDepartmentConsoleTitle('all')).toBe('Choose a system from all departments');
    expect(formatPatchDepartmentConsoleTitle('Infrastructure')).toBe('Choose a system from Infrastructure');
  });

  it('summarizes patch run rows by success and failure', () => {
    expect(summarizePatchRunRows([
      { status: 'success' },
      { status: 'failed' },
      { status: 'success' },
      { status: 'pending' },
    ] as never)).toEqual({ successCount: 2, failedCount: 1 });
  });

  it('formats the patch run success message', () => {
    expect(formatPatchRunSuccessMessage({ successCount: 3, failedCount: 1 }, 'All departments')).toBe(
      'Requested 3 Salt patch run(s). 1 device(s) failed.',
    );
    expect(formatPatchRunSuccessMessage({ successCount: 4, failedCount: 0 }, 'Infrastructure department')).toBe(
      'Requested 4 Salt patch run(s) for infrastructure department.',
    );
  });

  it('limits visible recent reports unless show-all is enabled', () => {
    const reports = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];

    expect(selectVisiblePatchReports(reports, false)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    expect(selectVisiblePatchReports(reports, true)).toEqual(reports);
  });

  it('caps department systems to the first eight devices', () => {
    const devices = Array.from({ length: 10 }, (_, index) => ({
      id: `dev-${index + 1}`,
      hostname: `host-${index + 1}`,
      patchStatus: 'pending',
      status: 'active',
    }));

    expect(selectDepartmentSystems(devices)).toHaveLength(8);
    expect(selectDepartmentSystems(devices)[0]?.id).toBe('dev-1');
    expect(selectDepartmentSystems(devices)[7]?.id).toBe('dev-8');
  });
});