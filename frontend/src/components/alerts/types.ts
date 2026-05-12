export interface AlertsListRecord {
  id: string;
  assetId?: string | null;
  assetTag?: string | null;
  assetName?: string | null;
  hostname?: string | null;
  deviceId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  department?: string | null;
  source: string;
  sourceLabel?: string;
  sourceRaw?: string;
  severity: string;
  title: string;
  detail: string;
  acknowledged: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface AlertsSourceOption {
  value: string;
  label: string;
}

export interface AlertsRelatedRecord {
  id: string;
  source: string;
  severity: string;
  title: string;
  detail: string;
  acknowledged: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface AlertsNamedCount {
  name: string;
  label?: string;
  count: number;
}

export interface AlertsTrendBucket {
  date: string;
  count: number;
}

export interface AlertsClamAVTrend {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  dailyBuckets: AlertsTrendBucket[];
}

export interface AlertsDashboardModuleCard {
  source: string;
  label: string;
  moduleLabel: string;
  totalSystemsScanned: number;
  cleanSystemsCount: number;
  errorSystemsCount: number;
  lastUpdated: string;
  statusColor: 'green' | 'yellow' | 'red';
}

export interface AlertsDashboardDepartmentSummary {
  key: string;
  name: string;
  totalSystems: number;
  cleanCount: number;
  errorCount: number;
  lastUpdated: string;
}

export interface AlertsDashboardSystemSummary {
  key: string;
  assetId: string;
  assetTag: string;
  hostname: string;
  username: string;
  userEmail: string;
  department: string;
  module: string;
  moduleLabel: string;
  status: 'clean' | 'error';
  errorCount: number;
  errorDetails: string[];
  lastScanAt: string;
  latestAlertId: string;
  latestTitle: string;
  latestDetail: string;
}

export interface AlertsDashboardErrorDetail {
  id: string;
  assetId: string;
  assetTag: string;
  hostname: string;
  username: string;
  department: string;
  severity: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface AlertsDashboardTrendSummary {
  dailyBuckets: AlertsTrendBucket[];
  last7DaysTotal: number;
  previous7Days: number;
  trendDirection: 'up' | 'down' | 'flat';
  trendDelta: number;
  trendPercent: number;
}

export interface AlertsDashboardReport {
  generatedAt: string;
  departmentSummary: AlertsDashboardDepartmentSummary[];
  systemStatuses: AlertsDashboardSystemSummary[];
  errorDetails: AlertsDashboardErrorDetail[];
  last7DaysTrend: AlertsDashboardTrendSummary;
  module: string;
  moduleLabel: string;
  selectedDepartment: string;
}

export interface AlertsDashboardResponse {
  source: string;
  sourceLabel: string;
  filters: {
    department: string;
    search: string;
    status: 'all' | 'clean' | 'error';
  };
  moduleCards: AlertsDashboardModuleCard[];
  trend: AlertsDashboardTrendSummary;
  departments: AlertsDashboardDepartmentSummary[];
  systems: AlertsDashboardSystemSummary[];
  report: AlertsDashboardReport;
}

export interface PaginatedAlertsResponse {
  items: AlertsListRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    open: number;
    acknowledged: number;
    resolved: number;
    sourceCounts: AlertsNamedCount[];
    clamavTrend?: AlertsClamAVTrend;
  };
}

export interface InstallAgentConfig {
  saltApiConfigured?: boolean;
  sshConfigured?: boolean;
  saltApiBaseUrl?: string;
  sshAuthMode?: string;
}

export interface EmbeddedConsoleNavigationState {
  kind: 'ssh' | 'salt';
  index: number;
  items: AlertsListRecord[];
  prefilledCommand?: string;
}
