interface RemoteIdentifierDetail {
  label: string;
  value: string;
}

interface RemoteToolStatus {
  status?: 'linked' | 'detected' | 'installed' | 'missing';
  detail?: string | null;
}

interface RemoteAccessPanelProps {
  remoteIdentifierDetails: RemoteIdentifierDetail[];
  toolStatuses: Array<{ label: string; status?: RemoteToolStatus }>;
  toolStatusTone: (status?: RemoteToolStatus['status']) => string;
}

export default function RemoteAccessPanel({
  remoteIdentifierDetails,
  toolStatuses,
  toolStatusTone,
}: RemoteAccessPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">Remote Access & IDs</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {remoteIdentifierDetails.map((detail) => (
        <div key={detail.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{detail.label}</div>
          <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{detail.value}</div>
        </div>
      ))}
      {toolStatuses.map(({ label, status }) => (
        <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label} Status</div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${toolStatusTone(status?.status)}`}>
              {status?.status || 'missing'}
            </span>
          </div>
          <div className="mt-2 text-sm text-zinc-700">{status?.detail || 'Not detected'}</div>
        </div>
      ))}
    </div>
  </div>;
}