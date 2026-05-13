import type { DeviceNetworkInterfaceRecord, DeviceNetworkSummaryItem } from './types';

interface NetworkDetailsPanelProps {
  summaryItems: DeviceNetworkSummaryItem[];
  networkInterfaces: Array<[string, DeviceNetworkInterfaceRecord]>;
  formatDetailValue: (value?: string | null, fallback?: string) => string;
}

export default function NetworkDetailsPanel({ summaryItems, networkInterfaces, formatDetailValue }: NetworkDetailsPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">Network</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {summaryItems.map((detail) => (
        <div key={detail.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{detail.label}</div>
          <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{detail.value}</div>
        </div>
      ))}
    </div>
    <div className="mt-5 space-y-3">
      {networkInterfaces.length ? networkInterfaces.map(([name, stats]) => (
        <div key={name} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900">{name}</div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">{stats.state || 'unknown state'}</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">MAC</div>
              <div className="mt-1 text-sm text-zinc-900">{formatDetailValue(stats.mac)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">MTU</div>
              <div className="mt-1 text-sm text-zinc-900">{stats.mtu ? String(stats.mtu) : 'Not reported'}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Addresses</div>
              <div className="mt-1 text-sm text-zinc-900">{stats.addresses?.length ? stats.addresses.join(', ') : 'Not reported'}</div>
            </div>
          </div>
        </div>
      )) : <div className="rounded-xl bg-zinc-50 px-4 py-4 text-sm text-zinc-500">No network interface details are available for this asset.</div>}
    </div>
  </div>;
}