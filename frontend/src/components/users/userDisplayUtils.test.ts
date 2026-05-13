import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_AUDIT_ACTION_PRESETS,
  TOOL_STATUS_ITEMS,
  assetPresenceState,
  formatAssignmentAge,
  formatAuditActionLabel,
  formatAuditModuleLabel,
  formatCurrency,
  formatToolStatusLabel,
  formatWarranty,
  getAuditModule,
  getToolBadgeClasses,
  parseEnrollmentDetails,
  resolveAuditEntityPath,
} from './userDisplayUtils';

describe('userDisplayUtils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses enrollment details and exposes tool status presets', () => {
    expect(parseEnrollmentDetails('Owner: Alex\nDepartment: IT\nInvalid line\nSerial: SN-1')).toEqual({
      owner: 'Alex',
      department: 'IT',
      serial: 'SN-1',
    });
    expect(TOOL_STATUS_ITEMS).toContainEqual(['salt', 'Salt']);
    expect(ACCESS_AUDIT_ACTION_PRESETS).toContain('user_imported');
  });

  it('maps tool and audit labels to user-facing values', () => {
    expect(getToolBadgeClasses('linked')).toBe('bg-emerald-100 text-emerald-700');
    expect(getToolBadgeClasses('installed')).toBe('bg-brand-100 text-brand-700');
    expect(getToolBadgeClasses('detected')).toBe('bg-amber-100 text-amber-700');
    expect(getToolBadgeClasses('missing')).toBe('bg-zinc-100 text-zinc-600');

    expect(formatToolStatusLabel('linked')).toBe('Linked');
    expect(formatToolStatusLabel('installed')).toBe('Installed');
    expect(formatToolStatusLabel('detected')).toBe('Detected');
    expect(formatToolStatusLabel()).toBe('Missing');

    expect(getAuditModule({ entityType: 'device' })).toBe('assets');
    expect(getAuditModule({ entityType: 'chat_channel' })).toBe('chat');
    expect(getAuditModule({ entityType: 'unknown' })).toBe('all');

    expect(formatAuditModuleLabel('requests')).toBe('Requests');
    expect(formatAuditModuleLabel('all')).toBe('All');
    expect(formatAuditActionLabel('user_updated')).toBe('User Updates');
    expect(formatAuditActionLabel('custom_action')).toBe('custom action');
  });

  it('resolves audit paths and formats assignment, warranty, and currency values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T00:00:00Z'));

    expect(resolveAuditEntityPath('/it', { entityType: 'user', entityId: 'u-1' })).toBe('/it/users/u-1');
    expect(resolveAuditEntityPath('/it', { entityType: 'asset', entityId: 'a-1' })).toBe('/it/devices/a-1');
    expect(resolveAuditEntityPath('/it', { entityType: 'alert', entityId: 'al-1' })).toBe('/it/alerts');
    expect(resolveAuditEntityPath('/it', { entityType: 'setting', entityId: 's-1' })).toBe('');

    expect(formatWarranty('')).toBe('Warranty not tracked');
    expect(formatWarranty('2026-05-01T00:00:00Z')).toBe(new Date('2026-05-01T00:00:00Z').toLocaleDateString());

    expect(formatCurrency()).toBe('Cost not tracked');
    expect(formatCurrency('not-a-number')).toBe('not-a-number');
    expect(formatCurrency('12345')).toContain('12,345');

    expect(formatAssignmentAge()).toBe('Assignment date unavailable');
    expect(formatAssignmentAge('2026-05-08T00:00:00Z')).toBe('1 day in use');
    expect(formatAssignmentAge('2026-05-06T00:00:00Z')).toBe('3 days in use');
  });

  it('reports retained, recently seen, and offline asset presence states', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    expect(assetPresenceState()).toMatchObject({
      label: 'Retained',
      classes: 'bg-zinc-100 text-zinc-700',
    });
    expect(assetPresenceState('not-a-date')).toMatchObject({
      label: 'Retained',
      classes: 'bg-zinc-100 text-zinc-700',
    });
    expect(assetPresenceState('2026-05-09T06:00:00Z')).toMatchObject({
      label: 'Recently Seen',
      classes: 'bg-emerald-100 text-emerald-700',
    });
    expect(assetPresenceState('2026-05-07T06:00:00Z')).toMatchObject({
      label: 'Offline',
      classes: 'bg-amber-100 text-amber-800',
    });
  });
});