interface InstalledApplicationRecord {
  id: string;
  name: string;
  version?: string | null;
  installDate?: string | null;
  source?: string | null;
}

interface SoftwareInventoryPanelProps {
  computeAsset: boolean;
  installedApps: InstalledApplicationRecord[];
  highlightedInstalledApps: InstalledApplicationRecord[];
  softwareSourceLabel: (source?: string | null) => string;
}

export default function SoftwareInventoryPanel({
  computeAsset,
  installedApps,
  highlightedInstalledApps,
  softwareSourceLabel,
}: SoftwareInventoryPanelProps) {
  return <div className="rounded-xl border border-zinc-100 bg-white shadow-sm">
    <div className="border-b border-zinc-100 px-5 py-4">
      <h2 className="text-lg font-bold text-zinc-900">{computeAsset ? 'Installed Software' : 'Asset Notes'}</h2>
      {computeAsset ? <p className="mt-1 text-sm text-zinc-500">Full software inventory from the collector, including applications like Chrome, Salt, ClamScan, WPS, NetBird, AnyDesk, RustDesk, and other installed packages.</p> : null}
    </div>
    {computeAsset && highlightedInstalledApps.length ? <div className="border-b border-zinc-100 px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Detected Key Software</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {highlightedInstalledApps.map((application) => (
          <span key={`highlight-${application.id}`} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
            {application.name}{application.version ? ` • ${application.version}` : ''}
          </span>
        ))}
      </div>
    </div> : null}
    <div className="divide-y divide-zinc-100">
      {computeAsset && installedApps.length ? installedApps.map((application) => (
        <div key={application.id} className="px-6 py-4">
          <div className="font-semibold text-zinc-900">{application.name}</div>
          <div className="mt-1 text-sm text-zinc-500">{softwareSourceLabel(application.source)} • {application.version || 'Unknown version'}{application.installDate ? ` • Installed ${application.installDate}` : ''}</div>
        </div>
      )) : <div className="px-6 py-10 text-center text-sm text-zinc-500">{computeAsset ? 'No installed software data is available for this asset.' : 'This asset is treated as non-compute inventory, so processor, operating system, and installed software details are not shown.'}</div>}
    </div>
  </div>;
}