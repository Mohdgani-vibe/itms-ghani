import { actionButtonStyles } from '../../lib/buttonStyles';

function hasDisplayValue(value?: string) {
  return Boolean(value && value.trim());
}

function fieldDisplayValue(value?: string) {
  return hasDisplayValue(value) ? value!.trim() : '— not filled —';
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
        <rect key={`${label}-${bar.x}`} x={bar.x} y={0} width={bar.width} height={28} fill="#111111" />
      ))}
    </svg>
  );
}

function FieldCell({
  label,
  value,
  mono = false,
  emphasis = false,
  className = '',
}: {
  label: string;
  value?: string;
  mono?: boolean;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid min-h-[50px] grid-rows-[auto_1fr] rounded-none border border-black bg-white ${className}`}>
      <div className="border-b border-black px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-black">{label}</div>
      <div className={`${emphasis ? 'text-[15px] leading-[1.15]' : 'text-[13px] leading-[1.2]'} px-3 pt-2 pb-3 font-bold text-black ${mono ? 'font-mono tracking-[0.08em]' : ''} ${hasDisplayValue(value) ? '' : 'italic text-black'}`}>{fieldDisplayValue(value)}</div>
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

  const issueDateLabel = formatDisplayDate(previewRecord.issueDate);
  const issueTimeLabel = formatIssueTime(previewRecord.createdAt);
  return <div className="gatepass-preview-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 print:bg-white print:p-0">
    <div className="gatepass-print-sheet max-h-[94vh] w-full max-w-[1080px] overflow-y-auto border border-black bg-white print:max-h-none print:max-w-none print:overflow-visible print:border-0">
      <div className="border-b border-emerald-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_#f4fdf7_0%,_#ffffff_62%,_#fff8ef_100%)] px-5 py-4 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[22px] font-bold tracking-tight text-zinc-950">Gatepass Preview</div>
            <div className="mt-1 text-sm text-zinc-700">Review the current gatepass layout before downloading or printing it.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50">
            Close
          </button>
        </div>
      </div>

      <div className="bg-white p-2 print:bg-white print:p-0 sm:p-4">
        <div className="mx-auto grid w-full max-w-[210mm] gap-3 bg-white px-[13mm] py-[13mm] print:max-w-none">
          <header className="grid gap-2.5 border-b border-black pb-3">
            <div className="grid grid-cols-[minmax(0,1fr)_238px] gap-4 items-end max-md:grid-cols-1">
              <div className="grid content-start gap-1 self-stretch py-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-black">Zerodha Asset Management</div>
                <h1 className="m-0 text-[34px] font-extrabold tracking-[0.08em] text-black">GATE PASS</h1>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">ASSET MOVEMENT AUTHORIZATION DOCUMENT</div>
              </div>

              <div className="grid min-h-[84px] grid-rows-[auto_1fr] border border-black bg-white self-stretch">
                <div className="px-4 pt-3 pb-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-black">Gatepass Number</div>
                  <div className="pt-1 font-mono text-[14px] font-bold tracking-[0.08em] text-black">{previewGatepassNumber}</div>
                </div>
                <div className="flex items-center px-4 pb-3">
                  <div className="w-full border border-black px-2 py-2">
                    <BarcodePreview value={previewGatepassNumber} label={`Barcode for ${previewGatepassNumber}`} className="h-[10mm] w-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-black pb-2 max-md:grid-cols-1">
              <div className="grid min-h-[34px] content-start gap-1">
                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-black">Employee</div>
                <div className="text-[11px] font-bold text-black">{fieldDisplayValue(previewRecord.employeeName)}</div>
              </div>
              <div className="grid min-h-[34px] content-start gap-1">
                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-black">Issued</div>
                <div className="text-[11px] font-bold text-black">{issueDateLabel} · {issueTimeLabel}</div>
              </div>
            </div>
          </header>

          <section className="grid gap-1.5 pl-2">
            <div className="grid grid-cols-3 gap-2.5 items-stretch max-md:grid-cols-1">
              <FieldCell label="Employee Name" value={previewRecord.employeeName} emphasis className="min-h-[56px]" />
              <FieldCell label="Employee ID" value={previewRecord.employeeCode} mono className="min-h-[56px]" />
              <FieldCell label="Department" value={previewRecord.departmentName} className="min-h-[56px]" />
            </div>

            <div className="grid grid-cols-3 gap-2.5 items-stretch max-md:grid-cols-1">
              <FieldCell label="Asset Tag / ID" value={previewRecord.assetRef} mono emphasis className="min-h-[56px]" />
              <FieldCell label="Asset Type" value={previewRecord.assetType} className="min-h-[56px]" />
              <FieldCell label="Serial Number" value={previewRecord.serialNumber} mono className="min-h-[56px]" />
            </div>

            <div className="grid grid-cols-3 gap-2.5 items-stretch max-md:grid-cols-1">
              <FieldCell label="Contact Number" value={previewRecord.contactNumber} mono className="min-h-[58px]" />
              <FieldCell label="From Branch" value={previewRecord.originBranch} emphasis className="min-h-[58px]" />
              <FieldCell label="Receiver Branch" value={previewRecord.recipientBranch} emphasis className="min-h-[58px]" />
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-md:grid-cols-1">
              <FieldCell label="Approver" value={previewRecord.approverName} className="min-h-[46px]" />
            </div>

            <FieldCell label="Purpose" value={previewRecord.purpose} />
            <FieldCell label="Description" value={previewRecord.assetDescription} />

            <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
              <FieldCell label="Authorized By" value={previewRecord.issuerSignedName || previewRecord.requesterName} className="min-h-[46px]" />
              <FieldCell label="Approved By" value={previewRecord.approverName} className="min-h-[46px]" />
            </div>

            <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
              {['Issuer Signature', 'Security Check', 'Receiver Acknowledgement'].map((label) => (
                <div key={label} className="grid min-h-[66px] grid-rows-[1fr_auto] border border-black bg-white px-3 pt-2 pb-3">
                  <div className="h-px w-full bg-black" />
                  <div className="pt-1.5 text-[10px] font-semibold text-black">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <footer className="grid gap-2.5 border-t border-black pt-3">
            <div className="flex items-center justify-between gap-3 text-[10px] text-black max-md:flex-col max-md:items-start">
              <span>Present this gatepass during asset movement and handover.</span>
            </div>
          </footer>
        </div>
      </div>

      <div className="gatepass-preview-actions flex flex-wrap justify-end gap-3 border-t border-emerald-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fdf7_100%)] px-6 py-4 print:hidden">
        <button type="button" onClick={onClose} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50">
          Back to Form
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${actionButtonStyles.add}`}
        >
          Download PDF
        </button>
        <button type="button" onClick={onPrintPreview} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50">
          Print
        </button>
      </div>
    </div>
  </div>;
}