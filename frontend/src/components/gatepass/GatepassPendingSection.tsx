import { useState } from 'react';
import { actionButtonStyles } from '../../lib/buttonStyles';

export interface GatepassPendingSectionRecord {
  id: string;
  gatepassNumber?: string;
  employeeName: string;
  employeeCode: string;
  assetRef: string;
  approverName?: string;
  issueDate?: string;
  status: string;
  receiverSignedName?: string;
  receiverSignedAt?: string;
  securitySignedName?: string;
  securitySignedAt?: string;
  receiverSignedFileName?: string;
  receiverSignedFileUploadedAt?: string;
  receiverSignedVerificationStatus?: string;
  receiverSignedVerificationNotes?: string;
  hasReceiverSignedUpload?: boolean;
}

interface GatepassPendingSectionProps {
  gatepasses: GatepassPendingSectionRecord[];
  isReadOnly: boolean;
  busyGatepassId?: string | null;
  onUploadSignedCopy: (gatepassId: string, receiverSignedName: string, file: File) => Promise<void>;
  onViewUpload: (gatepassId: string, download?: boolean) => Promise<void>;
  onViewReport: (gatepassId: string) => void;
  onDownloadReport: (gatepassId: string) => void;
  formatDisplayDate: (value: string) => string;
  formatStatusLabel: (status: string) => string;
  gatepassDisplayNumber: (gatepass: Pick<GatepassPendingSectionRecord, 'id' | 'gatepassNumber'>) => string;
}

function formatDateTime(value?: string) {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '-';
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function GatepassPendingSection({
  gatepasses,
  isReadOnly,
  busyGatepassId,
  onUploadSignedCopy,
  onViewUpload,
  onViewReport,
  onDownloadReport,
  formatDisplayDate,
  formatStatusLabel,
  gatepassDisplayNumber,
}: GatepassPendingSectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [localError, setLocalError] = useState('');

  if (gatepasses.length === 0) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">No gatepasses are waiting for signed upload.</div>;
  }

  const handleUpload = async (gatepass: GatepassPendingSectionRecord) => {
    const receiverSignedName = (gatepass.receiverSignedName || gatepass.employeeName || '').trim();
    const gatepassId = gatepass.id;
    const file = selectedFiles[gatepassId];

    if (!receiverSignedName) {
      setLocalError('A receiver name is required before uploading the signed gatepass.');
      return;
    }
    if (!file) {
      setLocalError('Choose the signed gatepass PDF or image before uploading.');
      return;
    }

    setLocalError('');
    await onUploadSignedCopy(gatepassId, receiverSignedName, file);
    setSelectedFiles((current) => ({ ...current, [gatepassId]: null }));
  };

  return (
    <div className="space-y-4">
      {localError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{localError}</div> : null}
      {isReadOnly ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Auditor mode is read-only. Upload actions are hidden for this role.</div> : null}
      {gatepasses.map((gatepass) => {
        const displayNumber = gatepassDisplayNumber(gatepass);
        const busy = busyGatepassId === gatepass.id;

        return (
          <div key={gatepass.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{formatStatusLabel(gatepass.status)}</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">{displayNumber}</div>
                  <div className="mt-1 text-sm text-zinc-500">{gatepass.employeeName} · {gatepass.employeeCode || 'Employee code pending'} · {gatepass.assetRef || 'Asset ref pending'}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Issue Date</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">{formatDisplayDate(gatepass.issueDate || '')}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Approver</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">{gatepass.approverName || '-'}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Receiver Upload</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">{gatepass.hasReceiverSignedUpload ? formatDateTime(gatepass.receiverSignedFileUploadedAt) : 'Awaiting upload'}</div>
                  </div>
                </div>
                {gatepass.hasReceiverSignedUpload ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Signed copy uploaded as <span className="font-semibold">{gatepass.receiverSignedFileName || 'signed gatepass'}</span>
                    {gatepass.receiverSignedVerificationStatus ? ` · Verification: ${gatepass.receiverSignedVerificationStatus}` : ''}
                    {gatepass.receiverSignedVerificationNotes ? ` · ${gatepass.receiverSignedVerificationNotes}` : ''}
                  </div>
                ) : null}
              </div>

              <div className="w-full max-w-md space-y-3 lg:w-[320px] lg:min-w-[320px]">
                <label className="block text-xs text-zinc-700">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Signed Gatepass Upload</div>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={isReadOnly || busy}
                    onChange={(event) => setSelectedFiles((current) => ({ ...current, [gatepass.id]: event.target.files?.[0] || null }))}
                    className="block w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 file:mr-2 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { void handleUpload(gatepass); }}
                    disabled={isReadOnly || busy}
                    className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.save}`}
                  >
                    Upload
                  </button>
                  <button type="button" onClick={() => onViewReport(gatepass.id)} className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${actionButtonStyles.add}`}>
                    View
                  </button>
                  <button type="button" onClick={() => onDownloadReport(gatepass.id)} className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${actionButtonStyles.add}`}>
                    Download
                  </button>
                  {gatepass.hasReceiverSignedUpload ? (
                    <>
                      <button type="button" onClick={() => { void onViewUpload(gatepass.id, false); }} className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${actionButtonStyles.add}`}>
                        View Upload
                      </button>
                      <button type="button" onClick={() => { void onViewUpload(gatepass.id, true); }} className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${actionButtonStyles.add}`}>
                        Download Upload
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}