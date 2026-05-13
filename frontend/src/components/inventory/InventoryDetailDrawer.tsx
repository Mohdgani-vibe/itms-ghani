import type { InventoryItem } from './types';

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
}

export default function InventoryDetailDrawer({ item, onClose }: Props) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto">
        <button className="mb-4 text-gray-500" onClick={onClose}>Close</button>
        <div className="font-bold text-lg mb-2">{item.name}</div>
        <div className="mb-1">Item Code: {item.itemCode}</div>
        <div className="mb-1">Serial Number: {item.serialNumber}</div>
        <div className="mb-1">Specs: {item.specs}</div>
        <div className="mb-1">Warranty Expires: {item.warrantyExpiresAt}</div>
        <div className="mb-1">Cost: {item.cost}</div>
        <div className="mb-1">Status: {item.status}</div>
      </div>
    </div>
  );
}
