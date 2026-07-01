import { useState, useEffect } from 'react';
import { 
  Search, Settings, Bell, ChevronDown, Download, Upload, ArrowLeftRight, Plus,
  Users, Package, HardDrive, AlertCircle, FileText, LogOut,
  Laptop, Monitor, Smartphone, Keyboard, Printer, Network, Edit, MoreVertical
} from 'lucide-react';
import { fetchInventoryModuleAssets, fetchInventoryModuleBranches } from '../lib/inventoryApi';

// ============================================================================
// TYPES
// ============================================================================

type StockStatus = 'In use' | 'In stock' | 'Low' | 'Retired';
type DeviceKind = 'laptop' | 'monitor' | 'phone' | 'keyboard' | 'printer' | 'network';

interface Asset {
  id: string;
  name: string;
  serial: string;
  code: string;
  branch: string;
  employee: string | null;
  stock: StockStatus;
  cost: string;
  kind: DeviceKind;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Package;
  count: number;
}

interface BranchItem {
  id: string;
  label: string;
  count: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

const deviceConfig: Record<DeviceKind, { icon: typeof Laptop; bg: string; fg: string }> = {
  laptop: { icon: Laptop, bg: '#eef2ff', fg: '#2563eb' },
  monitor: { icon: Monitor, bg: '#f0f9ff', fg: '#0284c7' },
  phone: { icon: Smartphone, bg: '#fef3f2', fg: '#ef4444' },
  keyboard: { icon: Keyboard, bg: '#f5f3ff', fg: '#8b5cf6' },
  printer: { icon: Printer, bg: '#fef9e7', fg: '#eab308' },
  network: { icon: Network, bg: '#eaf6ef', fg: '#0f9d63' },
};

const stockConfig: Record<StockStatus, { textColor: string; dotColor: string }> = {
  'In use': { textColor: '#0f9d63', dotColor: '#0f9d63' },
  'In stock': { textColor: '#2563eb', dotColor: '#2563eb' },
  'Low': { textColor: '#d97706', dotColor: '#f59e0b' },
  'Retired': { textColor: '#6b7280', dotColor: '#9ca3af' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// TOP BAR
// ============================================================================

function TopBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
      style={{ height: '58px', backgroundColor: '#ffffff', borderBottom: '1px solid #e7e9ec' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center rounded-lg" style={{ width: '34px', height: '34px', backgroundColor: '#2563eb' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>IT</span>
          <div
            className="absolute rounded-full"
            style={{ width: '7px', height: '7px', backgroundColor: '#ef4444', top: '-2px', right: '-2px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#171a1f', letterSpacing: '0.3px' }}>ITMS</div>
          <div style={{ fontSize: '7px', fontWeight: '600', color: '#9aa1ab', letterSpacing: '0.8px' }}>
            IT MANAGEMENT SYSTEM · POWERED BY ZERODHA
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center gap-2">
        <button
          className="px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ backgroundColor: '#eef2ff', color: '#2563eb' }}
        >
          Assets
        </button>
        <button className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ color: '#6b7280' }}>
          Categories
        </button>
        <button className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ color: '#6b7280' }}>
          Reports
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-gray-50">
          <Search size={18} style={{ color: '#6b7280' }} />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-50">
          <Settings size={18} style={{ color: '#6b7280' }} />
        </button>
        <button className="relative p-2 rounded-lg hover:bg-gray-50">
          <Bell size={18} style={{ color: '#6b7280' }} />
          <div
            className="absolute rounded-full"
            style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', top: '6px', right: '6px' }}
          />
        </button>
        <div
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: '#f7f8fa', color: '#171a1f' }}
        >
          super_admin
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICON RAIL
// ============================================================================

function IconRail() {
  const items = [
    { icon: Users, label: 'Users', active: false },
    { icon: Package, label: 'Inventory', active: true },
    { icon: HardDrive, label: 'Storage', active: false },
    { icon: AlertCircle, label: 'Alerts', active: false },
    { icon: FileText, label: 'Docs', active: false },
    { icon: LogOut, label: 'Sign out', active: false },
  ];

  return (
    <div
      className="fixed left-0 top-[58px] bottom-0 flex flex-col items-center gap-1 py-3"
      style={{ width: '58px', backgroundColor: '#ffffff', borderRight: '1px solid #e7e9ec' }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: '42px',
            height: '42px',
            backgroundColor: item.active ? '#eef2ff' : 'transparent',
          }}
          title={item.label}
        >
          <item.icon size={20} style={{ color: item.active ? '#2563eb' : '#6b7280' }} />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// CONTEXT SIDEBAR
// ============================================================================

interface ContextSidebarProps {
  nav: string;
  onNavChange: (nav: string) => void;
  branch: string;
  onBranchChange: (branch: string) => void;
}

function ContextSidebar({ nav, onNavChange, branch, onBranchChange }: ContextSidebarProps) {
  const navItems: NavItem[] = [
    { id: 'assets', label: 'Assets', icon: Package, count: 342 },
    { id: 'catalog', label: 'Catalog', icon: FileText, count: 48 },
    { id: 'branches', label: 'Branches', icon: HardDrive, count: 5 },
    { id: 'suppliers', label: 'Suppliers', icon: Users, count: 12 },
    { id: 'audit', label: 'Audit', icon: AlertCircle, count: 156 },
  ];

  const branches: BranchItem[] = [
    { id: 'all', label: 'All branches', count: 342 },
    { id: 'ho', label: 'Zerodha HO', count: 156 },
    { id: 'bangalore', label: 'Zerodha Bangalore', count: 98 },
    { id: 'belgaum', label: 'Zerodha Belgaum', count: 54 },
    { id: 'zbl', label: 'ZBL Support Office', count: 34 },
  ];

  return (
    <div
      className="fixed left-16 top-14 bottom-0 overflow-y-auto"
      style={{ width: '232px', backgroundColor: '#ffffff', borderRight: '1px solid #e7e9ec' }}
    >
      {/* Inventory Nav */}
      <div className="p-4">
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px', marginBottom: '8px' }}>
          INVENTORY
        </div>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = nav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors relative"
                style={{
                  backgroundColor: isActive ? '#eaf6ef' : 'transparent',
                  borderLeft: isActive ? '3px solid #0f9d63' : '3px solid transparent',
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color: isActive ? '#0f9d63' : '#6b7280' }} />
                  <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '500', color: isActive ? '#0f9d63' : '#171a1f' }}>
                    {item.label}
                  </span>
                </div>
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: isActive ? '#d4edda' : '#f2f3f5', color: isActive ? '#0f9d63' : '#6b7280' }}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#edeef1', margin: '0 16px' }} />

      {/* Branch Filter */}
      <div className="p-4">
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px', marginBottom: '8px' }}>
          BRANCH STOCK
        </div>
        <div className="space-y-0.5">
          {branches.map((item) => {
            const isActive = branch === item.label;
            return (
              <button
                key={item.id}
                onClick={() => onBranchChange(item.label)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  backgroundColor: isActive ? '#eef2ff' : 'transparent',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '500', color: isActive ? '#2563eb' : '#171a1f' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#9aa1ab' }}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WORKSPACE HEADER
// ============================================================================

interface WorkspaceHeaderProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
}

function WorkspaceHeader({ menuOpen, onMenuToggle }: WorkspaceHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div style={{ fontSize: '12px', color: '#9aa1ab', marginBottom: '4px' }}>Inventory / Assets</div>
        <h1 style={{ fontSize: '25px', fontWeight: '800', color: '#171a1f', marginBottom: '4px' }}>Asset register</h1>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>
          Complete inventory tracking across all branches and departments
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* CSV Tools Menu */}
        <div className="relative">
          <button
            onClick={onMenuToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
          >
            <span>CSV tools</span>
            <ChevronDown size={16} />
          </button>

          {/* Popover Menu */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={onMenuToggle}
                style={{ backgroundColor: 'transparent' }}
              />
              
              {/* Menu */}
              <div
                className="absolute right-0 mt-2 rounded-lg shadow-lg z-50"
                style={{ width: '200px', backgroundColor: '#ffffff', border: '1px solid #e7e9ec' }}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 first:rounded-t-lg"
                  style={{ fontSize: '13px', fontWeight: '500', color: '#171a1f' }}
                >
                  <Download size={16} style={{ color: '#6b7280' }} />
                  <span>Download Template</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                  style={{ fontSize: '13px', fontWeight: '500', color: '#171a1f' }}
                >
                  <Download size={16} style={{ color: '#6b7280' }} />
                  <span>Export Inventory</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                  style={{ fontSize: '13px', fontWeight: '500', color: '#171a1f' }}
                >
                  <Upload size={16} style={{ color: '#6b7280' }} />
                  <span>Import CSV</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 last:rounded-b-lg"
                  style={{ fontSize: '13px', fontWeight: '500', color: '#171a1f' }}
                >
                  <ArrowLeftRight size={16} style={{ color: '#6b7280' }} />
                  <span>Transfer Stock</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Update Stock */}
        <button
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: '#eef2ff', color: '#2563eb' }}
        >
          Update Stock
        </button>

        {/* Add Item */}
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
        >
          <Plus size={16} />
          <span>Add Item</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// KPI BAR
// ============================================================================

function KpiBar() {
  const kpis = [
    { label: 'TOTAL ASSETS', value: '342', delta: '+18 MTD', deltaColor: '#0f9d63' },
    { label: 'ASSIGNED', value: '214', subtitle: '62%', deltaColor: null },
    { label: 'IN STOCK', value: '128', subtitle: 'available', deltaColor: null },
    { label: 'ENTITIES', value: '3', subtitle: 'ZBL · ZSO', deltaColor: null },
  ];

  return (
    <div
      className="rounded-xl mb-6 overflow-hidden"
      style={{ backgroundColor: '#ffffff', border: '1px solid #e7e9ec' }}
    >
      <div className="grid grid-cols-4">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className="px-6 py-4"
            style={{
              borderRight: index < kpis.length - 1 ? '1px solid #f2f3f5' : 'none',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#9aa1ab', letterSpacing: '1px', marginBottom: '4px' }}>
              {kpi.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: '26px', fontWeight: '800', color: '#171a1f', fontVariantNumeric: 'tabular-nums' }}>
                {kpi.value}
              </span>
              {kpi.delta && (
                <span style={{ fontSize: '12px', fontWeight: '600', color: kpi.deltaColor || '#171a1f' }}>
                  {kpi.delta}
                </span>
              )}
              {kpi.subtitle && (
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#9aa1ab' }}>
                  {kpi.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FILTER BAR
// ============================================================================

interface FilterBarProps {
  query: string;
  onQueryChange: (query: string) => void;
}

function FilterBar({ query, onQueryChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search */}
      <div className="flex-1 relative">
        <Search
          size={18}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9aa1ab' }}
        />
        <input
          type="text"
          placeholder="Search assets by name, serial, code, branch, or employee..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
          style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
        />
      </div>

      {/* Filters */}
      <select
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
      >
        <option>All main items</option>
        <option>Laptops</option>
        <option>Monitors</option>
        <option>Phones</option>
      </select>

      <select
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
      >
        <option>All sub items</option>
      </select>

      <select
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
      >
        <option>All asset types</option>
      </select>
    </div>
  );
}

// ============================================================================
// ASSET TABLE
// ============================================================================

interface AssetTableProps {
  assets: Asset[];
}

function AssetTable({ assets }: AssetTableProps) {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e7e9ec' }}>
      {/* Header */}
      <div
        className="grid items-center px-4 py-3 sticky top-0"
        style={{
          gridTemplateColumns: '2.6fr 1fr 1.3fr 1.5fr 1fr 1fr 72px',
          backgroundColor: '#fbfbfc',
          borderBottom: '1px solid #edeef1',
          fontSize: '10px',
          fontWeight: '800',
          color: '#9aa1ab',
          letterSpacing: '1px',
        }}
      >
        <div>ASSET</div>
        <div>ITEM CODE</div>
        <div>BRANCH</div>
        <div>EMPLOYEE</div>
        <div>STOCK</div>
        <div style={{ textAlign: 'right' }}>COST</div>
        <div></div>
      </div>

      {/* Rows */}
      {assets.map((asset) => (
        <AssetRow key={asset.id} asset={asset} />
      ))}
    </div>
  );
}

interface AssetRowProps {
  asset: Asset;
}

function AssetRow({ asset }: AssetRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const deviceInfo = deviceConfig[asset.kind];
  const Icon = deviceInfo.icon;
  const stockInfo = stockConfig[asset.stock];

  return (
    <div
      className="grid items-center px-4 py-3 transition-colors"
      style={{
        gridTemplateColumns: '2.6fr 1fr 1.3fr 1.5fr 1fr 1fr 72px',
        borderBottom: '1px solid #edeef1',
        backgroundColor: isHovered ? '#fafbfc' : 'transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Asset */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: '36px', height: '36px', backgroundColor: deviceInfo.bg }}
        >
          <Icon size={18} style={{ color: deviceInfo.fg }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#171a1f' }}>{asset.name}</div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#9aa1ab' }}>{asset.serial}</div>
        </div>
      </div>

      {/* Item Code */}
      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#171a1f' }}>{asset.code}</div>

      {/* Branch */}
      <div style={{ fontSize: '13px', color: '#171a1f' }}>{asset.branch}</div>

      {/* Employee */}
      {asset.employee ? (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: '28px',
              height: '28px',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              fontSize: '11px',
              fontWeight: '700',
              color: '#ffffff',
            }}
          >
            {getInitials(asset.employee)}
          </div>
          <span style={{ fontSize: '13px', color: '#171a1f' }}>{asset.employee}</span>
        </div>
      ) : (
        <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#9aa1ab' }}>Unassigned</div>
      )}

      {/* Stock */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-full"
          style={{ width: '8px', height: '8px', backgroundColor: stockInfo.dotColor }}
        />
        <span style={{ fontSize: '13px', color: stockInfo.textColor }}>{asset.stock}</span>
      </div>

      {/* Cost */}
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#171a1f', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {asset.cost}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        {isHovered && (
          <>
            <button className="p-1.5 rounded hover:bg-gray-100">
              <Edit size={16} style={{ color: '#6b7280' }} />
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100">
              <MoreVertical size={16} style={{ color: '#6b7280' }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PAGINATION
// ============================================================================

interface PaginationProps {
  total: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

function Pagination({ total, currentPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="flex items-center justify-between">
      <div style={{ fontSize: '13px', color: '#6b7280' }}>
        {total} assets · Showing {Math.min((currentPage - 1) * 10 + 1, total)}–{Math.min(currentPage * 10, total)}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
        >
          Prev
        </button>

        {[...Array(Math.min(totalPages, 3))].map((_, i) => {
          const page = i + 1;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={
                currentPage === page
                  ? { backgroundColor: '#2563eb', color: '#ffffff' }
                  : { border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }
              }
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ border: '1px solid #e7e9ec', backgroundColor: '#ffffff', color: '#171a1f' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InventoryScreen() {
  const [nav, setNav] = useState('assets');
  const [branch, setBranch] = useState('All branches');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchInventoryModuleAssets({ page: 1 });
      
      // Transform API response to Asset format
      const transformedAssets: Asset[] = response.items.map((item: any, index: number) => ({
        id: item.id || `asset-${index}`,
        name: item.name || 'Unknown',
        serial: item.serialNumber || 'N/A',
        code: item.assetCode || 'N/A',
        branch: item.branchName || 'Unknown',
        employee: item.assignedTo || null,
        stock: item.status || 'In stock',
        cost: item.purchasePrice ? `₹${item.purchasePrice.toLocaleString()}` : '₹0',
        kind: determineDeviceKind(item.name || '')
      }));
      
      setAllAssets(transformedAssets);
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  function determineDeviceKind(name: string): DeviceKind {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('macbook') || lowerName.includes('laptop') || lowerName.includes('thinkpad')) return 'laptop';
    if (lowerName.includes('monitor') || lowerName.includes('display')) return 'monitor';
    if (lowerName.includes('iphone') || lowerName.includes('phone') || lowerName.includes('mobile')) return 'phone';
    if (lowerName.includes('keyboard')) return 'keyboard';
    if (lowerName.includes('printer')) return 'printer';
    if (lowerName.includes('switch') || lowerName.includes('router') || lowerName.includes('network')) return 'network';
    return 'laptop'; // default
  }

  // Filter assets
  const filteredAssets = allAssets.filter((asset) => {
    const matchesBranch = branch === 'All branches' || asset.branch === branch;
    const matchesQuery =
      query === '' ||
      asset.name.toLowerCase().includes(query.toLowerCase()) ||
      asset.serial.toLowerCase().includes(query.toLowerCase()) ||
      asset.code.toLowerCase().includes(query.toLowerCase()) ||
      asset.branch.toLowerCase().includes(query.toLowerCase()) ||
      asset.employee?.toLowerCase().includes(query.toLowerCase());
    return matchesBranch && matchesQuery;
  });

  return (
    <div style={{ fontFamily: 'Public Sans, sans-serif', backgroundColor: '#f7f8fa', minHeight: '100vh' }}>
      <ContextSidebar nav={nav} onNavChange={setNav} branch={branch} onBranchChange={setBranch} />

      {/* Main Workspace */}
      <div style={{ marginLeft: '232px', padding: '24px 30px' }}>
        <WorkspaceHeader menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)} />
          
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ fontSize: 15, color: '#6b7280' }}>Loading inventory...</div>
            </div>
          )}
          
          {error && (
            <div style={{ padding: '20px', marginBottom: 20, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Error loading inventory</div>
              <div style={{ fontSize: 13, color: '#991b1b' }}>{error}</div>
            </div>
          )}
          
          {!loading && !error && (
            <>
              <KpiBar />
              <FilterBar query={query} onQueryChange={setQuery} />
              <AssetTable assets={filteredAssets.slice((currentPage - 1) * 10, currentPage * 10)} />
              <Pagination total={filteredAssets.length} currentPage={currentPage} onPageChange={setCurrentPage} />
            </>
          )}
      </div>
    </div>
  );
}
