import type { ReactNode } from 'react';
import { actionButtonStyles } from '../../lib/buttonStyles';

interface RecentGatepassCard {
  id: string;
  status: string;
  displayNumber: string;
  subjectLabel: string;
  employeeName?: string;
  assetRef?: string;
  issueDate?: string;
}

interface GatepassReportsSectionProps {
  barcodeGatepasses: RecentGatepassCard[];
  reportGatepasses: RecentGatepassCard[];
  total: number;
  pending: number;
  archived: number;
  renderBarcode: (value: string, label: string, className: string) => ReactNode;
  onViewReport: (gatepassId: string) => void;
  onDownloadReport: (gatepassId: string) => void;
  onDownloadCsv: () => void;
}

export default function GatepassReportsSection({
  barcodeGatepasses,
  reportGatepasses,
  total,
  pending,
  archived,
  renderBarcode,
  onViewReport,
  onDownloadReport,
  onDownloadCsv,
}: GatepassReportsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Scan Station</div>
            <div className="mt-2 text-2xl font-bold text-zinc-900">Gatepass barcode board</div>
            <div className="mt-2 text-sm text-zinc-500">Use these larger barcode cards to verify movement records quickly from reports.</div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {barcodeGatepasses.map((gatepass) => (
              <div key={`scan-station-${gatepass.id}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{gatepass.status}</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">{gatepass.displayNumber}</div>
                {renderBarcode(gatepass.displayNumber, `Barcode for ${gatepass.displayNumber}`, 'mt-4 h-16 w-full')}
                <div className="mt-3 text-xs text-zinc-500">{gatepass.subjectLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Created</div>
          <div className="mt-3 text-3xl font-bold text-zinc-900">{total}</div>
          <div className="mt-2 text-sm text-zinc-500">All gatepasses issued from this portal.</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Pending</div>
          <div className="mt-3 text-3xl font-bold text-amber-600">{pending}</div>
          <div className="mt-2 text-sm text-zinc-500">Awaiting approval, print, or signature completion.</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Archived</div>
          <div className="mt-3 text-3xl font-bold text-zinc-900">{archived}</div>
          <div className="mt-2 text-sm text-zinc-500">Approved and rejected records in the vault.</div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Reports</div>
            <div className="mt-2 text-2xl font-bold text-zinc-900">Gatepass report register</div>
            <div className="mt-2 text-sm text-zinc-500">Open the report in a new tab or download the PDF copy directly from this board.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              {reportGatepasses.length} reports ready
            </div>
            <button type="button" onClick={onDownloadCsv} className={`rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] transition ${actionButtonStyles.add}`}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full table-fixed divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="w-[24%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Gatepass</th>
                <th className="w-[24%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Employee</th>
                <th className="hidden w-[22%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 lg:table-cell">Asset</th>
                <th className="hidden w-[14%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 lg:table-cell">Issue Date</th>
                <th className="w-[16%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {reportGatepasses.map((gatepass) => (
                <tr key={`report-row-${gatepass.id}`}>
                  <td className="px-4 py-4 align-top">
                    <div className="break-words font-semibold text-zinc-900">{gatepass.displayNumber}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{gatepass.status}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700"><div className="break-words">{gatepass.employeeName || gatepass.subjectLabel}</div></td>
                  <td className="hidden px-4 py-4 align-top text-sm text-zinc-700 lg:table-cell"><div className="break-words">{gatepass.assetRef || 'Not linked'}</div></td>
                  <td className="hidden px-4 py-4 align-top text-sm text-zinc-700 lg:table-cell whitespace-nowrap">{gatepass.issueDate || '-'}</td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap">
                      <button type="button" onClick={() => onViewReport(gatepass.id)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${actionButtonStyles.add}`}>
                        View
                      </button>
                      <button type="button" onClick={() => onDownloadReport(gatepass.id)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${actionButtonStyles.add}`}>
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}