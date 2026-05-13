import type { InventoryItem } from './types';

interface Props {
  item: InventoryItem;
}

function formatInventoryCost(cost?: string | null) {
  if (cost == null || cost === '') {
    return 'Not set';
  }

  const numericCost = Number(cost);
  if (!Number.isFinite(numericCost)) {
    return `₹${cost}`;
  }

  return `₹${numericCost.toLocaleString('en-IN')}`;
}

export default function InventoryItemDetailDrawer({ item }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
      <h2 className="text-lg font-bold text-zinc-900">{item.name} Details</h2>
      <div className="mt-3 space-y-2">
        <div><b>Asset ID / Tag:</b> {item.assetTag || 'Not set'}</div>
        <div><b>Serial Number:</b> {item.serialNumber || 'Not set'}</div>
        <div><b>Status:</b> {item.status || 'Unknown'}</div>
        <div><b>Price / Cost:</b> {formatInventoryCost(item.cost)}</div>
      </div>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-zinc-500">Audit history is not available in this panel.</div>
    </div>
  );
}
