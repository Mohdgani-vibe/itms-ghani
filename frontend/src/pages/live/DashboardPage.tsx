import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, ClipboardList, LayoutDashboard, MessageSquare, Minus, ShieldAlert, ShieldCheck, Users, CircleDot } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { actionButtonStyles } from '../../lib/buttonStyles';
import { chatPreviewText, sortByRecentChatActivity, type ChatLatestMessageLike } from '../../lib/chat';
import type { PatchRunReportSummary } from '../../lib/patchReports';
import { assetPresenceState } from '../../components/users/userDisplayUtils';
import { getStoredSession } from '../../lib/session';

const ANNOUNCEMENTS_UPDATED_EVENT = 'itms:announcements-updated';
const CHAT_UPDATED_EVENT = 'itms:chat-updated';
const TREND_SAMPLE_SIZE = 1000;

interface ListResponse<TItem> {
  items?: TItem[];
  total?: number;
  summary?: {
    pending?: number;
    inProgress?: number;
    resolved?: number;
    enrollment?: number;
    pendingEnrollment?: number;
  };
}

interface AuditRecord {
  id: string;
  action: string;
  createdAt: string;
  actor?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
}

interface AssetResponse {
  devices?: Array<unknown>;
  items?: Array<unknown>;
}

interface InventoryModuleAssetsResponse {
  items?: InventoryModuleAsset[];
  total?: number;
}

interface InventoryModuleAsset {
  createdAt: string;
}

interface SimpleItem {
  id: string;
  title?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
  createdAt?: string;
  status?: string;
  severity?: string;
  kind?: string;
  lastSeenAt?: string | null;
  user?: {
    fullName?: string;
    employeeCode?: string;
  } | null;
}

interface ChatSummaryItem extends SimpleItem {
  latestMessage?: ChatLatestMessageLike;
}

interface DashboardCard {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  href: string;
  description: string;
}

interface DashboardSection {
  title: string;
  items: Array<SimpleItem | ChatSummaryItem>;
  href: string;
  kind: 'default' | 'chat' | 'user';
  description: string;
  emptyState: string;
}

interface ChatTicketSummaryItem {
  id: string;
  fullName: string;
  total: number;
  open: number;
  resolved: number;
}

interface DashboardSidePanelItem {
  id: string;
  title: string;
  meta: string;
  timestamp?: string;
  badge?: string;
}

interface DashboardSidePanel {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  loadingText: string;
  emptyText: string;
  items: DashboardSidePanelItem[];
}

interface TrendPoint {
  label: string;
  shortLabel: string;
  value: number;
}

type TrendWindowDays = 7 | 30 | 90;

interface WeeklyTrendCard {
  title: string;
  description: string;
  series: Array<{
    label: string;
    tone: string;
    points: TrendPoint[];
    previousPoints?: TrendPoint[];
  }>;
}

export function formatWhen(value?: string) {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleString();
}

export function formatRelativeWhen(value?: string) {
  if (!value) {
    return 'Just now';
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));
  if (deltaMinutes < 1) {
    return 'Just now';
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  return `${Math.round(deltaHours / 24)}d ago`;
}

export function buildTrendFrame(days: TrendWindowDays, offsetDays = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - offsetDays);

  return Array.from({ length: days }, (_item, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - ((days - 1) - index));
    const isoDay = day.toISOString().slice(0, 10);
    return {
      isoDay,
      label: days <= 7
        ? day.toLocaleDateString([], { weekday: 'short' })
        : day.toLocaleDateString([], { day: 'numeric' }),
      shortLabel: days <= 7
        ? day.toLocaleDateString([], { day: 'numeric' })
        : day.toLocaleDateString([], { month: 'short' }),
    };
  });
}

export function buildTrend(values: Array<string | null | undefined>, days: TrendWindowDays, offsetDays = 0) {
  const frame = buildTrendFrame(days, offsetDays);
  const counts = new Map(frame.map((item) => [item.isoDay, 0]));

  values.forEach((value) => {
    if (!value) {
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const isoDay = parsed.toISOString().slice(0, 10);
    if (!counts.has(isoDay)) {
      return;
    }
    counts.set(isoDay, (counts.get(isoDay) || 0) + 1);
  });

  return frame.map((item) => ({
    label: item.label,
    shortLabel: item.shortLabel,
    value: counts.get(item.isoDay) || 0,
  }));
}

export function buildPatchTrend(reports: PatchRunReportSummary[], days: TrendWindowDays, offsetDays = 0) {
  const frame = buildTrendFrame(days, offsetDays);
  const updated = new Map(frame.map((item) => [item.isoDay, 0]));
  const notUpdated = new Map(frame.map((item) => [item.isoDay, 0]));

  reports.forEach((report) => {
    const sourceDate = report.completedAt || report.requestedAt;
    if (!sourceDate) {
      return;
    }
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const isoDay = parsed.toISOString().slice(0, 10);
    if (!updated.has(isoDay)) {
      return;
    }
    updated.set(isoDay, (updated.get(isoDay) || 0) + report.successCount);
    notUpdated.set(isoDay, (notUpdated.get(isoDay) || 0) + report.failedCount);
  });

  return {
    updated: frame.map((item) => ({
      label: item.label,
      shortLabel: item.shortLabel,
      value: updated.get(item.isoDay) || 0,
    })),
    notUpdated: frame.map((item) => ({
      label: item.label,
      shortLabel: item.shortLabel,
      value: notUpdated.get(item.isoDay) || 0,
    })),
  };
}

export function sumValuesForMonth(values: Array<string | null | undefined>, monthOffset = 0) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);

  return values.reduce((sum, value) => {
    if (!value) {
      return sum;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return sum;
    }
    return parsed >= monthStart && parsed < nextMonthStart ? sum + 1 : sum;
  }, 0);
}

export function sumPatchValuesForMonth(reports: PatchRunReportSummary[], field: 'updated' | 'notUpdated', monthOffset = 0) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);

  return reports.reduce((sum, report) => {
    const sourceDate = report.completedAt || report.requestedAt;
    if (!sourceDate) {
      return sum;
    }
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime()) || parsed < monthStart || parsed >= nextMonthStart) {
      return sum;
    }
    return sum + (field === 'updated' ? report.successCount : report.failedCount);
  }, 0);
}

interface TrendSummary {
  total: number;
  peakLabel: string;
  peakValue: number;
  latestLabel: string;
  latestValue: number;
  averagePerDay: number;
  activeDays: number;
  dayOverDayChange: number | null;
}

export function isSameLocalDay(value: string, target: Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === target.getFullYear()
    && parsed.getMonth() === target.getMonth()
    && parsed.getDate() === target.getDate();
}

export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  if (!points.length) {
    return {
      total: 0,
      peakLabel: '-',
      peakValue: 0,
      latestLabel: '-',
      latestValue: 0,
      averagePerDay: 0,
      activeDays: 0,
      dayOverDayChange: null,
    };
  }

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peakPoint = points.reduce((highest, point) => (point.value > highest.value ? point : highest), points[0]);
  const latestPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const activeDays = points.filter((point) => point.value > 0).length;
  const dayOverDayChange = previousPoint
    ? (previousPoint.value === 0 ? (latestPoint.value === 0 ? 0 : null) : ((latestPoint.value - previousPoint.value) / previousPoint.value) * 100)
    : null;

  return {
    total,
    peakLabel: peakPoint.label,
    peakValue: peakPoint.value,
    latestLabel: latestPoint.label,
    latestValue: latestPoint.value,
    averagePerDay: total / points.length,
    activeDays,
    dayOverDayChange,
  };
}

export function formatPercentChange(value: number | null) {
  if (value == null) {
    return 'No prior baseline';
  }
  if (value === 0) {
    return '0.0% vs previous day';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}% vs previous day`;
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

export function formatMonthOverMonthChange(value: number | null) {
  if (value == null) {
    return 'No last month baseline';
  }
  if (value === 0) {
    return '0.0% vs last month';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}% vs last month`;
}

export function formatShare(value: number) {
  return `${value.toFixed(1)}% share`;
}

export function summarizeCardSeries(series: WeeklyTrendCard['series'], usePreviousPoints = false) {
  const sourcePoints = usePreviousPoints ? (series[0]?.previousPoints ?? []) : (series[0]?.points ?? []);
  const dailyTotals = sourcePoints.map((point, index) => ({
    label: point.label,
    shortLabel: point.shortLabel,
    total: series.reduce((sum, item) => sum + ((usePreviousPoints ? item.previousPoints?.[index]?.value : item.points[index]?.value) || 0), 0),
  }));
  const weeklyTotal = dailyTotals.reduce((sum, item) => sum + item.total, 0);
  const peakDay = dailyTotals.reduce((highest, item) => (item.total > highest.total ? item : highest), dailyTotals[0] ?? { label: '-', shortLabel: '-', total: 0 });
  const latestDay = dailyTotals[dailyTotals.length - 1] ?? { label: '-', shortLabel: '-', total: 0 };

  return {
    dailyTotals,
    weeklyTotal,
    averagePerDay: dailyTotals.length ? weeklyTotal / dailyTotals.length : 0,
    peakDay,
    latestDay,
  };
}

export function countOfflineUsersFromDevices(devices: SimpleItem[]) {
  const userPresence = new Map<string, { hasRecent: boolean; hasOffline: boolean }>();

  devices.forEach((device) => {
    const userKey = device.user?.employeeCode || device.user?.fullName;
    if (!userKey) {
      return;
    }

    const presence = assetPresenceState(device.lastSeenAt);
    const current = userPresence.get(userKey) || { hasRecent: false, hasOffline: false };

    if (presence.label === 'Recently Seen') {
      current.hasRecent = true;
    }
    if (presence.label === 'Offline') {
      current.hasOffline = true;
    }

    userPresence.set(userKey, current);
  });

  return Array.from(userPresence.values()).filter((entry) => entry.hasOffline && !entry.hasRecent).length;
}

export default function DashboardPage() {
  const location = useLocation();
  const portal = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/)?.[1] || 'emp';
  const basePath = `/${portal}`;
  const session = getStoredSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [inProgressRequests, setInProgressRequests] = useState(0);
  const [resolvedRequests, setResolvedRequests] = useState(0);
  const [announcementsTotal, setAnnouncementsTotal] = useState(0);
  const [chatTotal, setChatTotal] = useState(0);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [gatepassTotal, setGatepassTotal] = useState(0);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(0);
  const [resolvedAlerts, setResolvedAlerts] = useState(0);
  const [devicesTotal, setDevicesTotal] = useState(0);
  const [clamavAlertsTotal, setClamavAlertsTotal] = useState(0);
  const [recentRequests, setRecentRequests] = useState<SimpleItem[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<SimpleItem[]>([]);
  const [recentChats, setRecentChats] = useState<ChatSummaryItem[]>([]);
  const [recentUsers, setRecentUsers] = useState<SimpleItem[]>([]);
  const [recentLogins, setRecentLogins] = useState<AuditRecord[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<SimpleItem[]>([]);
  const [recentDevices, setRecentDevices] = useState<SimpleItem[]>([]);
  const [recentClamavAlerts, setRecentClamavAlerts] = useState<SimpleItem[]>([]);
  const [chatTicketSummary, setChatTicketSummary] = useState<ChatTicketSummaryItem[]>([]);
  const [weeklyPatchReports, setWeeklyPatchReports] = useState<PatchRunReportSummary[]>([]);
  const [weeklyInventoryAssets, setWeeklyInventoryAssets] = useState<InventoryModuleAsset[]>([]);
  const [weeklyAlertItems, setWeeklyAlertItems] = useState<SimpleItem[]>([]);
  const [weeklyGatepassItems, setWeeklyGatepassItems] = useState<SimpleItem[]>([]);
  const [weeklyUserItems, setWeeklyUserItems] = useState<SimpleItem[]>([]);
  const [weeklyLoginItems, setWeeklyLoginItems] = useState<AuditRecord[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [trendWindowDays, setTrendWindowDays] = useState<TrendWindowDays>(7);
  const [activeNow, setActiveNow] = useState(() => new Date());

  const loadDashboard = useMemo(() => {
    return async (cancelledRef?: { cancelled: boolean }) => {
      try {
        setLoading(true);
        setError('');

        if (portal === 'emp') {
          const [assetsData, requestsData, announcementsData, chatData] = await Promise.all([
            apiRequest<AssetResponse>('/api/me/assets'),
            apiRequest<ListResponse<SimpleItem>>('/api/me/requests?paginate=1&page=1&page_size=5'),
            apiRequest<ListResponse<SimpleItem>>('/api/announcements?paginate=1&page=1&page_size=5'),
            apiRequest<ListResponse<SimpleItem>>('/api/chat/channels?paginate=1&page=1&page_size=5'),
          ]);

          if (cancelledRef?.cancelled) {
            return;
          }

          const requestItems = requestsData.items ?? [];
          const announcementItems = announcementsData.items ?? [];
          const chatItems = sortByRecentChatActivity(chatData.items ?? []);

          setAssetsTotal((assetsData.devices?.length || 0) + (assetsData.items?.length || 0));
          setRequestsTotal(requestsData.total || 0);
          setPendingRequests(requestsData.summary?.pending || requestItems.filter((item) => item.status === 'pending').length || 0);
          setInProgressRequests(requestsData.summary?.inProgress || requestItems.filter((item) => item.status === 'in_progress').length || 0);
          setResolvedRequests(requestsData.summary?.resolved || requestItems.filter((item) => item.status === 'resolved').length || 0);
          setAnnouncementsTotal(announcementsData.total || 0);
          setChatTotal(chatData.total || 0);
          setGatepassTotal(0);
          setUsersTotal(0);
          setAlertsTotal(0);
          setOpenAlerts(0);
          setAcknowledgedAlerts(0);
          setResolvedAlerts(0);
          setDevicesTotal(0);
          setClamavAlertsTotal(0);
          setRecentRequests(requestItems);
          setRecentAnnouncements(announcementItems);
          setRecentChats(chatItems);
          setRecentUsers([]);
          setRecentLogins([]);
          setRecentAlerts([]);
          setRecentDevices([]);
          setRecentClamavAlerts([]);
          setChatTicketSummary([]);
          setWeeklyPatchReports([]);
          setWeeklyInventoryAssets([]);
          setInventoryTotal((assetsData.devices?.length || 0) + (assetsData.items?.length || 0));
          setWeeklyAlertItems([]);
          setWeeklyGatepassItems([]);
          setWeeklyUserItems([]);
          setWeeklyLoginItems([]);
          return;
        }

        if (portal === 'audit') {
          const [alertsData, devicesData, usersData, announcementsData, clamavAlertsData, auditData] = await Promise.all([
            apiRequest<ListResponse<SimpleItem>>(`/api/alerts?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`),
            apiRequest<ListResponse<SimpleItem>>(`/api/devices?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`),
            apiRequest<ListResponse<SimpleItem>>(`/api/users?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`),
            apiRequest<ListResponse<SimpleItem>>('/api/announcements?paginate=1&page=1&page_size=5'),
            apiRequest<ListResponse<SimpleItem>>(`/api/alerts?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}&source=clamav`).catch(() => ({ items: [], total: 0 })),
            apiRequest<{ items?: AuditRecord[] }>(`/api/audit?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}&action=login&module=access`).catch(() => ({ items: [] })),
          ]);

          if (cancelledRef?.cancelled) {
            return;
          }

          setUsersTotal(usersData.total || 0);
          setRequestsTotal(0);
          setPendingRequests(0);
          setInProgressRequests(0);
          setResolvedRequests(0);
          setAnnouncementsTotal(announcementsData.total || 0);
          setChatTotal(0);
          setAssetsTotal(0);
          setGatepassTotal(0);
          setAlertsTotal(alertsData.total || 0);
          setOpenAlerts(alertsData.summary?.pending || 0);
          setAcknowledgedAlerts(alertsData.summary?.inProgress || 0);
          setResolvedAlerts(alertsData.summary?.resolved || 0);
          setDevicesTotal(devicesData.total || 0);
          setClamavAlertsTotal(clamavAlertsData.total || 0);
          setRecentRequests([]);
          setRecentAnnouncements(announcementsData.items ?? []);
          setRecentChats([]);
          setRecentUsers(usersData.items ?? []);
          setRecentLogins([]);
          setRecentAlerts(alertsData.items ?? []);
          setRecentDevices(devicesData.items ?? []);
          setRecentClamavAlerts(clamavAlertsData.items ?? []);
          setChatTicketSummary([]);
          setWeeklyPatchReports([]);
          setWeeklyInventoryAssets([]);
          setInventoryTotal(0);
          setWeeklyAlertItems(alertsData.items ?? []);
          setWeeklyGatepassItems([]);
          setWeeklyUserItems(usersData.items ?? []);
          setWeeklyLoginItems(auditData.items ?? []);
          return;
        }

        const [usersData, requestsData, announcementsData, chatData, gatepassData, auditData, chatTicketData, clamavAlertsData, alertsWeeklyData, inventoryWeeklyData, patchReportsData, devicesData] = await Promise.all([
          apiRequest<ListResponse<SimpleItem>>(`/api/users?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`),
          apiRequest<ListResponse<SimpleItem>>('/api/requests?paginate=1&page=1&page_size=5'),
          apiRequest<ListResponse<SimpleItem>>('/api/announcements?paginate=1&page=1&page_size=5'),
          apiRequest<ListResponse<SimpleItem>>('/api/chat/channels?paginate=1&page=1&page_size=5'),
          apiRequest<ListResponse<SimpleItem>>(`/api/gatepass?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`),
          apiRequest<{ items?: AuditRecord[] }>(`/api/audit?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}&action=login&module=access`).catch(() => ({ items: [] })),
          portal === 'admin' ? apiRequest<{ items?: ChatTicketSummaryItem[] }>('/api/chat/tickets/summary').catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
          apiRequest<ListResponse<SimpleItem>>(`/api/alerts?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}&source=clamav`).catch(() => ({ items: [], total: 0 })),
          apiRequest<ListResponse<SimpleItem>>(`/api/alerts?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`).catch(() => ({ items: [], total: 0 })),
          apiRequest<InventoryModuleAssetsResponse>(`/api/inventory/module/assets?page=1&page_size=${TREND_SAMPLE_SIZE}`).catch(() => ({ items: [], total: 0 })),
          apiRequest<PatchRunReportSummary[]>('/api/patch/reports').catch(() => []),
          apiRequest<ListResponse<SimpleItem>>(`/api/devices?paginate=1&page=1&page_size=${TREND_SAMPLE_SIZE}`).catch(() => ({ items: [], total: 0 })),
        ]);

        if (cancelledRef?.cancelled) {
          return;
        }

        const userItems = usersData.items ?? [];
        const requestItems = requestsData.items ?? [];
        const announcementItems = announcementsData.items ?? [];
        const chatItems = sortByRecentChatActivity(chatData.items ?? []);
        const clamavItems = clamavAlertsData.items ?? [];
        const auditItems = auditData.items ?? [];
        const chatTicketItems = chatTicketData.items ?? [];

        setUsersTotal(usersData.total || 0);
        setRequestsTotal(requestsData.total || 0);
        setPendingRequests(requestsData.summary?.pending || 0);
        setInProgressRequests(requestsData.summary?.inProgress || 0);
        setResolvedRequests(requestsData.summary?.resolved || 0);
        setAnnouncementsTotal(announcementsData.total || 0);
        setChatTotal(chatData.total || 0);
        setAssetsTotal(0);
        setGatepassTotal(gatepassData.total || 0);
        setAlertsTotal(0);
        setOpenAlerts(0);
        setAcknowledgedAlerts(0);
        setResolvedAlerts(0);
        setDevicesTotal(0);
        setClamavAlertsTotal(clamavAlertsData.total || 0);
        setRecentRequests(requestItems);
        setRecentAnnouncements(announcementItems);
        setRecentChats(chatItems);
        setRecentUsers(userItems);
        setRecentLogins(auditItems);
        setRecentAlerts([]);
        setRecentDevices(devicesData.items ?? []);
        setRecentClamavAlerts(clamavItems);
        setChatTicketSummary(chatTicketItems);
        setWeeklyPatchReports(patchReportsData || []);
        setWeeklyInventoryAssets(inventoryWeeklyData.items ?? []);
        setInventoryTotal(inventoryWeeklyData.total || 0);
        setWeeklyAlertItems(alertsWeeklyData.items ?? []);
        setWeeklyGatepassItems(gatepassData.items ?? []);
        setWeeklyUserItems(userItems);
        setWeeklyLoginItems(auditItems);
      } catch (requestError) {
        if (!cancelledRef?.cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelledRef?.cancelled) {
          setLoading(false);
        }
      }
    };
  }, [portal]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setActiveNow(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const cancelledRef = { cancelled: false };

    void loadDashboard(cancelledRef);

    const handleAnnouncementUpdate = () => {
      void loadDashboard(cancelledRef);
    };

    const handleChatUpdate = () => {
      void loadDashboard(cancelledRef);
    };

    window.addEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);
    window.addEventListener(CHAT_UPDATED_EVENT, handleChatUpdate);

    return () => {
      cancelledRef.cancelled = true;
      window.removeEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);
      window.removeEventListener(CHAT_UPDATED_EVENT, handleChatUpdate);
    };
  }, [loadDashboard]);

  const cards = useMemo<DashboardCard[]>(() => {
    if (portal === 'emp') {
      return [
        { label: 'My Requests', value: requestsTotal, icon: ClipboardList, href: `${basePath}/requests`, description: 'Track your submitted requests and current progress.' },
        { label: 'My Assets', value: assetsTotal, icon: ShieldCheck, href: `${basePath}/assets`, description: 'Review the devices and inventory assigned to you.' },
        { label: 'Chat Channels', value: chatTotal, icon: MessageSquare, href: `${basePath}/chat`, description: 'Jump into the support conversations available to you.' },
        { label: 'Announcements', value: announcementsTotal, icon: Bell, href: `${basePath}/announcements`, description: 'Read the latest updates published to your portal.' },
      ];
    }

    if (portal === 'audit') {
      return [
        { label: 'Alerts', value: alertsTotal, icon: ShieldAlert, href: `${basePath}/alerts`, description: 'Inspect alert records available inside your audit scope.' },
        { label: 'ClamScan', value: clamavAlertsTotal, icon: ShieldAlert, href: `${basePath}/alerts?source=clamav`, description: 'Review ClamAV findings and recent malware scan signals.' },
        { label: 'Devices', value: devicesTotal, icon: ShieldCheck, href: `${basePath}/devices`, description: 'Review managed devices without operator-only actions.' },
        { label: 'Users', value: usersTotal, icon: Users, href: `${basePath}/users`, description: 'Open visible directory records and user profiles.' },
        { label: 'Announcements', value: announcementsTotal, icon: Bell, href: `${basePath}/announcements`, description: 'Read broadcast updates relevant to your audit workspace.' },
      ];
    }

    return [
      { label: 'Open Requests', value: requestsTotal, icon: ClipboardList, href: `${basePath}/requests`, description: 'Track active request volume and queue follow-up work.' },
      { label: 'ClamScan', value: clamavAlertsTotal, icon: ShieldAlert, href: `${basePath}/alerts?source=clamav`, description: 'Review recent ClamAV findings without leaving the operator workspace.' },
      { label: 'Gatepasses', value: gatepassTotal, icon: ClipboardList, href: `${basePath}/gatepass`, description: 'Review current gatepass activity across the portal.' },
      { label: 'Chat Channels', value: chatTotal, icon: MessageSquare, href: `${basePath}/chat`, description: 'Open the latest chat channels visible to this portal.' },
      { label: 'Users', value: usersTotal, icon: Users, href: `${basePath}/users`, description: 'Review visible user records and linked profiles.' },
    ];
  }, [alertsTotal, announcementsTotal, assetsTotal, basePath, chatTotal, clamavAlertsTotal, devicesTotal, gatepassTotal, portal, requestsTotal, usersTotal]);

  const requestChart = useMemo(() => {
    const segments = portal === 'audit'
      ? [
          { label: 'Open', value: openAlerts, tone: 'bg-amber-400' },
          { label: 'Acknowledged', value: acknowledgedAlerts, tone: 'bg-emerald-500' },
          { label: 'Resolved', value: resolvedAlerts, tone: 'bg-emerald-500' },
        ]
      : [
          { label: 'Pending', value: pendingRequests, tone: 'bg-amber-400' },
          { label: 'In Progress', value: inProgressRequests, tone: 'bg-emerald-500' },
          { label: 'Resolved', value: resolvedRequests, tone: 'bg-emerald-500' },
        ];
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

    return segments.map((segment) => ({
      ...segment,
      width: `${Math.max(10, Math.round((segment.value / total) * 100))}%`,
    }));
  }, [acknowledgedAlerts, inProgressRequests, openAlerts, pendingRequests, portal, resolvedAlerts, resolvedRequests]);

  const requestChartTotal = portal === 'audit'
    ? openAlerts + acknowledgedAlerts + resolvedAlerts
    : pendingRequests + inProgressRequests + resolvedRequests;

  const welcomeName = session?.user.fullName || 'Team Member';
  const portalLabel = portal === 'emp'
    ? 'Employee'
    : portal === 'it'
      ? 'IT Team'
      : portal === 'audit'
        ? 'Auditor'
        : 'Super Admin';
  const overviewLabel = portal === 'emp'
    ? 'Employee Overview'
    : portal === 'it'
      ? 'IT Team Overview'
      : portal === 'audit'
        ? 'Auditor Overview'
        : 'Super Admin Overview';
  const welcomeSubtitle = portal === 'emp'
    ? 'Use this dashboard to review requests, assets, chat, and announcements from one employee workspace.'
    : portal === 'audit'
      ? 'Use this dashboard to review alerts, devices, users, and announcements from one read-only audit workspace.'
      : 'Use this dashboard to review users, requests, gatepasses, chat channels, and core records from one operator workspace.';

  const sections: DashboardSection[] = portal === 'emp'
    ? [
        { title: 'Requests', items: recentRequests, href: `${basePath}/requests`, kind: 'default', description: 'Latest request updates visible to your account.', emptyState: 'No recent requests yet.' },
        { title: 'Chat Channels', items: recentChats, href: `${basePath}/chat`, kind: 'chat', description: 'Latest support conversations you can access.', emptyState: 'No recent chat activity yet.' },
        { title: 'Announcements', items: recentAnnouncements, href: `${basePath}/announcements`, kind: 'default', description: 'Newest announcements published to employees.', emptyState: 'No recent announcements yet.' },
      ]
    : portal === 'audit'
      ? [
          { title: 'Alerts', items: recentAlerts, href: `${basePath}/alerts`, kind: 'default', description: 'Most recent alerts available in your audit scope.', emptyState: 'No recent alerts in scope.' },
          { title: 'Devices', items: recentDevices, href: `${basePath}/devices`, kind: 'default', description: 'Latest visible device records for review.', emptyState: 'No recent device records in scope.' },
          { title: 'Announcements', items: recentAnnouncements, href: `${basePath}/announcements`, kind: 'default', description: 'Newest read-only announcements for auditors.', emptyState: 'No recent announcements in scope.' },
        ]
    : [
        { title: 'Chat Channels', items: recentChats, href: `${basePath}/chat`, kind: 'chat', description: 'Latest portal conversations and support threads.', emptyState: 'No recent chat activity yet.' },
        { title: 'Users', items: recentUsers, href: `${basePath}/users`, kind: 'user', description: 'Newest visible user records and profile activity.', emptyState: 'No recent user records found.' },
        { title: 'Requests', items: recentRequests, href: `${basePath}/requests`, kind: 'default', description: 'Latest request records that need visibility or follow-up.', emptyState: 'No recent request records found.' },
      ];

  const heroActions = portal === 'emp'
    ? [
        { label: 'Open Requests', href: `${basePath}/requests`, tone: 'primary' as const },
        { label: 'Open Assets', href: `${basePath}/assets`, tone: 'secondary' as const },
      ]
    : portal === 'audit'
      ? [
          { label: 'Open Alerts', href: `${basePath}/alerts`, tone: 'primary' as const },
          { label: 'Open ClamScan', href: `${basePath}/alerts?source=clamav`, tone: 'secondary' as const },
        ]
      : [
          { label: 'Open Requests', href: `${basePath}/requests`, tone: 'primary' as const },
          { label: 'Open ClamScan', href: `${basePath}/alerts?source=clamav`, tone: 'secondary' as const },
        ];

  const getSectionItemTitle = (item: SimpleItem, kind: DashboardSection['kind']) => {
    if (kind === 'user') {
      return item.fullName || item.full_name || item.name || item.title || item.email || 'Untitled user';
    }
    return item.title || item.name || item.fullName || item.full_name || 'Untitled item';
  };

  const getSectionItemMeta = (item: SimpleItem | ChatSummaryItem, kind: DashboardSection['kind']) => {
    if (kind === 'chat') {
      const latestMessage = (item as ChatSummaryItem).latestMessage;
      if (!latestMessage?.body) {
        return item.kind ? `${item.kind} chat channel` : 'Chat channel';
      }

      return chatPreviewText(latestMessage, item.kind ? `${item.kind} chat channel` : 'Chat channel');
    }
    if (kind === 'user') {
      return item.email || item.status || 'User record';
    }
    const summary = item.status || item.severity || 'Info';
    return item.createdAt ? `${summary} • ${formatWhen(item.createdAt)}` : summary;
  };

  const cardsGridClass = cards.length >= 5 ? 'xl:grid-cols-5' : cards.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4';

  const getSectionItemTimestamp = (item: SimpleItem | ChatSummaryItem, kind: DashboardSection['kind']) => {
    if (kind === 'chat') {
      const latestCreatedAt = (item as ChatSummaryItem).latestMessage?.createdAt;
      return latestCreatedAt ? formatWhen(latestCreatedAt) : 'Waiting for activity';
    }

    return item.createdAt ? formatWhen(item.createdAt) : '';
  };

  const requestSidePanelItems = recentRequests.map((item) => ({
    id: item.id,
    title: getSectionItemTitle(item, 'default'),
    meta: getSectionItemMeta(item, 'default'),
    timestamp: getSectionItemTimestamp(item, 'default'),
    badge: item.status ? item.status.replace(/_/g, ' ') : undefined,
  }));

  const alertSidePanelItems = recentAlerts.map((item) => ({
    id: item.id,
    title: getSectionItemTitle(item, 'default'),
    meta: getSectionItemMeta(item, 'default'),
    timestamp: getSectionItemTimestamp(item, 'default'),
    badge: item.severity || item.status || undefined,
  }));

  const deviceSidePanelItems = recentDevices.map((item) => ({
    id: item.id,
    title: getSectionItemTitle(item, 'default'),
    meta: getSectionItemMeta(item, 'default'),
    timestamp: getSectionItemTimestamp(item, 'default'),
    badge: item.status || undefined,
  }));

  const announcementSidePanelItems = recentAnnouncements.map((item) => ({
    id: item.id,
    title: getSectionItemTitle(item, 'default'),
    meta: getSectionItemMeta(item, 'default'),
    timestamp: getSectionItemTimestamp(item, 'default'),
  }));

  const clamavSidePanelItems = recentClamavAlerts.map((item) => ({
	id: item.id,
	title: getSectionItemTitle(item, 'default'),
	meta: getSectionItemMeta(item, 'default'),
	timestamp: getSectionItemTimestamp(item, 'default'),
	badge: item.severity || item.status || undefined,
  }));

  const loginSidePanelItems = recentLogins.map((entry) => ({
    id: entry.id,
    title: entry.actor?.fullName || 'Unknown user',
    meta: entry.actor?.email || 'No employee ID available',
    timestamp: formatWhen(entry.createdAt),
    badge: formatRelativeWhen(entry.createdAt),
  }));

  const chatTicketPanelItems = chatTicketSummary.map((item) => ({
    id: item.id,
    title: item.fullName,
    meta: `${item.open} open from closed chats • ${item.resolved} resolved`,
    timestamp: `${item.total} total tickets`,
    badge: `${item.total}`,
  }));

  const sidePanels: DashboardSidePanel[] = portal === 'admin'
    ? [
        {
          eyebrow: 'Closed Chat Tickets',
          title: 'IT Owner Load',
          description: 'Track how many closed-chat tickets are currently assigned to each IT owner.',
          badge: 'Live',
          loadingText: 'Loading ticket ownership summary...',
          emptyText: 'No closed chat tickets have been assigned yet.',
          items: chatTicketPanelItems,
        },
        {
          eyebrow: 'Threat Review',
          title: 'ClamScan Watch',
          description: 'Latest ClamAV findings reported by endpoint scans across the workspace.',
          badge: 'Security',
          loadingText: 'Loading ClamScan findings...',
          emptyText: 'No recent ClamScan findings found.',
          items: clamavSidePanelItems,
        },
        {
          eyebrow: 'Recent Sign-ins',
          title: 'Access Activity',
          description: 'Latest successful sign-ins visible in the audit stream.',
          badge: 'Audit',
          loadingText: 'Loading sign-in activity...',
          emptyText: 'No recent login activity found.',
          items: loginSidePanelItems,
        },
      ]
    : portal === 'it'
      ? [
          {
            eyebrow: 'Recent Requests',
            title: 'Queue Activity',
            description: 'Latest request records that need visibility or follow-up.',
            badge: 'Live',
            loadingText: 'Loading request activity...',
            emptyText: 'No recent request records found.',
            items: requestSidePanelItems,
          },
          {
              eyebrow: 'Threat Review',
              title: 'ClamScan Watch',
              description: 'Latest ClamAV findings reported by endpoint scans across the workspace.',
              badge: 'Security',
              loadingText: 'Loading ClamScan findings...',
              emptyText: 'No recent ClamScan findings found.',
              items: clamavSidePanelItems,
            },
            {
            eyebrow: 'Recent Sign-ins',
            title: 'Access Activity',
            description: 'Latest successful sign-ins visible in the audit stream.',
            badge: 'Audit',
            loadingText: 'Loading sign-in activity...',
            emptyText: 'No recent login activity found.',
            items: loginSidePanelItems,
          },
        ]
      : portal === 'audit'
        ? [
            {
              eyebrow: 'Recent Alerts',
              title: 'Alert Review',
              description: 'Latest alerts visible inside your audit scope.',
              badge: 'Scope',
              loadingText: 'Loading alert review items...',
              emptyText: 'No recent alerts in scope.',
              items: alertSidePanelItems,
            },
            {
              eyebrow: 'Threat Review',
              title: 'ClamScan Watch',
              description: 'Latest ClamAV findings visible inside your audit scope.',
              badge: 'Read Only',
              loadingText: 'Loading ClamScan findings...',
              emptyText: 'No recent ClamScan findings in scope.',
              items: clamavSidePanelItems,
            },
            {
              eyebrow: 'Recent Devices',
              title: 'Device Visibility',
              description: 'Most recent device records available for audit review.',
              badge: 'Read Only',
              loadingText: 'Loading device visibility...',
              emptyText: 'No recent device records in scope.',
              items: deviceSidePanelItems,
            },
          ]
        : [
            {
              eyebrow: 'Recent Requests',
              title: 'My Request Activity',
              description: 'Latest updates for the requests tied to your account.',
              badge: 'Live',
              loadingText: 'Loading your request activity...',
              emptyText: 'No recent requests yet.',
              items: requestSidePanelItems,
            },
            {
              eyebrow: 'Recent Announcements',
              title: 'Announcement Watch',
              description: 'Latest company updates published to your portal.',
              badge: 'Updates',
              loadingText: 'Loading announcement activity...',
              emptyText: 'No recent announcements yet.',
              items: announcementSidePanelItems,
            },
          ];

  const requestMixSummary = portal === 'audit'
    ? [
        { label: 'Open', value: openAlerts, helper: 'Alerts waiting for operator action', tone: 'bg-amber-400' },
        { label: 'Acknowledged', value: acknowledgedAlerts, helper: 'Alerts under active review', tone: 'bg-emerald-500' },
        { label: 'Resolved', value: resolvedAlerts, helper: 'Alerts closed successfully', tone: 'bg-emerald-500' },
      ]
    : [
        { label: 'Pending', value: pendingRequests, helper: 'New or waiting for review', tone: 'bg-amber-400' },
        { label: 'In Progress', value: inProgressRequests, helper: 'Currently handled by IT', tone: 'bg-emerald-500' },
        { label: 'Resolved', value: resolvedRequests, helper: 'Closed successfully', tone: 'bg-emerald-500' },
      ];

  const mixPanelLabel = 'Activity Status Mix';
  const snapshotDescription = portal === 'emp'
    ? 'A clean view of your requests, assets, chats, and announcements.'
    : portal === 'audit'
      ? 'A read-only summary of alerts, devices, users, and recent audit activity.'
      : 'A focused operational summary for users, requests, chat, and gatepass activity.';

  const employeeSnapshot = [
    { label: 'My Requests', value: requestsTotal, helper: 'All employee request items', tone: 'bg-brand-600' },
    { label: 'My Assets', value: assetsTotal, helper: 'Assigned devices and inventory', tone: 'bg-amber-400' },
    { label: 'Chat', value: chatTotal, helper: 'Available support channels', tone: 'bg-emerald-500' },
    { label: 'Announcements', value: announcementsTotal, helper: 'Latest visible company updates', tone: 'bg-emerald-700' },
  ];

  const employeeSnapshotTotal = employeeSnapshot.reduce((sum, item) => sum + item.value, 0) || 1;

  const employeeSnapshotChart = employeeSnapshot.map((item) => ({
    ...item,
    width: `${Math.max(10, Math.round((item.value / employeeSnapshotTotal) * 100))}%`,
  }));

  const dashboardSnapshot = portal === 'emp'
    ? []
    : portal === 'audit'
      ? [
          { label: 'Alerts', value: alertsTotal, helper: 'Visible alert records', tone: 'bg-amber-400' },
          { label: 'ClamScan', value: clamavAlertsTotal, helper: 'Visible malware scan findings', tone: 'bg-rose-500' },
          { label: 'Open', value: openAlerts, helper: 'Currently unresolved alerts', tone: 'bg-rose-500' },
          { label: 'Devices', value: devicesTotal, helper: 'Visible managed devices', tone: 'bg-brand-600' },
          { label: 'Users', value: usersTotal, helper: 'Visible directory records', tone: 'bg-emerald-500' },
          { label: 'Announcements', value: announcementsTotal, helper: 'Read-only broadcasts', tone: 'bg-emerald-500' },
        ]
    : [
        { label: 'ClamScan', value: clamavAlertsTotal, helper: 'Visible malware scan findings', tone: 'bg-rose-500' },
        { label: 'Total Users', value: usersTotal, helper: 'Visible user records', tone: 'bg-brand-600' },
        { label: 'Open Requests', value: pendingRequests + inProgressRequests, helper: 'Pending and active work', tone: 'bg-amber-500' },
        { label: 'Gatepasses', value: gatepassTotal, helper: 'Total gatepass records', tone: 'bg-emerald-700' },
        { label: 'Chat Channels', value: chatTotal, helper: 'Latest visible chat channels', tone: 'bg-emerald-500' },
        { label: 'Announcements', value: announcementsTotal, helper: 'Broadcast items visible now', tone: 'bg-amber-400' },
        { label: 'Users', value: usersTotal, helper: 'Directory records shown now', tone: 'bg-emerald-500' },
      ];

  const dashboardSnapshotTotal = dashboardSnapshot.reduce((sum, item) => sum + item.value, 0) || 1;

  const dashboardSnapshotChart = dashboardSnapshot.map((item) => ({
    ...item,
    width: `${Math.max(10, Math.round((item.value / dashboardSnapshotTotal) * 100))}%`,
  }));

  const snapshotMetrics = portal === 'emp' ? employeeSnapshot : dashboardSnapshot;
  const snapshotChart = portal === 'emp' ? employeeSnapshotChart : dashboardSnapshotChart;
  const snapshotVisibleMetrics = snapshotMetrics.slice(0, portal === 'emp' ? 4 : 6);
  const sidePanelVisibleItemCount = portal === 'emp' ? 2 : 3;
  const sectionVisibleItemCount = 3;
  const compactFeedItems = sidePanels
    .flatMap((panel) => panel.items.slice(0, sidePanelVisibleItemCount).map((item) => ({
      ...item,
      sourceTitle: panel.title,
      sourceEyebrow: panel.eyebrow,
      sourceBadge: panel.badge,
    })))
    .slice(0, 8);
  const patchWeeklyTrend = useMemo(() => buildPatchTrend(weeklyPatchReports, trendWindowDays), [trendWindowDays, weeklyPatchReports]);
  const inventoryWeeklyTrend = useMemo(() => buildTrend(weeklyInventoryAssets.map((item) => item.createdAt), trendWindowDays), [trendWindowDays, weeklyInventoryAssets]);
  const alertsWeeklyTrend = useMemo(() => buildTrend(weeklyAlertItems.map((item) => item.createdAt), trendWindowDays), [trendWindowDays, weeklyAlertItems]);
  const gatepassesWeeklyTrend = useMemo(() => buildTrend(weeklyGatepassItems.map((item) => item.createdAt), trendWindowDays), [trendWindowDays, weeklyGatepassItems]);
  const usersWeeklyTrend = useMemo(() => buildTrend(weeklyLoginItems.map((item) => item.createdAt), trendWindowDays), [trendWindowDays, weeklyLoginItems]);
  const userAddedWeeklyTrend = useMemo(() => buildTrend(weeklyUserItems.map((item) => item.createdAt), trendWindowDays), [trendWindowDays, weeklyUserItems]);
  const weeklyTrendCards = useMemo<WeeklyTrendCard[]>(() => {
    if (portal === 'emp') {
      return [];
    }
    if (portal === 'audit') {
      return [
        {
          title: 'Alert Activity',
          description: 'Alerts recorded this week',
          series: [{ label: 'Alerts', tone: 'bg-amber-400', points: alertsWeeklyTrend }],
        },
        {
          title: 'User Sign-Ins',
          description: 'Sign-ins recorded this week',
          series: [{ label: 'Users', tone: 'bg-emerald-500', points: usersWeeklyTrend }],
        },
        {
          title: 'New Users',
          description: 'Users created this week',
          series: [{ label: 'Added', tone: 'bg-brand-600', points: userAddedWeeklyTrend }],
        },
      ];
    }
    return [
      {
        title: 'Patch Status',
        description: 'Updated and not updated systems this week',
        series: [
          { label: 'Updated', tone: 'bg-emerald-500', points: patchWeeklyTrend.updated },
          { label: 'Not Updated', tone: 'bg-rose-400', points: patchWeeklyTrend.notUpdated },
        ],
      },
      {
        title: 'Inventory',
        description: 'Inventory added this week',
        series: [{ label: 'Added', tone: 'bg-brand-600', points: inventoryWeeklyTrend }],
      },
      {
        title: 'Alert Activity',
        description: 'Alerts recorded this week',
        series: [{ label: 'Alerts', tone: 'bg-amber-400', points: alertsWeeklyTrend }],
      },
      {
        title: 'Gatepass Activity',
        description: 'Gatepasses recorded this week',
        series: [{ label: 'Gatepasses', tone: 'bg-emerald-700', points: gatepassesWeeklyTrend }],
      },
      {
        title: 'User Sign-Ins',
        description: 'Sign-ins recorded this week',
        series: [{ label: 'Users', tone: 'bg-emerald-500', points: usersWeeklyTrend }],
      },
      {
        title: 'New Users',
        description: 'Users created this week',
        series: [{ label: 'Added', tone: 'bg-indigo-500', points: userAddedWeeklyTrend }],
      },
    ];
  }, [alertsWeeklyTrend, gatepassesWeeklyTrend, inventoryWeeklyTrend, patchWeeklyTrend.notUpdated, patchWeeklyTrend.updated, portal, userAddedWeeklyTrend, usersWeeklyTrend]);
  const patchMonthTotals = useMemo(() => ({
    currentUpdated: sumPatchValuesForMonth(weeklyPatchReports, 'updated', 0),
    currentNotUpdated: sumPatchValuesForMonth(weeklyPatchReports, 'notUpdated', 0),
    lastUpdated: sumPatchValuesForMonth(weeklyPatchReports, 'updated', -1),
    lastNotUpdated: sumPatchValuesForMonth(weeklyPatchReports, 'notUpdated', -1),
  }), [weeklyPatchReports]);
  const inventoryMonthTotals = useMemo(() => ({
    current: sumValuesForMonth(weeklyInventoryAssets.map((item) => item.createdAt), 0),
    last: sumValuesForMonth(weeklyInventoryAssets.map((item) => item.createdAt), -1),
  }), [weeklyInventoryAssets]);
  const alertsMonthTotals = useMemo(() => ({
    current: sumValuesForMonth(weeklyAlertItems.map((item) => item.createdAt), 0),
    last: sumValuesForMonth(weeklyAlertItems.map((item) => item.createdAt), -1),
  }), [weeklyAlertItems]);
  const gatepassMonthTotals = useMemo(() => ({
    current: sumValuesForMonth(weeklyGatepassItems.map((item) => item.createdAt), 0),
    last: sumValuesForMonth(weeklyGatepassItems.map((item) => item.createdAt), -1),
  }), [weeklyGatepassItems]);
  const usersMonthTotals = useMemo(() => ({
    current: sumValuesForMonth(weeklyLoginItems.map((item) => item.createdAt), 0),
    last: sumValuesForMonth(weeklyLoginItems.map((item) => item.createdAt), -1),
  }), [weeklyLoginItems]);
  const userAddedMonthTotals = useMemo(() => ({
    current: sumValuesForMonth(weeklyUserItems.map((item) => item.createdAt), 0),
    last: sumValuesForMonth(weeklyUserItems.map((item) => item.createdAt), -1),
  }), [weeklyUserItems]);
  const activeUsersToday = useMemo(() => weeklyLoginItems.filter((item) => isSameLocalDay(item.createdAt, activeNow)).length, [activeNow, weeklyLoginItems]);
  const offlineUsersCount = useMemo(() => countOfflineUsersFromDevices(recentDevices), [recentDevices]);
  const dashboardHighlights = useMemo(() => [
    {
      label: 'Total Systems Added',
      value: inventoryTotal,
      helper: 'Inventory systems currently tracked',
    },
    {
      label: 'Active Users Today',
      value: activeUsersToday,
      helper: 'Successful sign-ins recorded today',
    },
    {
      label: 'Offline Users',
      value: offlineUsersCount,
      helper: 'Assigned users with no device heartbeat in the last 24 hours',
    },
  ], [activeUsersToday, inventoryTotal, offlineUsersCount]);
  const trendWindowLabel = `${trendWindowDays}-day`;
  const trendWindowLabelCapitalized = `${trendWindowDays}-Day`;
  const showChartsOnly = true;

  return (
    <div className="space-y-6 bg-zinc-50/60 px-4 py-6 xl:px-6">
      {showChartsOnly ? (
        <section className="overflow-hidden rounded-[32px] border border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(110,231,183,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(16,185,129,0.12),_transparent_24%),linear-gradient(135deg,_#f4fbf6_0%,_#ffffff_58%,_#f6fbf7_100%)] p-6 shadow-sm lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                {portalLabel} Workspace
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-zinc-950 sm:text-4xl">Welcome {welcomeName}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">A focused chart dashboard with live counts for systems, users active today, and offline users.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px] lg:max-w-[520px] lg:flex-1">
              <div className="rounded-[24px] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Portal</div>
                <div className="mt-2 text-lg font-black text-zinc-950">{portalLabel}</div>
                <div className="mt-1 text-sm text-zinc-500">Live dashboard view</div>
              </div>
              <div className="rounded-[24px] border border-emerald-700 bg-emerald-800 px-4 py-4 text-white shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100">Focus</div>
                <div className="mt-2 text-lg font-black">Operational Pulse</div>
                <div className="mt-1 text-sm text-zinc-300">Charts-only summary</div>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Snapshot</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-zinc-900">Total systems, active users, and offline visibility in one view.</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!showChartsOnly ? <section className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(135deg,_#fdfefe_0%,_#f4fbf6_45%,_#dcfce7_100%)] p-6 shadow-[0_24px_70px_rgba(16,185,129,0.10)] lg:p-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_62%)]" />
        <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full bg-emerald-200/35 blur-2xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-stretch xl:justify-between">
          <div className="max-w-3xl space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-700 backdrop-blur">
                <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                {portalLabel} Workspace
              </div>
              <div className="inline-flex items-center rounded-full border border-white/80 bg-emerald-800 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-sm">
                Live {activeNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{overviewLabel}</div>
              <h1 className="max-w-2xl text-4xl font-black tracking-[-0.04em] text-zinc-950 sm:text-5xl">Welcome {welcomeName}</h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">{welcomeSubtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Active Session</div>
                <div className="mt-2 text-lg font-black text-zinc-950">{welcomeName}</div>
                <div className="mt-1 text-sm text-zinc-500">{portalLabel} portal</div>
              </div>
              <div className="rounded-[24px] border border-emerald-700 bg-emerald-800 px-4 py-4 text-white shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100">Request Load</div>
                <div className="mt-2 text-lg font-black">{loading ? '...' : requestChartTotal}</div>
                <div className="mt-1 text-sm text-slate-300">Active workflow items in this workspace</div>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Workspace Focus</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-zinc-900">{snapshotDescription}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {heroActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className={action.tone === 'primary'
                    ? `rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition ${actionButtonStyles.add}`
                    : 'rounded-2xl border border-emerald-200 bg-white/90 px-5 py-3 text-sm font-bold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50'}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="grid min-w-0 gap-4 xl:w-[380px]">
            <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Command View</div>
                  <div className="mt-2 text-2xl font-black tracking-tight text-zinc-950">Operational pulse</div>
                </div>
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Live</div>
              </div>
              <div className="mt-5 space-y-3">
                {requestMixSummary.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${segment.tone}`} />
                      <div>
                        <div className="text-sm font-bold text-zinc-950">{segment.label}</div>
                        <div className="text-xs text-zinc-500">{segment.helper}</div>
                      </div>
                    </div>
                    <div className="text-xl font-black text-zinc-950">{loading ? '...' : segment.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section> : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {showChartsOnly ? (
        <section className="grid gap-4 md:grid-cols-3">
          {dashboardHighlights.map((item) => (
            <div key={item.label} className="rounded-[26px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-5 shadow-sm">
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Live Metric</div>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{item.label}</div>
              <div className="mt-3 text-3xl font-black text-zinc-950">{loading ? '...' : item.value}</div>
              <div className="mt-2 text-sm leading-6 text-zinc-500">{item.helper}</div>
            </div>
          ))}
        </section>
      ) : null}

      {!showChartsOnly ? <div className={`grid gap-4 sm:grid-cols-2 ${cardsGridClass}`}>
        {cards.map((card) => (
          <Link key={card.label} to={card.href} className="flex min-h-[148px] flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/30">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{card.label}</div>
              <card.icon className="h-5 w-5 text-brand-600" />
            </div>
            <div className="mt-4 text-3xl font-black text-zinc-950">{loading ? '...' : card.value}</div>
            <div className="mt-2 text-sm text-zinc-500">{card.description}</div>
            <div className="mt-auto pt-4 inline-flex items-center text-xs font-bold uppercase tracking-wider text-brand-700">Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></div>
          </Link>
        ))}
      </div> : null}

      {weeklyTrendCards.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Charts</div>
              <h2 className="mt-1 text-xl font-black text-zinc-950">{portalLabel} Chart View</h2>
              <p className="mt-1 text-sm text-zinc-500">Filter charts by 7, 30, or 90 days and compare current month against last month.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([7, 30, 90] as TrendWindowDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrendWindowDays(days)}
                  className={trendWindowDays === days
                    ? 'rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white'
                    : 'rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600'}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {weeklyTrendCards.map((card) => {
              const maxValue = Math.max(1, ...card.series.flatMap((series) => series.points.map((point) => point.value)));
              const cardSummary = summarizeCardSeries(card.series);
              const cardDescription = card.description.replace('this week', `in ${trendWindowLabel}`);
              const monthTotals = card.title === 'Patch Status'
                ? { current: patchMonthTotals.currentUpdated + patchMonthTotals.currentNotUpdated, last: patchMonthTotals.lastUpdated + patchMonthTotals.lastNotUpdated }
                : card.title === 'Inventory'
                  ? inventoryMonthTotals
                  : card.title === 'Alert Activity'
                    ? alertsMonthTotals
                    : card.title === 'Gatepass Activity'
                      ? gatepassMonthTotals
                      : card.title === 'User Sign-Ins'
                        ? usersMonthTotals
                        : userAddedMonthTotals;
              const monthOverMonthChange = calculatePercentChange(monthTotals.current, monthTotals.last);
              return (
                <div key={card.title} className="rounded-[28px] border border-zinc-200 bg-zinc-50/70 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-zinc-950">{card.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{cardDescription}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="rounded-full bg-emerald-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                        {cardSummary.weeklyTotal} total in {trendWindowLabel}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                      {card.series.map((series) => (
                        <div key={series.label} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 ring-1 ring-zinc-200">
                          <span className={`h-2 w-2 rounded-full ${series.tone}`} />
                          {series.label}
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{trendWindowLabelCapitalized} Total</div>
                      <div className="mt-2 text-lg font-black text-zinc-950">{cardSummary.weeklyTotal}</div>
                      <div className="mt-1 text-xs text-zinc-500">Average/day: {cardSummary.averagePerDay.toFixed(1)}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Peak Day</div>
                      <div className="mt-2 text-lg font-black text-zinc-950">{cardSummary.peakDay.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{cardSummary.peakDay.total} records</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Latest Day</div>
                      <div className="mt-2 text-lg font-black text-zinc-950">{cardSummary.latestDay.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{cardSummary.latestDay.total} records</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Last Month</div>
                      <div className="mt-2 text-lg font-black text-zinc-950">{monthTotals.last}</div>
                      <div className="mt-1 text-xs text-zinc-500">Current month: {monthTotals.current}</div>
                      <div className="mt-1 text-xs text-zinc-500">{formatMonthOverMonthChange(monthOverMonthChange)}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {card.series.map((series) => {
                      const summary = summarizeTrend(series.points);
                      const shareOfCardTotal = cardSummary.weeklyTotal > 0 ? (summary.total / cardSummary.weeklyTotal) * 100 : 0;
                      const monthComparison = card.title === 'Patch Status'
                        ? {
                            current: series.label === 'Updated' ? patchMonthTotals.currentUpdated : patchMonthTotals.currentNotUpdated,
                            last: series.label === 'Updated' ? patchMonthTotals.lastUpdated : patchMonthTotals.lastNotUpdated,
                          }
                        : card.title === 'Inventory'
                          ? inventoryMonthTotals
                          : card.title === 'Alert Activity'
                            ? alertsMonthTotals
                            : card.title === 'Gatepass Activity'
                              ? gatepassMonthTotals
                              : card.title === 'User Sign-Ins'
                                ? usersMonthTotals
                                : userAddedMonthTotals;
                      const monthChange = calculatePercentChange(monthComparison.current, monthComparison.last);
                      const TrendIcon = summary.dayOverDayChange == null ? Minus : summary.dayOverDayChange >= 0 ? ArrowUpRight : ArrowDownRight;
                      return (
                        <div key={`${card.title}-${series.label}-summary`} className="rounded-2xl border border-zinc-200 bg-white/90 px-3 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{series.label}</div>
                          <div className="mt-2 text-sm font-bold text-zinc-900">{summary.total} in {trendWindowLabel}</div>
                          <div className="mt-1 text-xs text-zinc-500">Last month: {monthComparison.last} • Current month: {monthComparison.current}</div>
                          <div className="mt-1 text-xs text-zinc-500">Peak: {summary.peakLabel} ({summary.peakValue})</div>
                          <div className="mt-1 text-xs text-zinc-500">Latest: {summary.latestLabel} ({summary.latestValue})</div>
                          <div className="mt-1 text-xs text-zinc-500">Average/day: {summary.averagePerDay.toFixed(1)} • Active days: {summary.activeDays}/{trendWindowDays}</div>
                          <div className="mt-1 text-xs text-zinc-500">{formatShare(shareOfCardTotal)}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${summary.dayOverDayChange == null ? 'bg-zinc-100 text-zinc-500' : summary.dayOverDayChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              <TrendIcon className="h-3 w-3" />
                              {formatPercentChange(summary.dayOverDayChange)}
                            </div>
                            <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${monthChange == null ? 'bg-zinc-100 text-zinc-500' : monthChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {monthChange == null ? <Minus className="h-3 w-3" /> : monthChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {formatMonthOverMonthChange(monthChange)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${trendWindowDays}, minmax(48px, 1fr))`, minWidth: `${trendWindowDays * 52}px` }}>
                      {card.series[0].points.map((point, index) => (
                        <div key={`${card.title}-${point.label}-${index}`} className="flex flex-col items-center gap-2">
                          <div className="text-[11px] font-bold text-zinc-600">{cardSummary.dailyTotals[index]?.total || 0}</div>
                          <div className="flex h-32 items-end gap-1.5 rounded-2xl bg-white/70 px-2 py-2">
                            {card.series.map((series) => {
                              const value = series.points[index]?.value || 0;
                              const height = `${Math.max(value > 0 ? 14 : 6, Math.round((value / maxValue) * 100))}%`;
                              return <div key={series.label} className={`w-3 rounded-t-[10px] ${series.tone}`} style={{ height }} title={`${series.label}: ${value}`} />;
                            })}
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{point.label}</div>
                            <div className="text-[10px] text-zinc-400">{point.shortLabel}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200 bg-white/90">
                    <table className="min-w-full divide-y divide-zinc-200 text-left text-xs text-zinc-600" style={{ minWidth: `${220 + trendWindowDays * 70}px` }}>
                      <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                        <tr>
                          <th className="px-3 py-2">Day</th>
                          {card.series.map((series) => (
                            <th key={`${card.title}-${series.label}-head`} className="px-3 py-2">{series.label}</th>
                          ))}
                          <th className="px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {card.series[0].points.map((point, index) => (
                          <tr key={`${card.title}-${point.label}-row`}>
                            <td className="px-3 py-2 font-semibold text-zinc-700">{point.label} {point.shortLabel}</td>
                            {card.series.map((series) => (
                              <td key={`${card.title}-${series.label}-${point.label}-value`} className="px-3 py-2">{series.points[index]?.value || 0}</td>
                            ))}
                            <td className="px-3 py-2 font-bold text-zinc-900">{cardSummary.dailyTotals[index]?.total || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Charts</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">{portalLabel} Chart View</h2>
          <p className="mt-2 text-sm text-zinc-500">No charts are available for this portal.</p>
        </section>
      )}

      {!showChartsOnly ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Workspace Analytics</div>
            <h2 className="mt-1 text-xl font-black text-zinc-950">Activity Overview</h2>
            <p className="mt-1 text-sm text-zinc-500">{snapshotDescription}</p>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{mixPanelLabel}</div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-700 ring-1 ring-zinc-200">{loading ? '...' : `${requestChartTotal} total`}</div>
              </div>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-200">
                {requestChart.map((segment) => (
                  <div key={segment.label} className={segment.tone} style={{ width: segment.width }} />
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {requestMixSummary.map((segment) => (
                  <div key={segment.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${segment.tone}`} />
                      {segment.label}
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">{loading ? '...' : segment.value}</div>
                    <div className="mt-1 text-xs text-zinc-500">{segment.helper}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Key Metrics</div>
                <div className="rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-600 ring-1 ring-zinc-200">
                  {loading ? '...' : `${snapshotVisibleMetrics.length} shown`}
                </div>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-zinc-100">
                {snapshotChart.map((segment) => (
                  <div key={segment.label} className={segment.tone} style={{ width: segment.width }} />
                ))}
              </div>
              <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${snapshotVisibleMetrics.length >= 5 ? 'xl:grid-cols-2' : 'xl:grid-cols-2'}`}>
                {snapshotVisibleMetrics.map((segment) => (
                  <div key={segment.label} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
                      <CircleDot className="h-3.5 w-3.5 text-brand-600" />
                      {segment.label}
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">{loading ? '...' : segment.value}</div>
                    <div className="mt-1 text-xs text-zinc-500">{segment.helper}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Live Activity</div>
              <h2 className="mt-1 text-xl font-black text-zinc-950">Compact Feed</h2>
              <p className="mt-1 text-sm text-zinc-500">Latest operational updates across the most important dashboard streams.</p>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
              {loading ? '...' : `${compactFeedItems.length} items`}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {loading ? <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">Loading activity feed...</div> : null}
            {!loading && compactFeedItems.length === 0 ? <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">No recent activity found.</div> : null}
            {!loading && compactFeedItems.map((item) => (
              <div key={`${item.sourceTitle}-${item.id}`} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 ring-1 ring-zinc-200">{item.sourceEyebrow}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{item.sourceTitle}</span>
                    </div>
                    <div className="mt-3 text-sm font-bold text-zinc-950">{item.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{item.meta}</div>
                    {item.timestamp ? <div className="mt-2 text-xs text-zinc-500">{item.timestamp}</div> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">{item.sourceBadge}</div>
                    {item.badge ? <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{item.badge}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div> : null}

      {!showChartsOnly ? <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">{section.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{section.description}</p>
              </div>
              <Link to={section.href} className="text-sm font-bold text-brand-700 hover:text-brand-800">Open</Link>
            </div>
            <div className="divide-y divide-zinc-100">
              {loading ? <div className="px-5 py-8 text-sm text-zinc-500">Loading...</div> : null}
              {!loading && section.items.length === 0 ? <div className="px-5 py-8 text-sm text-zinc-500">{section.emptyState}</div> : null}
              {!loading && section.items.slice(0, sectionVisibleItemCount).map((item) => (
                <Link key={item.id} to={section.href} className="block px-5 py-4 transition hover:bg-zinc-50">
                  <div className="text-sm font-semibold text-zinc-900">{getSectionItemTitle(item, section.kind)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{getSectionItemMeta(item, section.kind)}</div>
                  <div className="mt-1 text-[11px] text-zinc-400">{getSectionItemTimestamp(item, section.kind)}</div>
                </Link>
              ))}
              {!loading && section.items.length > sectionVisibleItemCount ? (
                <div className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Showing latest {sectionVisibleItemCount} of {section.items.length}
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div> : null}
    </div>
  );
}