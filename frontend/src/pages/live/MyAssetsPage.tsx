import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import {
  assetPresenceState,
  formatAssignmentAge,
  formatCurrency,
  formatWarrantyWindow,
  getWarrantyBadge,
  warrantyTone,
  type AssignedDevice,
  type AssignedItem,
} from './myAssetsPageUtils';

type MyAssetSection = 'overview' | 'devices' | 'items';

interface AssetsResponse {
  devices: AssignedDevice[];
  items: AssignedItem[];
}

export default function MyAssetsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetsResponse>({ devices: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<MyAssetSection>('overview');

  useEffect(() => {
    let cancelled = false;

    const loadAssets = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await apiRequest<AssetsResponse>('/api/me/assets');
        if (!cancelled) {
          setAssets(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load assigned assets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalAssets = useMemo(() => assets.devices.length + assets.items.length, [assets.devices.length, assets.items.length]);
  const attentionAssets = useMemo(() => {
    const assetBadges = [
      ...assets.devices.map((device) => device.warrantyBadge || getWarrantyBadge(device.warrantyExpiresAt)),
      ...assets.items.map((item) => item.warrantyBadge || getWarrantyBadge(item.warrantyExpiresAt)),
    ];
    return assetBadges.filter((badge) => badge === '7_days' || badge === '15_days' || badge === '30_days').length;
  }, [assets.devices, assets.items]);
  const sectionCounts = useMemo(() => ({
    overview: totalAssets,
    devices: assets.devices.length,
    items: assets.items.length,
  }), [assets.devices.length, assets.items.length, totalAssets]);
  const detailSections: Array<{ id: MyAssetSection; label: string }> = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'devices', label: `Devices ${assets.devices.length}` },
    { id: 'items', label: `Inventory Items ${assets.items.length}` },
  ], [assets.devices.length, assets.items.length]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'overview' || hash === 'devices' || hash === 'items') {
      setActiveSection(hash);
    }
  }, [location.hash]);

  const handleSelectSection = (section: MyAssetSection) => {
    setActiveSection(section);
    navigate(`${location.pathname}#${section}`, { replace: true });
  };

  return (
    <>
    <style>{`
      .my-assets-page-root,
      .my-assets-page-root div,
      .my-assets-page-root span,
      .my-assets-page-root p,
      .my-assets-page-root h1,
      .my-assets-page-root h2,
      .my-assets-page-root h3,
      .my-assets-page-root button,
      .my-assets-page-root a,
      .my-assets-page-root label,
      .my-assets-page-root input,
      .my-assets-page-root select,
      .my-assets-page-root td,
      .my-assets-page-root th,
      .my-assets-page-root li {
        color: #0F1B2D !important;
      }
      .my-assets-page-root .text-ink { color: #0F1B2D !important; }
      .my-assets-page-root .text-muted { color: #8C96A4 !important; }
      .my-assets-page-root .text-primary { color: #2667E8 !important; }
      .my-assets-page-root .text-white { color: white !important; }
      .my-assets-page-root .text-success { color: #30A46C !important; }
      .my-assets-page-root .text-warning { color: #FFB224 !important; }
      .my-assets-page-root .text-danger { color: #E5484D !important; }
      .my-assets-page-root .bg-white { background-color: white !important; }
    `}</style>
    <div className="space-y-6 bg-zinc-50/60 my-assets-page-root">
      <section className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_58%,_#f6fbf7_100%)] px-6 py-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
                Employee Workspace
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">My Assets</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">Review assigned hardware and inventory one section at a time, then jump into the device detail view when you need deeper inspection.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-[460px]">
              <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Assets</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">{totalAssets}</div>
              </div>
              <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Devices</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">{assets.devices.length}</div>
              </div>
              <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Warranty Watch</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">{attentionAssets}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
        <div className="flex min-w-max gap-2">
          {detailSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSelectSection(section.id)}
              className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${activeSection === section.id ? 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm' : 'border-zinc-200 bg-white text-sky-700 hover:border-sky-200 hover:bg-sky-50'}`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'overview' ? <section className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Assigned Devices</div>
            <div className="mt-2 text-2xl font-black text-zinc-950">{sectionCounts.devices}</div>
            <div className="mt-1 text-xs text-zinc-500">Open the devices section for quick status and warranty checks.</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Inventory Items</div>
            <div className="mt-2 text-2xl font-black text-zinc-950">{sectionCounts.items}</div>
            <div className="mt-1 text-xs text-zinc-500">Keep track of peripherals and assigned non-device inventory here.</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Warranty Watch</div>
            <div className="mt-2 text-2xl font-black text-zinc-950">{attentionAssets}</div>
            <div className="mt-1 text-xs text-zinc-500">Assets with warranty windows inside the next 30 days.</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
          Pick a section above to review one asset category at a time instead of scanning devices and inventory items together.
        </div>
      </section> : null}

      {activeSection === 'devices' ? <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 text-sm font-bold text-zinc-900">Assigned Devices</div>
          <div className="divide-y divide-zinc-100">
            {loading ? <div className="px-6 py-10 text-sm text-zinc-500">Loading devices...</div> : null}
            {!loading && assets.devices.length === 0 ? <div className="px-6 py-10 text-sm text-zinc-500">No assigned devices.</div> : null}
            {assets.devices.map((device) => {
              const presence = assetPresenceState(device.lastSeenAt);
              return <button key={device.id} type="button" onClick={() => navigate(`/emp/devices/${device.id}`)} className="w-full px-6 py-4 text-left hover:bg-zinc-50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{device.hostname}</div>
                    <div className="mt-1 text-xs text-zinc-500">{device.assetTag} • {device.serialNumber || 'No serial'} • {device.specs || 'No specs'}</div>
                    <div className="mt-1 text-xs text-zinc-500">RustDesk ID: {device.rustdeskId || 'Not linked'}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatCurrency(device.cost)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${presence.classes}`}>{presence.label}</span>
                      <span className="text-xs text-zinc-500">{presence.detail}</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">{formatAssignmentAge(device.assignedAt)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatWarrantyWindow(device.warrantyExpiresAt)}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${warrantyTone(device.warrantyBadge || getWarrantyBadge(device.warrantyExpiresAt))}`}>
                    {(device.warrantyBadge || getWarrantyBadge(device.warrantyExpiresAt)).replace('_', ' ')}
                  </span>
                </div>
              </button>;
            })}
          </div>
        </section> : null}

      {activeSection === 'items' ? <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 text-sm font-bold text-zinc-900">Assigned Items</div>
          <div className="divide-y divide-zinc-100">
            {loading ? <div className="px-6 py-10 text-sm text-zinc-500">Loading inventory items...</div> : null}
            {!loading && assets.items.length === 0 ? <div className="px-6 py-10 text-sm text-zinc-500">No assigned inventory items.</div> : null}
            {assets.items.map((item) => (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{item.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">{item.itemCode} • {item.serialNumber || 'No serial'} • {item.specs || 'No specs'}</div>
                    <div className="mt-2 text-xs text-zinc-500">{formatAssignmentAge(item.assignedAt)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatCurrency(item.cost)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatWarrantyWindow(item.warrantyExpiresAt)}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${warrantyTone(item.warrantyBadge || getWarrantyBadge(item.warrantyExpiresAt))}`}>
                    {(item.warrantyBadge || getWarrantyBadge(item.warrantyExpiresAt)).replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section> : null}
    </div>
    </>
  );
}