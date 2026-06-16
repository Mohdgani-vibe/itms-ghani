import type { InventoryItem } from './types';

const items: InventoryItem[] = [];

export default function InventoryRegistry() {
  if (!items.length) {
    return (
      <section className="rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f6fbff_100%)] p-6 text-sm text-zinc-700 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Inventory Registry</div>
        <h2 className="mt-2 text-lg font-bold text-zinc-900">Registry records are served from the live inventory workspace.</h2>
	        <p className="mt-2 max-w-2xl text-sm text-zinc-600">This registry no longer includes placeholder stock rows. Open the main inventory page to review real assets, serials, branch stock, and assignment state.</p>
      </section>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-bold">Inventory Registry</h2>
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Item Name</th>
            <th className="border px-2 py-1">Asset ID / Tag</th>
            <th className="border px-2 py-1">Serial Number</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Price / Cost</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border px-2 py-1">{item.name}</td>
              <td className="border px-2 py-1">{item.assetTag}</td>
              <td className="border px-2 py-1">{item.serialNumber}</td>
              <td className="border px-2 py-1">{item.status}</td>
              <td className="border px-2 py-1">{item.cost != null ? `₹${item.cost.toLocaleString()}` : 'Cost: Not set'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
