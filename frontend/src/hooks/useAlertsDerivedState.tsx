import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { AlertsDashboardResponse, PaginatedAlertsResponse } from '../components/alerts/types';

type SourceKey = 'wazuh' | 'openscap' | 'clamav';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

interface SourceConfigItem {
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  issueShortLabel: string;
}

interface UseAlertsDerivedStateParams {
  alertsData: PaginatedAlertsResponse | null;
  dashboardData: Record<SourceKey, AlertsDashboardResponse | null>;
  sourceKeys: SourceKey[];
  sourceConfig: Record<SourceKey, SourceConfigItem>;
  searchQuery: string;
  severityFilter: SeverityFilter;
  sourceFilter: string;
  alertsPage: number;
  formatDateTime: (value?: string | null) => string;
  normalizeSeverity: (value?: string | null) => SeverityFilter;
  normalizeSourceKey: (value?: string | null) => string;
  sourceLabel: (value: string, fallback?: string | null) => string;
}

export function useAlertsDerivedState({
  alertsData,
  dashboardData,
  sourceKeys,
  sourceConfig,
  searchQuery,
  severityFilter,
  sourceFilter,
  alertsPage,
  formatDateTime,
  normalizeSeverity,
  normalizeSourceKey,
  sourceLabel,
}: UseAlertsDerivedStateParams) {
  const alerts = useMemo(() => alertsData?.items ?? [], [alertsData?.items]);

  const sourceAlerts = useMemo(
    () => ({
      wazuh: alerts.filter((alert) => normalizeSourceKey(alert.source) === 'wazuh'),
      openscap: alerts.filter((alert) => normalizeSourceKey(alert.source) === 'openscap'),
      clamav: alerts.filter((alert) => normalizeSourceKey(alert.source) === 'clamav'),
    }),
    [alerts, normalizeSourceKey],
  );

  const moduleCards = useMemo(
    () => dashboardData.wazuh?.moduleCards ?? dashboardData.openscap?.moduleCards ?? dashboardData.clamav?.moduleCards ?? [],
    [dashboardData.clamav?.moduleCards, dashboardData.openscap?.moduleCards, dashboardData.wazuh?.moduleCards],
  );

  const moduleCardBySource = useMemo(() => {
    return new Map(moduleCards.map((card) => [normalizeSourceKey(card.source), card]));
  }, [moduleCards, normalizeSourceKey]);

  const summarySourceOptions = useMemo(() => {
    const fromSummary = alertsData?.summary?.sourceCounts?.map((item) => ({
      value: item.name,
      label: sourceLabel(item.name, item.label),
      count: item.count,
    }));
    if (fromSummary && fromSummary.length > 0) {
      return fromSummary;
    }

    const counts = new Map<string, number>();
    alerts.forEach((alert) => {
      const key = normalizeSourceKey(alert.source);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: sourceLabel(value), count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [alerts, alertsData?.summary?.sourceCounts, normalizeSourceKey, sourceLabel]);

  const sourceCountMap = useMemo(() => {
    return new Map(summarySourceOptions.map((item) => [item.value, item.count]));
  }, [summarySourceOptions]);

  const sourceLabelMap = useMemo(() => {
    return new Map(summarySourceOptions.map((item) => [item.value, item.label]));
  }, [summarySourceOptions]);

  const alertsToolbarTabs = useMemo(
    () => [{ value: 'all', label: 'All Alerts' }, ...summarySourceOptions.map((option) => ({ value: option.value, label: option.label }))],
    [summarySourceOptions],
  );

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return alerts.filter((alert) => {
      const matchesSource = sourceFilter === 'all' || normalizeSourceKey(alert.source) === sourceFilter;
      const matchesSeverity = severityFilter === 'all' || normalizeSeverity(alert.severity) === severityFilter;
      const matchesQuery =
        query.length === 0 ||
        [
          alert.id,
          alert.title,
          alert.detail,
          alert.hostname,
          alert.assetTag,
          alert.assetName,
          alert.department,
          alert.userName,
          alert.userEmail,
          sourceLabel(alert.source, alert.sourceLabel),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      return matchesSource && matchesSeverity && matchesQuery;
    });
  }, [alerts, normalizeSeverity, normalizeSourceKey, searchQuery, severityFilter, sourceFilter, sourceLabel]);

  const alertsPageSize = 12;
  const paginatedFilteredAlerts = useMemo(() => {
    const startIndex = (alertsPage - 1) * alertsPageSize;
    return filteredAlerts.slice(startIndex, startIndex + alertsPageSize);
  }, [alertsPage, filteredAlerts]);

  const totalAlerts = alertsData?.total ?? alerts.length;
  const openAlertsCount = alertsData?.summary?.open ?? alerts.filter((alert) => !alert.resolved && !alert.acknowledged).length;
  const acknowledgedAlertsCount = alertsData?.summary?.acknowledged ?? alerts.filter((alert) => alert.acknowledged && !alert.resolved).length;
  const resolvedAlertsCount = alertsData?.summary?.resolved ?? alerts.filter((alert) => alert.resolved).length;

  const dashboardSourceCards = sourceKeys.map((source) => {
    const config = sourceConfig[source];
    const Icon = config.icon;
    const moduleCard = moduleCardBySource.get(source);

    return {
      source,
      label: config.label,
      description: config.description,
      accentClassName: config.accent,
      icon: <Icon className="h-6 w-6" />,
      scannedCount: moduleCard?.totalSystemsScanned ?? 0,
      issueCount: moduleCard?.errorSystemsCount ?? 0,
      issueLabel: config.issueShortLabel,
      alertCount: sourceAlerts[source].length,
      lastScanLabel: formatDateTime(moduleCard?.lastUpdated),
    };
  });

  const recentAlerts = alerts.slice(0, 8);

  return {
    alerts,
    sourceAlerts,
    moduleCards,
    summarySourceOptions,
    sourceCountMap,
    sourceLabelMap,
    alertsToolbarTabs,
    filteredAlerts,
    alertsPageSize,
    paginatedFilteredAlerts,
    totalAlerts,
    openAlertsCount,
    acknowledgedAlertsCount,
    resolvedAlertsCount,
    dashboardSourceCards,
    recentAlerts,
  };
}