import type { DeviceVolumeRecord } from './types';

interface VolumesPanelProps {
  totalStorage: string;
  volumes: DeviceVolumeRecord[];
  encryptedVolumeCount: number;
  diskLayout?: string | null;
  formatDetailValue: (value?: string | null, fallback?: string) => string;
}

export default function VolumesPanel({
  totalStorage,
  volumes,
  encryptedVolumeCount,
  diskLayout,
  formatDetailValue,
}: VolumesPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
    <div className="flex items-center text-sm font-bold uppercase tracking-wider text-zinc-500">Volumes</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Storage</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{totalStorage}</div>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Reported Volumes</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{volumes.length}</div>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Encrypted Volumes</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{encryptedVolumeCount}</div>
      </div>
    </div>
    <div className="mt-5 space-y-3">
      {volumes.length ? volumes.map((volume) => (
        <div key={`${volume.path || volume.name}-${volume.mountpoint || ''}`} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{volume.name || volume.path || 'Unnamed volume'}</div>
              <div className="mt-1 break-all text-xs text-zinc-500">{volume.path || 'Path not reported'}{volume.mountpoint ? ` • ${volume.mountpoint}` : ''}</div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${volume.encrypted ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}>
              {volume.encrypted ? (volume.encryption || 'Encrypted') : 'Not encrypted'}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Type', value: formatDetailValue(volume.device_type, 'Unknown') },
              { label: 'Filesystem', value: formatDetailValue(volume.filesystem, 'Unknown') },
              { label: 'Size', value: formatDetailValue(volume.size, 'Unknown') },
              { label: 'Available', value: formatDetailValue(volume.available, 'Unknown') },
              { label: 'Used', value: formatDetailValue(volume.used_percent, 'Unknown') },
              { label: 'Parent', value: formatDetailValue(volume.parent, 'Unknown') },
              { label: 'UUID', value: formatDetailValue(volume.uuid, 'Unknown') },
              { label: 'Mount Point', value: formatDetailValue(volume.mountpoint, 'Not mounted') },
            ].map((detail) => (
              <div key={`${volume.name}-${detail.label}`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{detail.label}</div>
                <div className="mt-1 break-all text-sm font-medium text-zinc-900">{detail.value}</div>
              </div>
            ))}
          </div>
        </div>
      )) : <div className="rounded-xl border border-zinc-100 bg-white px-4 py-4 text-sm text-zinc-500">No per-volume or encryption details have been reported by the current inventory snapshot yet.</div>}
    </div>
    <div className="mt-5 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Disk Layout / fdisk</div>
      <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{diskLayout || 'fdisk output is not reported yet for this asset.'}</pre>
    </div>
  </div>;
}