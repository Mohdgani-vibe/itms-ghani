import { ChevronRight } from 'lucide-react';
import { actionButtonStyles } from '../../lib/buttonStyles';

type ToolStatusKey = 'salt' | 'wazuh' | 'openscap' | 'clamav';

interface SelectedUserSummary {
  fullName: string;
  status?: string;
}

interface DeviceAsset {
  id: string;
  assetTag: string;
  hostname: string;
  lastSeenAt?: string | null;
  rustdeskId?: string | null;
  cost?: string | null;
  serialNumber: string;
  specs: string;
  warrantyExpiresAt: string;
  assignedAt?: string;
  status: string;
  toolStatus?: {
    salt?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string };
    wazuh?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string };
    openscap?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string };
    clamav?: { status: 'linked' | 'detected' | 'installed' | 'missing'; detail: string };
  };
}

interface InventoryAsset {
  id: string;
  itemCode: string;
  name: string;
  serialNumber: string;
  specs: string;
  warrantyExpiresAt: string;
  cost?: string | null;
  assignedAt?: string;
  status: string;
}

interface AvailableDeviceAsset {
  id: string;
  hostname: string;
  serialNumber?: string | null;
  model?: string | null;
  status: string;
  branch?: { name?: string } | null;
  department?: { name?: string } | null;
}

interface UserAssignedAssetsPanelProps {
  selectedUser: SelectedUserSummary | null;
  assetsLoading: boolean;
  readOnly: boolean;
  devices: DeviceAsset[];
  items: InventoryAsset[];
  assetActionLoadingId: string;
  selectedAssetsCount: number;
  toolStatusItems: ReadonlyArray<readonly [ToolStatusKey, string]>;
  getDevicePresence: (lastSeenAt?: string | null) => { label: string; detail: string; classes: string };
  formatWarranty: (value: string) => string;
  formatCurrency: (value?: string | null) => string;
  formatAssignmentAge: (value?: string) => string;
  getToolBadgeClasses: (status?: 'linked' | 'detected' | 'installed' | 'missing') => string;
  formatToolStatusLabel: (status?: 'linked' | 'detected' | 'installed' | 'missing') => string;
  showAvailableDevices?: boolean;
  availableDevicesLoading?: boolean;
  availableDevices?: AvailableDeviceAsset[];
  availableDeviceActionLoadingId?: string;
  onOpenDevice: (deviceId: string) => void;
  onUnassignDevice: (assetId: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onReturnInventoryAsset: (assetId: string) => void;
  onRetireInventoryAsset: (assetId: string) => void;
  onAssignAvailableDevice?: (assetId: string) => void;
}

export function userAssignedDeviceActionsReadOnly(readOnly: boolean, userStatus?: string | null, deviceStatus?: string | null) {
  return readOnly || userStatus === 'inactive' || (deviceStatus || '').trim().toLowerCase() === 'retired';
}

export function userAssignedInventoryActionsReadOnly(readOnly: boolean, userStatus?: string | null, itemStatus?: string | null) {
  return readOnly || userStatus === 'inactive' || (itemStatus || '').trim().toLowerCase() !== 'allocated';
}

function inventoryReadOnlyMessage(itemStatus?: string | null) {
  const normalized = (itemStatus || '').trim().toLowerCase();
  if (normalized === 'retired') {
    return 'This inventory item is retired. Asset actions are read-only until the item returns to an allocated state.';
  }
  if (normalized === 'returned' || normalized === 'inventory') {
    return 'This inventory item is no longer allocated to this user. Asset actions are read-only until the item is allocated again.';
  }
  return 'This inventory item is read-only until the item is allocated to this user.';
}

export default function UserAssignedAssetsPanel({
  selectedUser,
  assetsLoading,
  readOnly,
  devices,
  items,
  assetActionLoadingId,
  selectedAssetsCount,
  toolStatusItems,
  getDevicePresence,
  formatWarranty,
  formatCurrency,
  formatAssignmentAge,
  getToolBadgeClasses,
  formatToolStatusLabel,
  showAvailableDevices = false,
  availableDevicesLoading = false,
  availableDevices = [],
  availableDeviceActionLoadingId = '',
  onOpenDevice,
  onUnassignDevice,
  onDeleteAsset,
  onReturnInventoryAsset,
  onRetireInventoryAsset,
  onAssignAvailableDevice,
}: UserAssignedAssetsPanelProps) {
  return <aside className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
    <div className="border-b border-zinc-100 px-5 py-4">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Assigned Assets</div>
      <h2 className="mt-1 text-lg font-bold text-zinc-900">{selectedUser?.fullName || 'Select a user'}</h2>
      <p className="mt-1 text-sm text-zinc-500">Click employee name or email to see devices and accessories on the right.</p>
    </div>

    {!selectedUser ? (
      <div className="px-5 py-10 text-center text-sm text-zinc-500">Choose a user to inspect assigned assets.</div>
    ) : assetsLoading ? (
      <div className="px-5 py-10 text-center text-sm text-zinc-500">Loading assigned assets...</div>
    ) : (
      <div className="space-y-3 p-4">
        {selectedUser.status === 'inactive' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This user is inactive. Asset actions are read-only until the account is reactivated.
          </div>
        ) : null}
        {selectedAssetsCount === 0 ? <div className="rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">No assets are assigned to this user.</div> : null}

        {devices.map((asset) => {
          const presence = getDevicePresence(asset.lastSeenAt);
          const deviceActionsReadOnly = userAssignedDeviceActionsReadOnly(readOnly, selectedUser?.status, asset.status);

          return <div
            key={asset.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDevice(asset.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenDevice(asset.id);
              }
            }}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-sm hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{asset.assetTag}</div>
                <div className="mt-1 text-base font-bold text-zinc-900">{asset.hostname}</div>
                <div className="mt-1 text-sm text-zinc-500">Laptop / Desktop asset</div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 text-zinc-400" />
            </div>

            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Presence</div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${presence.classes}`}>{presence.label}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600">{presence.detail}</div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-zinc-600">
              <div>Serial: {asset.serialNumber || 'Unavailable'}</div>
              <div>Hardware: {asset.specs || 'Unknown specs'}</div>
              <div>RustDesk ID: {asset.rustdeskId || 'Not linked'}</div>
              <div>Cost: {formatCurrency(asset.cost)}</div>
              <div>Warranty: {formatWarranty(asset.warrantyExpiresAt)}</div>
              <div>Assigned: {formatAssignmentAge(asset.assignedAt)}</div>
              <div>Status: {asset.status}</div>
            </div>

            {(asset.status || '').trim().toLowerCase() === 'retired' ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.
              </div>
            ) : null}

            {deviceActionsReadOnly ? null : <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUnassignDevice(asset.id);
                }}
                disabled={assetActionLoadingId === asset.id}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.remove}`}
              >
                {assetActionLoadingId === asset.id ? 'Updating...' : 'Remove From User'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteAsset(asset.id);
                }}
                disabled={assetActionLoadingId === asset.id}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.delete}`}
              >
                {assetActionLoadingId === asset.id ? 'Updating...' : 'Delete Asset'}
              </button>
            </div>}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {toolStatusItems.map(([key, label]) => {
                const statusEntry = asset.toolStatus?.[key];
                return (
                  <div key={key} className="rounded-xl bg-zinc-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${getToolBadgeClasses(statusEntry?.status)}`}>
                        {formatToolStatusLabel(statusEntry?.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">{statusEntry?.detail || 'Status unavailable'}</div>
                  </div>
                );
              })}
            </div>
          </div>;
        })}

        {items.map((asset) => {
          const inventoryActionsReadOnly = userAssignedInventoryActionsReadOnly(readOnly, selectedUser?.status, asset.status);

          return <div
            key={asset.id}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-left"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{asset.itemCode}</div>
            <div className="mt-1 text-base font-bold text-zinc-900">{asset.name}</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-600">
              <div>Specs: {asset.specs || 'Unknown specs'}</div>
              <div>Serial Number: {asset.serialNumber || 'Unavailable'}</div>
              <div>Warranty: {formatWarranty(asset.warrantyExpiresAt)}</div>
              <div>Cost: {formatCurrency(asset.cost)}</div>
              <div>Assigned: {formatAssignmentAge(asset.assignedAt)}</div>
              <div>Status: {asset.status}</div>
            </div>

            {inventoryActionsReadOnly && selectedUser?.status !== 'inactive' ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {inventoryReadOnlyMessage(asset.status)}
              </div>
            ) : null}

            {inventoryActionsReadOnly ? null : <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onReturnInventoryAsset(asset.id)}
                disabled={assetActionLoadingId === asset.id}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.save}`}
              >
                {assetActionLoadingId === asset.id ? 'Updating...' : 'Return'}
              </button>
              <button
                type="button"
                onClick={() => onRetireInventoryAsset(asset.id)}
                disabled={assetActionLoadingId === asset.id}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.delete}`}
              >
                {assetActionLoadingId === asset.id ? 'Updating...' : 'Scrap'}
              </button>
              <button
                type="button"
                onClick={() => onDeleteAsset(asset.id)}
                disabled={assetActionLoadingId === asset.id}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.delete}`}
              >
                {assetActionLoadingId === asset.id ? 'Updating...' : 'Delete Asset'}
              </button>
            </div>}
          </div>;
        })}

        {showAvailableDevices ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Available Unassigned Systems</div>
            <div className="mt-1 text-sm text-zinc-600">Pick a system below to assign it to this user.</div>

            {availableDevicesLoading ? <div className="mt-4 text-sm text-zinc-500">Loading unassigned systems...</div> : null}

            {!availableDevicesLoading && availableDevices.length === 0 ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                No unassigned systems are available right now.
              </div>
            ) : null}

            {!availableDevicesLoading ? (
              <div className="mt-4 space-y-3">
                {availableDevices.map((device) => {
                  const assignReadOnly = userAssignedDeviceActionsReadOnly(readOnly, selectedUser?.status, device.status);
                  return (
                    <div key={device.id} className="rounded-xl border border-white/80 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-zinc-900">{device.hostname}</div>
                          <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{device.model || 'System'}</div>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">{device.status}</span>
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-zinc-600">
                        <div>Serial: {device.serialNumber || 'Unavailable'}</div>
                        <div>Department: {device.department?.name || 'Unassigned'}</div>
                        <div>Branch: {device.branch?.name || 'Unassigned'}</div>
                      </div>
                      {assignReadOnly ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          {selectedUser?.status === 'inactive'
                            ? 'This user is inactive. System assignment is read-only until the account is reactivated.'
                            : 'This system is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.'}
                        </div>
                      ) : null}
                      {!assignReadOnly && onAssignAvailableDevice ? (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onAssignAvailableDevice(device.id)}
                            disabled={availableDeviceActionLoadingId === device.id}
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}
                          >
                            {availableDeviceActionLoadingId === device.id ? 'Assigning...' : 'Assign Device'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )}
  </aside>;
}