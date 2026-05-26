import type { AlertsListRecord } from './types';

export function selectRecentAlert(
  alert: AlertsListRecord,
  _alerts: AlertsListRecord[],
  onSelectAlert?: (alert: AlertsListRecord, alerts: AlertsListRecord[]) => void,
) {
  onSelectAlert?.(alert, [alert]);
}
