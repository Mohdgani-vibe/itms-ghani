import type { InventoryItem } from './types';

interface Props {
  items: InventoryItem[];
  loading: boolean;
  error: string;
  onSelect: (item: InventoryItem) => void;
}

export default function InventoryDirectoryListPanel({ items, loading, error, onSelect }: Props) {
  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!items.length) return <div className="p-4">No inventory items found.</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => (
        <div
          key={item.id}
          className="cursor-pointer rounded border border-emerald-100 bg-white p-4 shadow transition hover:bg-emerald-50"
          onClick={() => onSelect(item)}
        >
          <div className="font-bold">{item.name}</div>
          <div className="text-sm text-gray-500">{item.itemCode} | {item.serialNumber}</div>
          <div className="text-xs text-gray-400">{item.status}</div>
        </div>
      ))}
    </div>
  );
}
