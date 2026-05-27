import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildNoteTemplate,
  formatDateTime,
  formatRelativeTime,
  formatStatusLabel,
  formatTypeLabel,
  getFreshnessTone,
  getRequestAssigneeLabel,
  getSectionTone,
  getStatusClasses,
  getTypeFilterLabel,
  normalizeQueueRequest,
  normalizeWorkflowSettings,
  parseEnrollmentDetails,
  parseRequestDetails,
} from './requestsQueuePageUtils';

describe('RequestsQueuePage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes workflow settings and queue request defaults', () => {
    expect(normalizeWorkflowSettings({ ticketAssigneeIds: ['user-1', '', '  ', 'user-2'] })).toEqual({
      ticketAssigneeIds: ['user-1', 'user-2'],
    });
    expect(normalizeWorkflowSettings(null)).toEqual({ ticketAssigneeIds: [] });

    expect(normalizeQueueRequest({
      id: 'req-1',
      type: 'other',
      title: '',
      description: '',
      notes: '',
      status: 'pending',
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:00:00Z',
      requester: null as never,
      assignee: null as never,
      comments: [null, { id: 'c-1', note: 'hello', author: 'IT', createdAt: '2026-05-09T10:00:00Z' }] as never,
    } as never)).toMatchObject({
      title: '',
      description: '',
      notes: '',
      requester: {},
      assignee: {},
      comments: [{ id: 'c-1', note: 'hello', author: 'IT', createdAt: '2026-05-09T10:00:00Z' }],
    });
  });

  it('formats labels, classes, and section tones', () => {
    expect(formatStatusLabel('in_progress')).toBe('in progress');
    expect(formatTypeLabel('device_enrollment')).toBe('Enrollment');
    expect(formatTypeLabel('hardware_replacement')).toBe('hardware replacement');
    expect(getTypeFilterLabel('device_enrollment')).toBe('Enrollment reviews');
    expect(getTypeFilterLabel('other')).toBe('Other requests');
    expect(getTypeFilterLabel('laptop_change')).toBe('All request types');
    expect(getStatusClasses('resolved')).toBe('bg-emerald-100 text-emerald-700');
    expect(getStatusClasses('rejected')).toBe('bg-rose-100 text-rose-700');
    expect(getStatusClasses('in_progress')).toBe('bg-amber-100 text-amber-700');
    expect(getStatusClasses('pending')).toBe('bg-zinc-100 text-zinc-700');
    expect(getSectionTone('enrollment')).toMatchObject({
      shell: 'border-brand-200 bg-brand-50/40',
      badge: 'bg-brand-100 text-brand-700',
    });
    expect(getSectionTone('support')).toMatchObject({
      shell: 'border-sky-100 bg-white/95 shadow-sm backdrop-blur',
      badge: 'bg-sky-100 text-sky-700',
    });
  });

  it('parses request detail lines and assignee labels', () => {
    expect(parseEnrollmentDetails('Device: Laptop\nOwner: Alex\nIgnored line')).toEqual({
      device: 'Laptop',
      owner: 'Alex',
    });
    expect(parseRequestDetails('Subject: Portal access\nReason: Transfer')).toEqual({
      subject: 'Portal access',
      reason: 'Transfer',
    });
    expect(getRequestAssigneeLabel({ assignee: { fullName: '  Priya Nair ' } } as never, false)).toBe('Priya Nair');
    expect(getRequestAssigneeLabel({ status: 'resolved', assignee: {} } as never, true)).toBe('Auto-resolved');
    expect(getRequestAssigneeLabel({ status: 'rejected', assignee: {} } as never, true)).toBe('No IT owner');
    expect(getRequestAssigneeLabel({ status: 'pending', assignee: {} } as never, true)).toBe('Needs IT review');
    expect(getRequestAssigneeLabel({ status: 'pending', assignee: {} } as never, false)).toBe('Unassigned');
  });

  it('formats queue timing and note templates from the current clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T12:00:00Z').getTime());

    expect(formatDateTime('2026-05-09T10:00:00Z')).not.toBe('Invalid Date');
    expect(formatRelativeTime('2026-05-09T11:59:00Z')).toBe('1m ago');
    expect(formatRelativeTime('2026-05-09T10:00:00Z')).toBe('2h ago');
    expect(formatRelativeTime('2026-05-07T12:00:00Z')).toBe('2d ago');
    expect(getFreshnessTone('2026-05-06T11:00:00Z')).toBe('bg-rose-100 text-rose-700');
    expect(getFreshnessTone('2026-05-08T11:00:00Z')).toBe('bg-amber-100 text-amber-700');
    expect(getFreshnessTone('2026-05-09T11:00:00Z')).toBe('bg-emerald-100 text-emerald-700');
    expect(buildNoteTemplate('triage')).toContain('Initial triage completed');
    expect(buildNoteTemplate('waiting')).toContain('Waiting on requester confirmation');
    expect(buildNoteTemplate('resolved')).toContain('Work completed');
  });
});