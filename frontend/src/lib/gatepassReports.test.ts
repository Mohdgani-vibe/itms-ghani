import { describe, expect, it } from 'vitest';

import { buildGatepassCsv, type GatepassCsvRecord } from './gatepassReports';

describe('buildGatepassCsv', () => {
  it('builds headers and formatted rows', () => {
    const records: GatepassCsvRecord[] = [
      {
        id: 'gp-1',
        gatepassNumber: 'ZGP-20260503-0001',
        employeeName: 'Idyan Khan',
        employeeCode: 'EMP-001',
        departmentName: 'IT Operations',
        assetRef: 'SPARE-123',
        assetDescription: 'ThinkPad T14',
        issueDate: '2026-05-03',
        expectedReturn: '2026-05-07',
        status: 'in_progress',
        approverName: 'Manager One',
        receiverSignedVerificationStatus: 'verified',
      },
    ];

    const csv = buildGatepassCsv(records);

    expect(csv).toContain('Gatepass Number,Employee,Employee Code');
    expect(csv).toContain('ZGP-20260503-0001,Idyan Khan,EMP-001,IT Operations,SPARE-123,ThinkPad T14,03-May-2026,07-May-2026,in progress,Manager One,,verified');
  });

  it('escapes commas, quotes, and newlines', () => {
    const records: GatepassCsvRecord[] = [
      {
        id: 'gp-2',
        employeeName: 'Jane "JJ" Doe',
        assetDescription: 'Laptop, charger\nDock',
      },
    ];

    const csv = buildGatepassCsv(records);

    expect(csv).toContain('"Jane ""JJ"" Doe"');
    expect(csv).toContain('"Laptop, charger\nDock"');
  });
});