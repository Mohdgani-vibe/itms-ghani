function hasDisplayValue(value?: string) {
  return Boolean(value && value.trim());
}

function fieldDisplayValue(value?: string) {
  return hasDisplayValue(value) ? value!.trim() : '— not filled —';
}

function initialsFromName(value?: string) {
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

function normalizeBarcodeValue(value: string) {
  const cleaned = (value || '').trim().toUpperCase();
  if (!cleaned) {
    return 'PENDING';
  }
  return Array.from(cleaned).map((char) => (CODE39_PATTERNS[char] ? char : '-')).join('');
}

function createBarcodeGeometry(value: string) {
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

function BarcodePreview({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const geometry = createBarcodeGeometry(value);

  return (
    <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className={className} aria-label={label} role="img" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges">
      {geometry.bars.map((bar) => (
        <rect key={`${label}-${bar.x}`} x={bar.x} y={0} width={bar.width} height={28} fill="#111827" />
      ))}
    </svg>
  );
}

function PreviewFieldCard({ label, value, strong = false }: { label: string; value?: string; strong?: boolean }) {
  const filled = hasDisplayValue(value);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-sm leading-6 ${filled ? `${strong ? 'font-bold' : 'font-medium'} text-slate-900` : 'italic text-slate-400'}`}>{fieldDisplayValue(value)}</div>
    </div>
  );
}

function PreviewSignatureCard({ role, name }: { role: string; name?: string }) {
  return (
    <div className="flex min-h-[128px] flex-col rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-900">
          {initialsFromName(name)}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{role}</div>
          <div className="mt-0.5 text-sm font-bold text-slate-900">{fieldDisplayValue(name)}</div>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between border-b border-dashed border-slate-300 pt-8 pb-1">
        <span className="text-[10px] text-slate-400">Signature</span>
        <span className="text-[10px] text-slate-400">Date</span>
      </div>
    </div>
  );
}

function PreviewSummaryCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{fieldDisplayValue(value)}</div>
    </div>
  );
}

interface PreviewRecord {
  issueDate: string;
  createdAt: string;
  status: string;
  originBranch: string;
  recipientBranch: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  approverName: string;
  contactNumber: string;
  assetRef: string;
  assetType?: string;
  serialNumber?: string;
  purpose: string;
  expectedReturn?: string;
  assetDescription: string;
  issuerSignedName?: string;
  requesterName?: string;
  securitySignedName?: string;
}

interface GatepassPreviewOverlayProps {
  showPreview: boolean;
  previewGatepassNumber: string;
  previewRecord: PreviewRecord;
  formatDisplayDate: (value: string) => string;
  formatIssueTime: (value?: string) => string;
  onClose: () => void;
  onDownloadPdf: () => void;
  onPrintPreview: () => void;
}

export default function GatepassPreviewOverlay({
  showPreview,
  previewGatepassNumber,
  previewRecord,
  formatDisplayDate,
  formatIssueTime,
  onClose,
  onDownloadPdf,
  onPrintPreview,
}: GatepassPreviewOverlayProps) {
  if (!showPreview) {
    return null;
  }

  return <div className="gatepass-preview-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 print:bg-white print:p-0">
    <div className="gatepass-print-sheet max-h-[92vh] w-full max-w-[1080px] overflow-y-auto rounded-2xl bg-white shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-950">Gatepass Preview</div>
            <div className="mt-1 text-sm text-slate-600">Review all details before downloading or printing the final gatepass.</div>
          </div>
          <button type="button" onClick={onClose} className="print:hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Zerodha IT Gatepass</div>
              <div className="mt-2 text-xl font-bold text-slate-950">{previewGatepassNumber}</div>
              <div className="mt-1 text-sm text-slate-600">Issued on {formatDisplayDate(previewRecord.issueDate)} at {formatIssueTime(previewRecord.createdAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <BarcodePreview value={previewGatepassNumber} label={`Barcode for ${previewGatepassNumber}`} className="h-8 w-40" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PreviewSummaryCard label="Status" value={previewRecord.status} />
            <PreviewSummaryCard label="Requested By" value={previewRecord.requesterName} />
            <PreviewSummaryCard label="Approver" value={previewRecord.approverName} />
            <PreviewSummaryCard label="Expected Return" value={formatDisplayDate(previewRecord.expectedReturn || '')} />
          </div>
        </section>

        <section>
          <div className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Dispatch Details</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewFieldCard label="From Branch" value={previewRecord.originBranch} strong />
            <PreviewFieldCard label="Receiver Branch" value={previewRecord.recipientBranch} strong />
          </div>
        </section>

        <section>
          <div className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Recipient Details</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <PreviewFieldCard label="Employee Name" value={previewRecord.employeeName} />
            <PreviewFieldCard label="Employee ID" value={previewRecord.employeeCode} />
            <PreviewFieldCard label="Department" value={previewRecord.departmentName} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewFieldCard label="Approver Name" value={previewRecord.approverName} />
            <PreviewFieldCard label="Contact Number" value={previewRecord.contactNumber} />
          </div>
        </section>

        <section>
          <div className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Asset Details</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <PreviewFieldCard label="Asset Tag / ID" value={previewRecord.assetRef} />
            <PreviewFieldCard label="Asset Type" value={previewRecord.assetType} />
            <PreviewFieldCard label="Serial Number" value={previewRecord.serialNumber} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <PreviewFieldCard label="Purpose" value={previewRecord.purpose} />
            <PreviewFieldCard label="Issue Date" value={`${formatDisplayDate(previewRecord.issueDate)} · ${formatIssueTime(previewRecord.createdAt)}`} />
            <PreviewFieldCard label="Expected Return" value={formatDisplayDate(previewRecord.expectedReturn || '')} />
          </div>
          <div className="mt-3">
            <PreviewFieldCard label="Asset Description" value={previewRecord.assetDescription} />
          </div>
        </section>

        <section>
          <div className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Authorisation &amp; Signatures</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <PreviewSignatureCard role="Issued by" name={previewRecord.issuerSignedName || previewRecord.requesterName || 'ITMS Super Admin'} />
            <PreviewSignatureCard role="Approved by" name={previewRecord.approverName || 'Approver'} />
            <PreviewSignatureCard role="Security check" name={previewRecord.securitySignedName || 'Security Guard'} />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-slate-200 bg-slate-50 px-6 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="break-words">Zerodha Gatepass · Admin &amp; IT Division · iteam@zerodha.com</span>
        <span className="whitespace-nowrap">{previewGatepassNumber} · {formatDisplayDate(previewRecord.issueDate)}</span>
      </div>

      <div className="gatepass-preview-actions print:hidden flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to Form
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          className="rounded-lg border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Download PDF
        </button>
        <button type="button" onClick={onPrintPreview} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          Print
        </button>
      </div>
    </div>
  </div>;
}