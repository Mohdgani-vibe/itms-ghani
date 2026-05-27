export interface GatepassRecord {
  id: string;
  gatepassNumber?: string;
  assetRef: string;
  assetType?: string;
  serialNumber?: string;
  osPlatform?: string;
  expectedReturn?: string;
  assetDescription: string;
  purpose: string;
  originBranch: string;
  recipientBranch: string;
  issueDate: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  contactNumber: string;
  status: string;
  createdAt: string;
  issuerSignedName?: string;
  issuerSignedAt?: string;
  receiverSignedName?: string;
  receiverSignedAt?: string;
  securitySignedName?: string;
  securitySignedAt?: string;
  approverName: string;
  requesterName: string;
  receiverSignedFileName?: string;
  receiverSignedFileContentType?: string;
  receiverSignedFileUploadedAt?: string;
  receiverSignedVerificationStatus?: string;
  receiverSignedVerificationNotes?: string;
  hasReceiverSignedUpload?: boolean;
}

export interface UserOption {
  id: string;
  full_name?: string;
  fullName?: string;
  emp_id?: string;
  employeeCode?: string;
  department?: string | null;
}

export interface GatepassForm {
  employeeUserId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  approverName: string;
  contactNumber: string;
  assetRef: string;
  assetType: string;
  serialNumber: string;
  expectedReturn: string;
  assetDescription: string;
  purpose: string;
  originBranch: string;
  recipientBranch: string;
  issueDate: string;
}

export type GatepassFormErrors = Partial<Record<keyof GatepassForm, string>>;

const gatepassFieldLabels: Record<keyof GatepassForm, string> = {
  originBranch: 'From branch',
  recipientBranch: 'Receiver branch',
  issueDate: 'Issue date',
  employeeUserId: 'Employee user',
  employeeName: 'Employee name',
  employeeCode: 'Employee ID',
  departmentName: 'Department',
  approverName: 'Approver name',
  contactNumber: 'Contact number',
  assetRef: 'Asset tag or ID',
  assetType: 'Asset type',
  serialNumber: 'Serial number',
  expectedReturn: 'Expected return',
  assetDescription: 'Asset description',
  purpose: 'Purpose',
};

const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDisplayDate(value: string) {
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

export function userDisplayName(user: UserOption) {
  return user.fullName || user.full_name || '';
}

export function validateGatepassForm(form: GatepassForm): GatepassFormErrors {
  const errors: GatepassFormErrors = {};

  if (!form.originBranch.trim()) {
    errors.originBranch = 'From branch is required';
  }
  if (!form.recipientBranch.trim()) {
    errors.recipientBranch = 'Receiver branch is required';
  }
  if (!form.issueDate.trim()) {
    errors.issueDate = 'Issue date is required';
  }
  if (!form.employeeName.trim()) {
    errors.employeeName = 'Employee name is required';
  }
  if (!form.employeeCode.trim()) {
    errors.employeeCode = 'Employee ID is required';
  }
  if (!form.departmentName.trim()) {
    errors.departmentName = 'Department is required';
  }
  if (!form.approverName.trim()) {
    errors.approverName = 'Approver name is required';
  }
  if (!form.assetRef.trim()) {
    errors.assetRef = 'Asset tag or ID is required';
  }
  if (!form.assetDescription.trim()) {
    errors.assetDescription = 'Asset description is required';
  }
  if (!form.purpose.trim()) {
    errors.purpose = 'Purpose is required';
  }

  return errors;
}

export function formatGatepassValidationMessage(errors: GatepassFormErrors, action: string) {
  const labels = (Object.keys(gatepassFieldLabels) as Array<keyof GatepassForm>)
    .filter((key) => errors[key])
    .map((key) => gatepassFieldLabels[key]);

  if (labels.length === 0) {
    return `Complete the required gatepass fields before ${action}.`;
  }

  if (labels.length <= 4) {
    return `Complete the required gatepass fields before ${action}: ${labels.join(', ')}.`;
  }

  return `Complete the required gatepass fields before ${action}: ${labels.slice(0, 4).join(', ')}, and ${labels.length - 4} more.`;
}

export function hasDisplayValue(value?: string) {
  return Boolean(value && value.trim());
}

export function fieldDisplayValue(value?: string) {
  return hasDisplayValue(value) ? value.trim() : '— not filled —';
}

export function formatIssueTime(value?: string) {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) {
    return '09:42 AM';
  }

  return source.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
}

export function initialsFromName(value?: string) {
  const parts = (value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return '??';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeBarcodeValue(value: string) {
  const cleaned = (value || '').trim().toUpperCase();
  if (!cleaned) {
    return 'PENDING';
  }
  return Array.from(cleaned).map((char) => (CODE39_PATTERNS[char] ? char : '-')).join('');
}

export function createBarcodeGeometry(value: string) {
  const encoded = `*${normalizeBarcodeValue(value)}*`;
  const narrow = 2;
  const wide = 5;
  const gap = 2;
  const quietZone = 10;
  const bars: Array<{ x: number; width: number }> = [];
  let position = quietZone;

  for (let charIndex = 0; charIndex < encoded.length; charIndex += 1) {
    const pattern = CODE39_PATTERNS[encoded[charIndex]] || CODE39_PATTERNS['-'];
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === 'w' ? wide : narrow;
      if (index % 2 === 0) {
        bars.push({ x: position, width });
      }
      position += width;
    }
    if (charIndex < encoded.length - 1) {
      position += gap;
    }
  }

  return { bars, width: position + quietZone, height: 40 };
}

export function renderBarcodeSvgMarkup(value: string, label: string) {
  const geometry = createBarcodeGeometry(value);
  const rects = geometry.bars
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="28" fill="#0d0d0d"></rect>`)
    .join('');

  return `<svg viewBox="0 0 ${geometry.width} ${geometry.height}" aria-label="${escapeHtml(label)}" role="img" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

export function draftGatepassNumber(issueDate: string) {
  const normalizedDate = (issueDate || todayDate()).replaceAll('-', '');
  return `ZGP-${normalizedDate}-0001`;
}

export function formatStatusLabel(status: string) {
  return (status || 'pending').replaceAll('_', ' ');
}

export function gatepassDisplayNumber(gatepass: Pick<GatepassRecord, 'id' | 'gatepassNumber'>) {
  return gatepass.gatepassNumber || gatepass.id;
}