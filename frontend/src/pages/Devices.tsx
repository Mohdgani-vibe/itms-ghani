import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Filter, HardDrive, RefreshCw, Search, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import Pagination from '../components/Pagination';
import {
  DEVICES_PAGE_SIZE,
  formatCurrency,
  formatDateTime,
  isOnline,
  loadInventoryData,
  loadUnassignedDeviceCount,
  type DeviceAssignmentFilter,
  type DeviceRecord,
  type SyncStatus,
} from './devicesUtils';

export default function Devices() {
  const session = getStoredSession();
  const role = (session?.user.role || '').toLowerCase();
  const canManageInventory = role === 'super_admin' || role === 'it_team';
  const isAuditor = role === 'auditor';
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<DeviceAssignmentFilter>('unassigned');
  const [unassignedDeviceCount, setUnassignedDeviceCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [runningServerSync, setRunningServerSync] = useState(false);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const previousSearchQueryRef = useRef(searchQuery);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/devices')[0];

  useEffect(() => {
    let cancelled = false;

    const loadDevices = async () => {
      try {
        setLoading(true);
        setError('');
        const [{ deviceData, statusData }, unassignedCount] = await Promise.all([
          loadInventoryData(currentPage, searchQuery, assignmentFilter, canManageInventory),
          loadUnassignedDeviceCount(),
        ]);
        if (!cancelled) {
          setDevices(deviceData.items);
          setTotalDevices(deviceData.total);
          setSyncStatus(statusData);
          setUnassignedDeviceCount(unassignedCount);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load devices');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const searchChanged = previousSearchQueryRef.current !== searchQuery;

    if (searchChanged && currentPage !== 1) {
      return;
    }

    previousSearchQueryRef.current = searchQuery;
    void loadDevices();

    return () => {
      cancelled = true;
    };
  }, [assignmentFilter, canManageInventory, currentPage, searchQuery]);

  useEffect(() => {
    setCurrentPage((page) => (page === 1 ? page : 1));
  }, [assignmentFilter, searchQuery]);

  const handleRunBackendSync = async () => {
    try {
      setRunningServerSync(true);
      setError('');
      await apiRequest('/api/inventory-sync/run', { method: 'POST' });
      const [{ deviceData, statusData }, unassignedCount] = await Promise.all([
        loadInventoryData(currentPage, searchQuery, assignmentFilter, canManageInventory),
        loadUnassignedDeviceCount(),
      ]);
      setDevices(deviceData.items);
      setTotalDevices(deviceData.total);
      setSyncStatus(statusData);
      setUnassignedDeviceCount(unassignedCount);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to run backend inventory sync');
    } finally {
      setRunningServerSync(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {isAuditor ? <div className="rounded-2xl border border-sky-200 bg-sky-50/70 backdrop-blur-sm px-6 py-4 text-sm text-sky-900 font-medium shadow-sm">Auditor access is read-only. You can review device inventory, OpenSCAP findings, and ClamScan alerts here, but inventory sync and endpoint actions stay restricted to IT operations.</div> : null}

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                <HardDrive className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                  Asset Inventory
                </h1>
                <p className="mt-1 text-sm text-zinc-600 font-medium">Review all systems, or switch to only unassigned systems that still need an owner.</p>
              </div>
            </div>
          </div>
          {!isAuditor ? (
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowAdvancedColumns((current) => !current)}
                className="inline-flex items-center px-5 py-2.5 border border-zinc-200 rounded-xl shadow-sm text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all"
              >
                {showAdvancedColumns ? 'Hide More Columns' : 'Show More Columns'}
              </button>
              <button type="button" className="inline-flex items-center px-5 py-2.5 border border-zinc-200 rounded-xl shadow-sm text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all">
              <Filter className="mr-2 h-4 w-4" />
              {assignmentFilter === 'all' ? 'All Systems' : assignmentFilter === 'assigned' ? 'Assigned Systems' : `Unassigned Systems${unassignedDeviceCount > 0 ? ` (${unassignedDeviceCount})` : ''}`}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {([
          { id: 'unassigned', label: 'Unassigned Systems', color: 'amber' },
          { id: 'assigned', label: 'Assigned Systems', color: 'emerald' },
          { id: 'all', label: 'All Systems', color: 'blue' },
        ] as const).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setAssignmentFilter(option.id)}
            className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all shadow-sm ${
              assignmentFilter === option.id
                ? option.color === 'amber'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-200 ring-2 ring-amber-200'
                  : option.color === 'emerald'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200 ring-2 ring-emerald-200'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-200 ring-2 ring-blue-200'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            {option.id === 'unassigned' ? `${option.label} (${unassignedDeviceCount})` : option.label}
          </button>
        ))}
      </div>

        {syncStatus?.enabled ? (
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-8 shadow-xl">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 backdrop-blur-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Backend Inventory Sync</span>
                </div>
                <h2 className="mt-4 text-2xl font-black text-zinc-900">Daily sync runs on the server</h2>
                <p className="mt-2 text-sm font-medium text-zinc-600">The backend fetches inventory from the configured source, stores hardware details in PostgreSQL, and this UI reads the synced asset records.</p>
                {!syncStatus.configured ? (
                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                    Configure `INVENTORY_SYNC_SOURCE_URL` with a real inventory source before running sync.
                  </div>
                ) : null}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => void handleRunBackendSync()}
                    disabled={runningServerSync || !syncStatus.configured}
                    className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${runningServerSync ? 'animate-spin' : ''}`} />
                    {runningServerSync ? 'Running Backend Sync...' : 'Run Real Backend Sync'}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-white/60 backdrop-blur-sm p-4 ring-1 ring-zinc-200/50 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Source</div>
                  <div className="mt-1.5 text-sm font-bold text-zinc-900">{syncStatus.sourceType}</div>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur-sm p-4 ring-1 ring-zinc-200/50 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Interval</div>
                  <div className="mt-1.5 text-sm font-bold text-zinc-900">{syncStatus.interval}</div>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur-sm p-4 ring-1 ring-zinc-200/50 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Last Run</div>
                  <div className="mt-1.5 text-sm font-bold text-zinc-900">{syncStatus.lastRun ? new Date(syncStatus.lastRun.startedAt).toLocaleString() : 'Not run yet'}</div>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur-sm p-4 ring-1 ring-zinc-200/50 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Records</div>
                  <div className="mt-1.5 text-sm font-bold text-zinc-900">{syncStatus.lastRun ? `${syncStatus.lastRun.recordsUpserted}/${syncStatus.lastRun.recordsSeen}` : '0/0'}</div>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur-sm p-4 ring-1 ring-zinc-200/50 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Status</div>
                  <div className="mt-1.5 text-sm font-bold text-zinc-900">{syncStatus.running ? 'Running now' : syncStatus.lastRun?.status || (syncStatus.configured ? 'Scheduled' : 'Not configured')}</div>
                </div>
              </div>
            </div>
            {syncStatus.lastRun?.error ? <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm">{syncStatus.lastRun.error}</div> : null}
          </div>
        ) : null}

        <div className="bg-white shadow-xl rounded-3xl border border-zinc-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white flex justify-between items-center">
            <div className="relative rounded-xl shadow-sm w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-11 pr-4 py-3 text-sm border-zinc-300 rounded-xl border font-medium placeholder-zinc-400 transition-all"
                placeholder="Search by hostname, Asset ID or user..."
              />
            </div>
            <div className="text-sm font-semibold text-zinc-600">
              {assignmentFilter === 'all' ? 'Showing all systems' : assignmentFilter === 'assigned' ? 'Showing assigned systems only' : 'Showing unassigned systems only'}
            </div>
          </div>
          {error ? <div className="px-8 py-5 text-sm font-medium text-rose-700 bg-rose-50 border-b border-rose-200">{error}</div> : null}
        
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-gradient-to-r from-zinc-50 to-white">
                <tr>
                  <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Asset Info</th>
                  <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Assigned To</th>
                  <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Location</th>
                  <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Health / Patch</th>
                  {showAdvancedColumns ? <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Hardware</th> : null}
                  {showAdvancedColumns ? <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Last Seen</th> : null}
                  <th scope="col" className="px-8 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative px-8 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {loading ? (
                  <tr><td colSpan={showAdvancedColumns ? 8 : 6} className="px-8 py-16 text-center text-zinc-500 font-medium">Loading assets...</td></tr>
                ) : devices.length === 0 ? (
                  <tr><td colSpan={showAdvancedColumns ? 8 : 6} className="px-8 py-16 text-center text-zinc-500 font-medium">No devices found.</td></tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id} className="hover:bg-blue-50/50 transition-all group">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-0">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-2.5 w-2.5 rounded-full ${isOnline(device.lastSeenAt) ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-zinc-400'}`} title={isOnline(device.lastSeenAt) ? 'Online' : 'Offline'} />
                              <div className="text-sm font-bold text-blue-700 hover:text-blue-900 cursor-pointer">{device.hostname}</div>
                          </div>
                            <div className="text-xs text-zinc-500 font-medium mt-0.5">{device.deviceType} • {device.osName} • {device.assetId}</div>
                            {showAdvancedColumns ? <div className="text-xs text-zinc-500 font-medium mt-0.5">{formatCurrency(device.cost)} • Warranty {formatDateTime(device.warrantyUntil)}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="text-sm font-semibold text-zinc-900">{device.user?.fullName || 'Unassigned'}</div>
                        <div className="text-xs text-zinc-500 font-medium">{device.user?.employeeCode || '-'}</div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="text-sm font-semibold text-zinc-900">{device.branch?.name || '-'}</div>
                        <div className="text-xs text-zinc-500 font-medium">{device.department?.name || '-'}</div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {device.maintenanceUntil && new Date(device.maintenanceUntil) > new Date() ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 rounded-full shadow-sm">
                              <Wrench className="h-3.5 w-3.5" />
                              <span className="text-xs font-bold">Maintenance</span>
                            </div>
                          ) : null}
                          {device.alertStatus === 'healthy' || device.alertStatus === 'secure' ? (
                            <ShieldCheck className="h-5 w-5 text-emerald-500 drop-shadow" />
                          ) : (
                            <ShieldAlert className="h-5 w-5 text-red-500 drop-shadow" />
                          )}
                          <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-full shadow-sm ${device.patchStatus === 'up_to_date' ? 'bg-zinc-100 text-zinc-800' : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800'}`}>
                            {device.patchStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      {showAdvancedColumns ? (
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="text-sm font-semibold text-zinc-900">{device.gpu || '-'}</div>
                          <div className="text-xs text-zinc-500 font-medium">{device.macAddress || '-'}</div>
                        </td>
                      ) : null}
                      {showAdvancedColumns ? (
                        <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-zinc-900">
                          {formatDateTime(device.lastSeenAt)}
                        </td>
                      ) : null}
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="px-3 py-1.5 inline-flex text-xs font-bold rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 shadow-sm">
                          {device.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => navigate(`${basePath}/devices/${device.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-bold transition-colors"
                        >
                          {isAuditor ? 'Review' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={totalDevices}
            pageSize={DEVICES_PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="devices"
          />
        </div>
      </div>
    </div>
  );
}
