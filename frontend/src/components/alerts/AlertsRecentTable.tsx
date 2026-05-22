import type { AlertsListRecord } from './types';

interface AlertsRecentTableProps {
  alerts: AlertsListRecord[];
  onSelectAlert?: (alert: AlertsListRecord, alerts: AlertsListRecord[]) => void;
  renderSystemName: (alert: AlertsListRecord) => string;
  renderSeverityClassName: (alert: AlertsListRecord) => string;
  renderSourceLabel: (value: string) => string;
  formatDateTime: (value?: string | null) => string;
}

function renderSeverityBorderClassName(alert: AlertsListRecord) {
  const severity = alert.severity.toLowerCase();
  if (severity === 'critical') {
    return 'border-l-red-500';
  }
  if (severity === 'high') {
    return 'border-l-orange-500';
  }
  if (severity === 'medium' || severity === 'warning') {
    return 'border-l-amber-400';
  }
  return 'border-l-sky-500';
}

function renderSeverityLabel(alert: AlertsListRecord) {
  const severity = (alert.severity || '').trim().toLowerCase();
  if (!severity) {
    return 'low';
  }
  if (severity === 'warning') {
    return 'medium';
  }
  if (severity === 'info') {
    return 'low';
  }
  return severity;
}

export function selectRecentAlert(
  alert: AlertsListRecord,
  _alerts: AlertsListRecord[],
  onSelectAlert?: (alert: AlertsListRecord, alerts: AlertsListRecord[]) => void,
) {
  onSelectAlert?.(alert, [alert]);
}

export function AlertsRecentTable({
  alerts,
  onSelectAlert,
  renderSystemName,
  renderSeverityClassName,
  renderSourceLabel,
  formatDateTime,
}: AlertsRecentTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-4">ID</th>
            <th className="px-5 py-4">Severity</th>
            <th className="px-5 py-4">System + rule</th>
            <th className="px-5 py-4">Department</th>
            <th className="px-5 py-4">Source</th>
            <th className="px-5 py-4">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {alerts.map((alert) => {
            const handleSelect = onSelectAlert ? () => selectRecentAlert(alert, alerts, onSelectAlert) : undefined;
            const handleKeyDown = !onSelectAlert
              ? undefined
              : (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }
                  event.preventDefault();
                  selectRecentAlert(alert, alerts, onSelectAlert);
                };

            return (
            <tr
              key={alert.id}
              role={onSelectAlert ? 'button' : undefined}
              tabIndex={onSelectAlert ? 0 : undefined}
              onClick={handleSelect}
              onKeyDown={handleKeyDown}
              className={`border-l-4 ${renderSeverityBorderClassName(alert)} ${onSelectAlert ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-inset' : ''} hover:bg-zinc-50/80`}
            >
              <td onClick={handleSelect} className="px-5 py-4 font-bold text-zinc-900">{alert.id}</td>
              <td onClick={handleSelect} className="px-5 py-4">
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${renderSeverityClassName(alert)}`}>{renderSeverityLabel(alert)}</span>
              </td>
              <td onClick={handleSelect} className="px-5 py-4">
                <div className="font-semibold text-zinc-900">{renderSystemName(alert)}</div>
                <div className="text-sm text-zinc-500">{alert.title}</div>
              </td>
              <td onClick={handleSelect} className="px-5 py-4 text-zinc-600">{alert.department || 'Unassigned'}</td>
              <td onClick={handleSelect} className="px-5 py-4 text-zinc-600">{alert.sourceLabel || renderSourceLabel(alert.source)}</td>
              <td onClick={handleSelect} className="px-5 py-4 text-zinc-600">{formatDateTime(alert.createdAt)}</td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}