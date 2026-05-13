import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/userVisibility', () => ({
  isProbeLikeUser: vi.fn((user: { email?: string }) => user.email === 'probe@example.com'),
}));

import {
  PORTAL_CHOICES,
  formatPortalLabel,
  formatRoleNameLabel,
  mergeDepartmentSuggestions,
  normalizePortalSelection,
  normalizeSelectFilterValue,
  normalizeUsers,
  portalsToRole,
} from './userDirectoryUtils';

describe('userDirectoryUtils', () => {
  it('normalizes portal selections and derives the dominant role', () => {
    expect(PORTAL_CHOICES.map((portal) => portal.id)).toEqual(['employee', 'auditor', 'it_team', 'super_admin']);
    expect(normalizePortalSelection([' auditor ', 'employee'])).toEqual(['auditor']);
    expect(normalizePortalSelection(['it_team'])).toEqual(['employee', 'it_team']);
    expect(normalizePortalSelection(['super_admin', 'auditor'])).toEqual(['employee', 'it_team', 'super_admin']);
    expect(normalizePortalSelection([])).toEqual(['employee']);

    expect(portalsToRole(['employee'])).toBe('employee');
    expect(portalsToRole(['auditor', 'employee'])).toBe('auditor');
    expect(portalsToRole(['it_team'])).toBe('it_team');
    expect(portalsToRole(['super_admin'])).toBe('super_admin');
  });

  it('formats portal and role labels and normalizes empty select values', () => {
    expect(formatPortalLabel('it_team')).toBe('IT Team');
    expect(formatPortalLabel('custom_portal')).toBe('custom portal');
    expect(formatRoleNameLabel('super_admin')).toBe('super admin');
    expect(formatRoleNameLabel('')).toBe('Employee');
    expect(normalizeSelectFilterValue('active')).toBe('active');
    expect(normalizeSelectFilterValue('')).toBe('all');
  });

  it('merges preset and existing department suggestions without duplicates', () => {
    const merged = mergeDepartmentSuggestions([
      { id: 'dept-1', name: 'HR' },
      { id: 'dept-2', name: '  New Lab  ' },
      { id: 'dept-3', name: 'hr' },
    ]);

    expect(merged.find((option) => option.name === 'HR')).toEqual({ id: 'dept-1', name: 'HR' });
    expect(merged.find((option) => option.name.trim() === 'New Lab')).toEqual({ id: 'dept-2', name: '  New Lab  ' });
    expect(merged.filter((option) => option.name.toLowerCase() === 'hr')).toHaveLength(1);
  });

  it('normalizes API users and filters probe-like records', () => {
    const normalized = normalizeUsers([
      {
        id: 'user-1',
        full_name: 'Alex Kumar',
        email: 'alex@example.com',
        emp_id: 'EMP-1',
        status: 'active',
        entity_id: 'entity-1',
        dept_id: 'dept-1',
        location_id: 'branch-1',
        role: 'it_team',
        department: 'IT',
        location: 'HQ',
        device_count: 2,
        item_count: 3,
        asset_count: 5,
      },
      {
        id: 'user-2',
        full_name: 'Probe User',
        email: 'probe@example.com',
        emp_id: 'EMP-2',
        status: 'active',
        role: 'employee',
        asset_count: 1,
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'user-1',
      fullName: 'Alex Kumar',
      employeeCode: 'EMP-1',
      portals: ['it_team', 'employee'],
      department: { name: 'IT' },
      branch: { name: 'HQ' },
      _count: { devices: 2, items: 3, assets: 5 },
    });
  });
});