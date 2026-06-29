import type { ComponentType } from 'react';
import { Search, Users, Building2, Package, Activity } from 'lucide-react';

type DirectoryTab = 'directory' | 'employee' | 'imports' | 'install' | 'audit' | 'access' | 'unassigned';

interface UsersPageHeaderProps {
  directoryTotal: number;
  departmentCount: number;
  assetTotal: number;
  auditTotal: number;
  unassignedTotal: number;
  activeTab: DirectoryTab;
  isSuperAdmin: boolean;
  isAuditor: boolean;
  UsersIcon: ComponentType<{ className?: string }>;
  onTabChange: (tab: DirectoryTab) => void;
}

// Mini chart component matching dashboard style
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((value, index) => {
        const height = max > 0 ? (value / max) * 100 : 0;
        return (
          <div
            key={index}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${height}%`,
              backgroundColor: color,
              minHeight: '4px'
            }}
          />
        );
      })}
    </div>
  );
}

// KPI Card matching dashboard design
function KPICard({ 
  label, 
  value, 
  trend, 
  icon: Icon,
  color,
  trendData 
}: { 
  label: string; 
  value: number | string; 
  trend: string; 
  icon: ComponentType<{ className?: string }>;
  color: string;
  trendData: number[];
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-muted mb-1">{label}</div>
          <div className="text-3xl font-bold text-ink">{value}</div>
        </div>
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
      </div>
      
      <div className="mb-3">
        <MiniBarChart data={trendData} color={color} />
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend}
        </span>
        <span className="text-muted">vs last period</span>
      </div>
    </div>
  );
}

export default function UsersPageHeader({
  directoryTotal,
  departmentCount,
  assetTotal,
  auditTotal,
  unassignedTotal,
  activeTab,
  isSuperAdmin,
  isAuditor,
  UsersIcon,
  onTabChange,
}: UsersPageHeaderProps) {
  // Mock trend data - in real app, this would come from API
  const trendData = {
    users: [65, 72, 68, 75, 80, 78, 85],
    departments: [8, 9, 8, 10, 11, 10, departmentCount],
    assets: [520, 540, 530, 560, 580, 590, assetTotal],
    activity: [120, 150, 140, 180, 160, 170, auditTotal],
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-ink">User Management</h1>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted" />
            </div>
            <input
              type="text"
              className="block w-64 rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-ink placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search..."
            />
          </div>
          
          <select className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
            <option>Last 24h</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Total Users"
          value={directoryTotal}
          trend="+12"
          icon={Users}
          color="#2667E8"
          trendData={trendData.users}
        />
        <KPICard
          label="Departments"
          value={departmentCount}
          trend="+2"
          icon={Building2}
          color="#30A46C"
          trendData={trendData.departments}
        />
        <KPICard
          label="Total Assets"
          value={assetTotal}
          trend="+45"
          icon={Package}
          color="#F76808"
          trendData={trendData.assets}
        />
        <KPICard
          label="Recent Activity"
          value={auditTotal}
          trend="+18"
          icon={Activity}
          color="#8B5CF6"
          trendData={trendData.activity}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'directory', label: 'Directory' },
          ...(!isAuditor ? [{ id: 'employee', label: 'Add Employee' }, { id: 'imports', label: 'Import / Export' }, { id: 'install', label: 'Install Agents' }] : []),
          ...(!isAuditor ? [{ id: 'audit', label: 'Audit' }] : []),
          ...(isSuperAdmin ? [{ id: 'access', label: 'Portal Access' }, { id: 'unassigned', label: 'Unassigned', badge: unassignedTotal }] : []),
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id as DirectoryTab)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              activeTab === item.id 
                ? 'border-primary bg-primary text-white shadow-sm' 
                : 'border-zinc-200 bg-white text-muted hover:bg-zinc-50 hover:text-ink'
            }`}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? (
              <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === item.id 
                  ? 'bg-white/20 text-white' 
                  : 'bg-zinc-100 text-ink'
              }`}>
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}