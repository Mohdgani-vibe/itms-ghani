export interface GatepassCsvRecord {
  id: string;
  gatepassNumber?: string;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  assetRef?: string;
  assetDescription?: string;
  issueDate?: string;
  expectedReturn?: string;
  status?: string;
  approverName?: string;
  receiverSignedFileUploadedAt?: string;
  receiverSignedVerificationStatus?: string;
}

function gatepassDisplayNumber(gatepass: Pick<GatepassCsvRecord, 'id' | 'gatepassNumber'>) {
  return gatepass.gatepassNumber || gatepass.id;
}

function formatDisplayDate(value: string) {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '-';
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return normalized;
  }

  const [, year, month, day] = match;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = monthNames[Number(month) - 1];
  if (!monthLabel) {
    return normalized;
  }

  return `${day}-${monthLabel}-${year}`;
}

function formatStatusLabel(status: string) {
  return (status || 'pending').replaceAll('_', ' ');
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildGatepassCsv(records: GatepassCsvRecord[]) {
  const headers = [
    'Gatepass Number',
    'Employee',
    'Employee Code',
    'Department',
    'Asset Ref',
    'Asset Description',
    'Issue Date',
    'Expected Return',
    'Status',
    'Approver',
    'Receiver Upload',
    'Receiver Verification',
  ];

  const rows = records.map((record) => [
    gatepassDisplayNumber(record),
    record.employeeName || '',
    record.employeeCode || '',
    record.departmentName || '',
    record.assetRef || '',
    record.assetDescription || '',
    formatDisplayDate(record.issueDate || ''),
    formatDisplayDate(record.expectedReturn || ''),
    formatStatusLabel(record.status || ''),
    record.approverName || '',
    record.receiverSignedFileUploadedAt || '',
    record.receiverSignedVerificationStatus || '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value || ''))).join(','))
    .join('\n');
}