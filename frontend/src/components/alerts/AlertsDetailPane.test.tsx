import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsDetailPane } from './AlertsDetailPane';
import type { AlertsListRecord, AlertsRelatedRecord } from './types';

const alertRecord: AlertsListRecord = {
  id: 'alert-1',
  assetId: 'asset-1',
  assetTag: 'IT-001',
  assetName: 'Operations Laptop',
  hostname: 'ops-laptop-01',
  deviceId: 'device-1',
  userId: 'user-1',
  userName: 'Alex Kumar',
  userEmail: 'alex@example.com',
  department: 'IT Operations',
  source: 'clamav',
  sourceLabel: 'ClamScan',
  severity: 'high',
  title: 'Malware signature triggered',
  detail: 'Scanned 70436 files; infected: 2; errors: 0. ---------- SCAN SUMMARY ---------- Known viruses: 3627837 Engine version: 1.4.3 Scanned files: 70436 Infected files: 2 Data scanned: 5166.48 MB Paths: /home,/etc,/opt',
  acknowledged: false,
  resolved: false,
  createdAt: '2026-05-08T04:00:00Z',
};

const relatedAlerts: AlertsRelatedRecord[] = [
  {
    id: 'related-1',
    source: 'wazuh',
    severity: 'medium',
    title: 'Wazuh integrity change',
    detail: 'Critical system file changed unexpectedly.',
    acknowledged: true,
    resolved: false,
    createdAt: '2026-05-08T02:00:00Z',
  },
];

function renderPane(selectedAlert: AlertsListRecord | null) {
  return renderToStaticMarkup(
    <AlertsDetailPane
      selectedAlert={selectedAlert}
      selectedAlertSource={selectedAlert?.source || ''}
      canAcknowledge={true}
      canResolve={true}
      detailActionLoading=""
      detailMessage={null}
      selectedAssetCanStartTerminal={true}
      selectedAssetCanOpenPatchConsole={true}
      selectedAssetCanRunPatch={true}
      terminalBlockedReason=""
      patchBlockedReason=""
      selectedSaltAction="system-update"
      customSaltInput=""
      selectedPatchActionLabel="Run Salt Action"
      relatedAlerts={selectedAlert ? relatedAlerts : []}
      relatedAlertsLoading={false}
      onOpenAsset={() => {}}
      onStartTerminal={() => {}}
      onOpenSaltConsole={() => {}}
      onAcknowledge={() => {}}
      onResolve={() => {}}
      onRunPatch={() => {}}
      onSelectedSaltActionChange={() => {}}
      onCustomSaltInputChange={() => {}}
      renderSystemName={(alert) => alert.hostname || 'Unknown system'}
      renderSeverityClassName={() => 'bg-rose-100 text-rose-700'}
      renderSourceBadgeClassName={() => 'border-zinc-200 bg-white text-zinc-700'}
      renderSourceIcon={() => <span>icon</span>}
      renderSourceLabel={(value) => value.toUpperCase()}
      renderAlertStatusClassName={() => 'bg-amber-100 text-amber-700'}
      renderAlertStatusLabel={() => 'Open'}
      renderAlertUser={(alert) => alert.userName || '-'}
      renderSeverityDotClassName={() => 'bg-amber-500'}
      formatRelativeTime={() => '2 hours ago'}
      formatAbsoluteTime={() => '08 May 2026'}
    />,
  );
}

describe('AlertsDetailPane', () => {
  it('renders alert investigation details with related findings', () => {
    const markup = renderPane(alertRecord);

    expect(markup).toContain('Alert Investigation');
    expect(markup).toContain('Malware signature triggered');
    expect(markup).toContain('Selected Asset');
    expect(markup).toContain('IT-001');
    expect(markup).toContain('70,436 scanned');
    expect(markup).toContain('Asset Findings');
    expect(markup).toContain('Wazuh integrity change');
  });

  it('renders the empty state when no alert is selected', () => {
    const markup = renderPane(null);

    expect(markup).toContain('Select an alert');
    expect(markup).toContain('Pick any item from the feed to inspect asset context');
  });
});