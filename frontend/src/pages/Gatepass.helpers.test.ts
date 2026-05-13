import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBarcodeGeometry,
  draftGatepassNumber,
  escapeHtml,
  fieldDisplayValue,
  formatDisplayDate,
  formatIssueTime,
  formatStatusLabel,
  gatepassDisplayNumber,
  hasDisplayValue,
  initialsFromName,
  normalizeBarcodeValue,
  renderBarcodeSvgMarkup,
  todayDate,
  userDisplayName,
  validateGatepassForm,
} from './Gatepass';

describe('Gatepass helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats ISO dates for display and preserves unknown input', () => {
    expect(formatDisplayDate('2026-05-09')).toBe('09-May-2026');
    expect(formatDisplayDate(' 2026-13-09 ')).toBe('2026-13-09');
    expect(formatDisplayDate('')).toBe('-');
  });

  it('normalizes optional display values', () => {
    expect(hasDisplayValue('  value  ')).toBe(true);
    expect(hasDisplayValue('   ')).toBe(false);
    expect(fieldDisplayValue('  value  ')).toBe('value');
    expect(fieldDisplayValue('')).toBe('— not filled —');
  });

  it('formats issue times and falls back for invalid input', () => {
    expect(formatIssueTime('2026-05-09T14:30:00Z')).toMatch(/^\d{2}:\d{2}\s(?:AM|PM)$/);
    expect(formatIssueTime('not-a-date')).toBe('09:42 AM');
  });

  it('derives initials from the first two name parts', () => {
    expect(initialsFromName('John Doe')).toBe('JD');
    expect(initialsFromName('john middle doe')).toBe('JM');
    expect(initialsFromName('')).toBe('??');
  });

  it('derives user labels and validates required form fields', () => {
    expect(userDisplayName({ fullName: 'Alex Kumar' } as never)).toBe('Alex Kumar');
    expect(userDisplayName({ full_name: 'Alex K.' } as never)).toBe('Alex K.');
    expect(userDisplayName({} as never)).toBe('');

    expect(validateGatepassForm({
      originBranch: '',
      recipientBranch: '',
      issueDate: '',
      employeeName: '',
      employeeCode: '',
      departmentName: '',
      approverName: '',
      assetRef: '',
      assetDescription: '',
      purpose: '',
    } as never)).toMatchObject({
      originBranch: 'From branch is required',
      recipientBranch: 'Receiver branch is required',
      issueDate: 'Issue date is required',
      employeeName: 'Employee name is required',
      employeeCode: 'Employee ID is required',
      departmentName: 'Department is required',
      approverName: 'Approver name is required',
      assetRef: 'Asset tag or ID is required',
      assetDescription: 'Asset description is required',
      purpose: 'Purpose is required',
    });
  });

  it('builds gatepass numbering and status labels from the current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));

    expect(todayDate()).toBe('2026-05-09');
    expect(draftGatepassNumber('2026-05-01')).toBe('ZGP-20260501-0001');
    expect(draftGatepassNumber('')).toBe('ZGP-20260509-0001');
    expect(formatStatusLabel('security_signed')).toBe('security signed');
    expect(formatStatusLabel('')).toBe('pending');
    expect(gatepassDisplayNumber({ id: 'gp-1', gatepassNumber: '' })).toBe('gp-1');
    expect(gatepassDisplayNumber({ id: 'gp-1', gatepassNumber: 'ZGP-20260509-0001' })).toBe('ZGP-20260509-0001');
  });

  it('normalizes barcode values and renders escaped svg markup', () => {
    expect(escapeHtml(`Tom & "Jerry" <Tag>`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;Tag&gt;');
    expect(normalizeBarcodeValue(' ab?12 ')).toBe('AB-12');
    expect(normalizeBarcodeValue('')).toBe('PENDING');

    const geometry = createBarcodeGeometry('ab-12');
    expect(geometry.bars.length).toBeGreaterThan(0);
    expect(geometry.width).toBeGreaterThan(20);
    expect(geometry.height).toBe(40);

    const markup = renderBarcodeSvgMarkup('ab-12', 'Gatepass <Preview>');
    expect(markup).toContain('<svg');
    expect(markup).toContain('Gatepass &lt;Preview&gt;');
    expect(markup).toContain('<rect');
  });
});
