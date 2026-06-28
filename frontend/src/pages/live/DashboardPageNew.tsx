import { useState } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  CheckCircle2,
  Settings,
  Bell,
  ChevronDown,
  Package,
  FileText,
  Send,
  Search
} from 'lucide-react';

// Sample data
const kpiData = {
  totalSystems: 847,
  totalSystemsTrend: '+12',
  activeAlerts: 34,
  activeAlertsTrend: '-8',
  criticalIssues: 5,
  criticalIssuesTrend: '-2',
  complianceScore: 94,
  complianceScoreTrend: '+3',
};

const clamavData = {
  systemsScanned: 823,
  activeAlerts: 12,
  malwareDetected: 3,
  quarantined: 3,
  weeklyDetections: [2, 1, 3, 0, 1, 2, 3],
  threatTypes: [
    { name: 'Trojan', value: 45, color: '#E5484D' },
    { name: 'Adware', value: 30, color: '#F76808' },
    { name: 'Spyware', value: 15, color: '#FFB224' },
    { name: 'Other', value: 10, color: '#8C96A4' },
  ],
};

const openscapData = {
  hostsScanned: 847,
  failedRules: 127,
  criticalFindings: 18,
  complianceScore: 94,
  hostGroups: [
    { name: 'Production', pass: 85, fail: 15 },
    { name: 'Development', pass: 92, fail: 8 },
    { name: 'Staging', pass: 78, fail: 22 },
  ],
  severity: [
    { name: 'Critical', value: 18, color: '#E5484D' },
    { name: 'High', value: 42, color: '#F76808' },
    { name: 'Medium', value: 47, color: '#FFB224' },
    { name: 'Low', value: 20, color: '#30A46C' },
  ],
};

const wazuhData = {
  activeAgents: 847,
  totalAlerts: 2341,
  criticalAlerts: 34,
  level12Events: 8,
  alertsByLevel: [
    { level: 'L15', count: 8 },
    { level: 'L12', count: 12 },
    { level: 'L10', count: 23 },
    { level: 'L7', count: 45 },
    { level: 'L5', count: 87 },
  ],
};

const patchData = {
  managedSystems: 847,
  pendingPatches: 234,
  criticalPatches: 18,
  upToDate: 72,
  patchStatus: [
    { name: 'Up to Date', value: 72, color: '#30A46C' },
    { name: 'Pending', value: 18, color: '#FFB224' },
    { name: 'Critical', value: 10, color: '#E5484D' },
  ],
  weeklyDeployment: [45, 67, 52, 89, 78, 92, 67],
};

const operationsData = {
  inventory: { total: 847, laptops: 423, desktops: 298, servers: 126 },
  gatepass: { total: 23, pending: 12, approved: 8, rejected: 3 },
  requests: { total: 156, pending: 45, inProgress: 67, resolved: 44 },
};

export default function DashboardPageNew() {
  const [timeRange, setTimeRange] = useState('Last 24h');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F4F9', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm" style={{ borderBottom: '1px solid #E7EBF1' }}>
        <div className="max-w-[1600px] mx-auto px-6">
          {/* First Row - Logo + Nav Links + User */}
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div 
                className="relative flex items-center justify-center rounded-lg"
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#2667E8',
                }}
              >
                <span className="text-white font-bold text-lg">IT</span>
                <div 
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: '#0F1B2D', color: 'white' }}
                >
                  Z
                </div>
              </div>
              <span className="text-xl font-bold" style={{ color: '#0F1B2D', letterSpacing: '-0.02em' }}>
                ITMS
              </span>
            </div>

            {/* Center: Nav Links */}
            <div className="flex items-center gap-1">
              {['Users', 'Patch', 'Inventory', 'Alerts', 'Request', 'Gatepass', 'Announcement'].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                  style={{
                    color: link === 'Alerts' ? '#2667E8' : '#8C96A4',
                    backgroundColor: link === 'Alerts' ? '#F0F9FF' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (link !== 'Alerts') {
                      e.currentTarget.style.backgroundColor = '#F1F4F9';
                      e.currentTarget.style.color = '#0F1B2D';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (link !== 'Alerts') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#8C96A4';
                    }
                  }}
                >
                  {link}
                </a>
              ))}
            </div>

            {/* Right: Setup, Alerts, Account */}
            <div className="flex items-center gap-3">
              {/* Setup Icon */}
              <button 
                className="p-2 rounded-lg transition-all duration-200"
                style={{ color: '#8C96A4' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F4F9';
                  e.currentTarget.style.color = '#0F1B2D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#8C96A4';
                }}
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Alerts Bell with Red Dot */}
              <button 
                className="p-2 rounded-lg transition-all duration-200 relative"
                style={{ color: '#8C96A4' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F4F9';
                  e.currentTarget.style.color = '#0F1B2D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#8C96A4';
                }}
              >
                <Bell className="w-5 h-5" />
                <div 
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#E5484D' }}
                />
              </button>

              {/* Account Chip */}
              <button 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{ backgroundColor: '#F1F4F9' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E7EBF1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F4F9';
                }}
              >
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: '#2667E8' }}
                >
                  AD
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium" style={{ color: '#0F1B2D' }}>Admin User</div>
                  <div className="text-[10px]" style={{ color: '#8C96A4' }}>admin@zerodha.com</div>
                </div>
                <ChevronDown className="w-4 h-4" style={{ color: '#8C96A4' }} />
              </button>
            </div>
          </div>

          {/* Second Row - Page Title + Search + Time Range */}
          <div className="flex items-center justify-between py-4 border-t" style={{ borderColor: '#E7EBF1' }}>
            <h1 className="text-2xl font-semibold" style={{ color: '#0F1B2D' }}>
              Security Dashboard
            </h1>

            <div className="flex items-center gap-3">
              {/* Search Field */}
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: '#8C96A4' }}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg text-sm transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: '#F1F4F9',
                    border: '1px solid #E7EBF1',
                    color: '#0F1B2D',
                    width: '240px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2667E8';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(38, 103, 232, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E7EBF1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#F1F4F9',
                  border: '1px solid #E7EBF1',
                  color: '#0F1B2D',
                }}
              >
                <option>Last 24h</option>
                <option>Last 7d</option>
                <option>Last 30d</option>
                <option>Last 90d</option>
              </select>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
        {/* Overview KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard 
            label="Total Systems"
            value={kpiData.totalSystems}
            trend={kpiData.totalSystemsTrend}
            icon={Activity}
            color="#2667E8"
            trendData={[65, 72, 68, 75, 80, 78, 85]}
          />
          <KPICard 
            label="Active Alerts"
            value={kpiData.activeAlerts}
            trend={kpiData.activeAlertsTrend}
            icon={Bell}
            color="#F76808"
            trendData={[42, 45, 38, 40, 35, 38, 34]}
          />
          <KPICard 
            label="Critical Issues"
            value={kpiData.criticalIssues}
            trend={kpiData.criticalIssuesTrend}
            icon={AlertTriangle}
            color="#E5484D"
            trendData={[8, 7, 9, 6, 7, 5, 5]}
          />
          <KPICard 
            label="Compliance Score"
            value={`${kpiData.complianceScore}%`}
            trend={kpiData.complianceScoreTrend}
            icon={CheckCircle2}
            color="#30A46C"
            trendData={[88, 89, 90, 91, 92, 93, 94]}
          />
        </div>

        {/* ClamAV Module */}
        <ModulePanel
          icon={Shield}
          name="ClamAV"
          subtitle="Antivirus Protection"
          status="Active"
          statusColor="#30A46C"
          stats={[
            { label: 'Systems Scanned', value: clamavData.systemsScanned },
            { label: 'Active Alerts', value: clamavData.activeAlerts },
            { label: 'Malware Detected', value: clamavData.malwareDetected },
            { label: 'Quarantined', value: clamavData.quarantined },
          ]}
          charts={
            <>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  7-Day Detections
                </div>
                <BarChart data={clamavData.weeklyDetections} color="#E5484D" maxValue={5} />
              </div>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  Threat Types
                </div>
                <DonutChart data={clamavData.threatTypes} />
              </div>
            </>
          }
        />

        {/* OpenSCAP Module */}
        <ModulePanel
          icon={CheckCircle2}
          name="OpenSCAP"
          subtitle="Compliance Scanning"
          status="Scanning"
          statusColor="#FFB224"
          stats={[
            { label: 'Hosts Scanned', value: openscapData.hostsScanned },
            { label: 'Failed Rules', value: openscapData.failedRules },
            { label: 'Critical Findings', value: openscapData.criticalFindings },
            { label: 'Compliance Score', value: `${openscapData.complianceScore}%` },
          ]}
          charts={
            <>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  Pass/Fail by Host Group
                </div>
                <div className="space-y-3">
                  {openscapData.hostGroups.map((group) => (
                    <div key={group.name}>
                      <div className="flex justify-between text-xs mb-1" style={{ color: '#0F1B2D' }}>
                        <span>{group.name}</span>
                        <span>{group.pass}%</span>
                      </div>
                      <ProgressBar pass={group.pass} fail={group.fail} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  Findings by Severity
                </div>
                <DonutChart data={openscapData.severity} />
              </div>
            </>
          }
        />

        {/* Wazuh Module */}
        <ModulePanel
          icon={Activity}
          name="Wazuh"
          subtitle="Security Information & Event Management"
          status="Active"
          statusColor="#30A46C"
          stats={[
            { label: 'Active Agents', value: wazuhData.activeAgents },
            { label: 'Total Alerts', value: wazuhData.totalAlerts },
            { label: 'Critical Alerts', value: wazuhData.criticalAlerts },
            { label: 'Level 12+ Events', value: wazuhData.level12Events },
          ]}
          charts={
            <>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  Alerts by Rule Level
                </div>
                <div className="space-y-2">
                  {wazuhData.alertsByLevel.map((item) => (
                    <div key={item.level} className="flex items-center gap-3">
                      <div className="text-xs font-medium w-8" style={{ color: '#0F1B2D' }}>
                        {item.level}
                      </div>
                      <div className="flex-1">
                        <div 
                          className="h-6 rounded flex items-center justify-end px-2 text-xs font-medium text-white transition-all duration-300"
                          style={{
                            width: `${(item.count / 100) * 100}%`,
                            backgroundColor: '#2667E8',
                          }}
                        >
                          {item.count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div 
                    className="w-32 h-32 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{
                      background: 'conic-gradient(#30A46C 0% 72%, #FFB224 72% 90%, #E5484D 90% 100%)',
                    }}
                  >
                    <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: '#0F1B2D' }}>847</div>
                        <div className="text-xs" style={{ color: '#8C96A4' }}>Agents</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#30A46C' }} />
                      <span style={{ color: '#8C96A4' }}>Active</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFB224' }} />
                      <span style={{ color: '#8C96A4' }}>Pending</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E5484D' }} />
                      <span style={{ color: '#8C96A4' }}>Offline</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          }
        />

        {/* Patch Update Module */}
        <ModulePanel
          icon={Package}
          name="Patch Update"
          subtitle="System Patching & Updates"
          status="Active"
          statusColor="#30A46C"
          stats={[
            { label: 'Managed Systems', value: patchData.managedSystems },
            { label: 'Pending Patches', value: patchData.pendingPatches },
            { label: 'Critical Patches', value: patchData.criticalPatches },
            { label: 'Up to Date', value: `${patchData.upToDate}%` },
          ]}
          charts={
            <>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  Patch Status
                </div>
                <DonutChart data={patchData.patchStatus} />
              </div>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: '#8C96A4' }}>
                  7-Day Patch Deployment
                </div>
                <BarChart data={patchData.weeklyDeployment} color="#30A46C" maxValue={100} />
              </div>
            </>
          }
        />

        {/* Operations Row */}
        <div className="grid grid-cols-3 gap-4">
          <OperationsCard
            icon={Package}
            title="Inventory"
            total={operationsData.inventory.total}
            breakdown={[
              { label: 'Laptops', value: operationsData.inventory.laptops },
              { label: 'Desktops', value: operationsData.inventory.desktops },
              { label: 'Servers', value: operationsData.inventory.servers },
            ]}
            color="#2667E8"
          />
          <OperationsCard
            icon={FileText}
            title="Gatepass"
            total={operationsData.gatepass.total}
            breakdown={[
              { label: 'Pending', value: operationsData.gatepass.pending },
              { label: 'Approved', value: operationsData.gatepass.approved },
              { label: 'Rejected', value: operationsData.gatepass.rejected },
            ]}
            color="#F76808"
          />
          <OperationsCard
            icon={Send}
            title="Requests"
            total={operationsData.requests.total}
            breakdown={[
              { label: 'Pending', value: operationsData.requests.pending },
              { label: 'In Progress', value: operationsData.requests.inProgress },
              { label: 'Resolved', value: operationsData.requests.resolved },
            ]}
            color="#30A46C"
          />
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  trend, 
  icon: Icon, 
  color,
  trendData 
}: { 
  label: string; 
  value: string | number; 
  trend: string; 
  icon: any; 
  color: string;
  trendData: number[];
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div 
      className="p-6 rounded-2xl bg-white transition-all duration-200 hover:shadow-lg"
      style={{ 
        border: '1px solid #E7EBF1',
        boxShadow: '0 1px 3px rgba(15, 27, 45, 0.08)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-medium mb-1" style={{ color: '#8C96A4' }}>
            {label}
          </div>
          <div className="text-3xl font-bold" style={{ color: '#0F1B2D' }}>
            {value}
          </div>
        </div>
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      
      {/* Trend Line */}
      <div className="flex items-end gap-0.5 h-8 mb-2">
        {trendData.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all duration-300"
            style={{
              backgroundColor: `${color}40`,
              height: `${value}%`,
            }}
          />
        ))}
      </div>
      
      <div className="flex items-center gap-1">
        <span 
          className="text-xs font-semibold"
          style={{ color: isPositive ? '#30A46C' : '#E5484D' }}
        >
          {trend}
        </span>
        <span className="text-xs" style={{ color: '#8C96A4' }}>vs last period</span>
      </div>
    </div>
  );
}

// Module Panel Component
function ModulePanel({
  icon: Icon,
  name,
  subtitle,
  status,
  statusColor,
  stats,
  charts,
}: {
  icon: any;
  name: string;
  subtitle: string;
  status: string;
  statusColor: string;
  stats: Array<{ label: string; value: string | number }>;
  charts: React.ReactNode;
}) {
  return (
    <div 
      className="p-6 rounded-2xl bg-white"
      style={{ 
        border: '1px solid #E7EBF1',
        boxShadow: '0 1px 3px rgba(15, 27, 45, 0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#2667E815' }}
          >
            <Icon className="w-6 h-6" style={{ color: '#2667E8' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: '#0F1B2D' }}>{name}</h3>
            <p className="text-sm" style={{ color: '#8C96A4' }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div 
            className="px-3 py-1 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {status}
          </div>
          <a 
            href="#"
            className="text-sm font-medium transition-all duration-200"
            style={{ color: '#2667E8' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1e56c8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#2667E8';
            }}
          >
            View details →
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="p-4 rounded-xl"
            style={{ backgroundColor: '#F1F4F9' }}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: '#0F1B2D' }}>
              {stat.value}
            </div>
            <div className="text-xs font-medium" style={{ color: '#8C96A4' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {charts}
      </div>
    </div>
  );
}

// Bar Chart Component (CSS only)
function BarChart({ data, color, maxValue }: { data: number[]; color: string; maxValue: number }) {
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((value, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex items-end" style={{ height: '100px' }}>
            <div
              className="w-full rounded-t-lg transition-all duration-300"
              style={{
                height: `${(value / maxValue) * 100}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <div className="text-xs" style={{ color: '#8C96A4' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut Chart Component (CSS only)
function DonutChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentPercent = 0;
  
  const gradientStops = data.map((item) => {
    const percent = (item.value / total) * 100;
    const start = currentPercent;
    const end = currentPercent + percent;
    currentPercent = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="flex items-center gap-4">
      <div 
        className="w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      >
        <div className="w-20 h-20 rounded-full bg-white" />
      </div>
      <div className="flex-1 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs" style={{ color: '#0F1B2D' }}>{item.name}</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#0F1B2D' }}>
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Progress Bar Component
function ProgressBar({ pass, fail }: { pass: number; fail: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E7EBF1' }}>
      <div 
        className="h-full transition-all duration-300"
        style={{
          width: `${pass}%`,
          backgroundColor: '#30A46C',
        }}
      />
    </div>
  );
}

// Operations Card Component
function OperationsCard({
  icon: Icon,
  title,
  total,
  breakdown,
  color,
}: {
  icon: any;
  title: string;
  total: number;
  breakdown: Array<{ label: string; value: number }>;
  color: string;
}) {
  return (
    <div 
      className="p-6 rounded-2xl bg-white transition-all duration-200 hover:shadow-lg"
      style={{ 
        border: '1px solid #E7EBF1',
        boxShadow: '0 1px 3px rgba(15, 27, 45, 0.08)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h4 className="font-semibold" style={{ color: '#0F1B2D' }}>{title}</h4>
          <div className="text-2xl font-bold" style={{ color: '#0F1B2D' }}>{total}</div>
        </div>
      </div>
      
      <div className="space-y-2">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2 border-t" style={{ borderColor: '#E7EBF1' }}>
            <span className="text-sm" style={{ color: '#8C96A4' }}>{item.label}</span>
            <span className="text-sm font-semibold" style={{ color: '#0F1B2D' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
